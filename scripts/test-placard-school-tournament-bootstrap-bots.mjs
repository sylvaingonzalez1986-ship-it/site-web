import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const db=new PGlite(),checks=[];
const plan={contentVersion:'2026-11-14.champion1',questions:Array.from({length:12},(_,index)=>({
  question:{id:`bootstrap-q${String(index+1).padStart(2,'0')}`,prompt:`Question ${index+1}`,level:Math.floor(index/3)+1,
    difficulty:'medium',themeId:'plant',lessonId:'reference',sectionId:'plant',sources:[{id:'test-source',title:'Source',url:'https://example.test/source'}],
    options:['a','b','c','d'].map(id=>({id,text:`Choix ${id}`}))},answer:{correctOptionId:'a',explanation:`Correction privée ${index+1}`}}))};
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const call=(owner,command=null)=>scalar('SELECT rpc_kq_school_tournament($1,$2,$3)',[owner,command,command?.action==='join'?plan:null]);
const command=(action,roomId,extra={})=>({action,requestKey:randomUUID(),...(roomId?{roomId}:{}),...extra});
const check=(name,value,expected)=>{assert.deepEqual(value,expected,name);checks.push(name);};
const reject=async(name,owner,input,pattern=/school_tournament_/)=>{await assert.rejects(()=>call(owner,input),pattern);checks.push(name);};
const state=id=>db.query('SELECT * FROM kq_school_tournament_rooms WHERE id=$1',[id]).then(result=>result.rows[0]);
async function users(count=1){const ids=Array.from({length:count},()=>randomUUID());for(const [index,id]of ids.entries()){await db.query('INSERT INTO auth.users VALUES($1)',[id]);await db.query('INSERT INTO contest_profiles VALUES($1,$2)',[id,`Humain ${index+1}`]);}return ids;}
async function room(ids){let snapshot;for(const id of ids)snapshot=await call(id,command('join'));return snapshot.room;}
async function ready(ids,id){let snapshot;for(const owner of ids)snapshot=await call(owner,command('ready',id,{ready:true}));return snapshot;}
async function reset(){await db.exec('TRUNCATE kq_school_tournament_requests,kq_school_tournament_answers,kq_school_tournament_participants,kq_school_tournament_rooms,kq_school_tournament_players,kq_school_tournament_championship,kq_school_tournament_replays CASCADE; INSERT INTO kq_school_tournament_championship(singleton) VALUES(true);');}
async function openQuestion(id,elapsed=1000){await db.query("UPDATE kq_school_tournament_rooms SET opened_at=clock_timestamp()-($2||' milliseconds')::interval,closes_at=clock_timestamp()+interval '20 seconds' WHERE id=$1",[id,elapsed]);await db.query('UPDATE kq_school_tournament_participants SET last_seen_at=clock_timestamp() WHERE room_id=$1 AND NOT is_bot AND NOT is_replay',[id]);}
async function advance(id,viewer){await db.query("UPDATE kq_school_tournament_rooms SET next_at=clock_timestamp()-interval '1 millisecond' WHERE id=$1",[id]);return call(viewer);}
async function answerHumans(id,viewer,optionId='a'){
  await openQuestion(id);
  const current=await state(id),participants=(await db.query('SELECT user_id FROM kq_school_tournament_participants WHERE room_id=$1 AND is_active AND NOT is_replay AND NOT is_bot ORDER BY seat',[id])).rows;
  for(const {user_id:owner}of participants)await call(owner,command('answer',id,{questionId:plan.questions[current.position].question.id,optionId}));
  // Move only the automated clock. The human answers retain their server times.
  if((await state(id)).status==='question'){
    await db.query("UPDATE kq_school_tournament_rooms SET opened_at=clock_timestamp()-interval '19 seconds' WHERE id=$1",[id]);
    await call(viewer);
  }
  return call(viewer);
}
async function finishStage(id,viewer,optionId='a'){
  for(let index=0;index<3;index++){
    const result=await answerHumans(id,viewer,optionId);
    check(`stage ${result.room.stage}, answer ${index+1}: common reveal`,result.room.status,'reveal');
    await advance(id,viewer);
  }
  return call(viewer);
}
async function bootstrap(count=1){const ids=await users(count),r=await room(ids);await ready(ids,r.id);return {ids,snapshot:await call(ids[0],command('fill_opponents',r.id))};}
async function recorded(owner,{correct=true,elapsed=7000}={}){await db.query("INSERT INTO kq_school_tournament_replays(user_id,source_kind,source_id,recorded_at,performance) VALUES($1,'tournament',$2,clock_timestamp(),$3)",[owner,randomUUID(),Array.from({length:12},()=>({isCorrect:correct,elapsedMs:elapsed}))]);}

try{
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY); CREATE TABLE contest_profiles(customer_id UUID PRIMARY KEY,pseudo TEXT); CREATE TABLE wallet_sentinel(cents INTEGER); INSERT INTO wallet_sentinel VALUES(10700);');
  await db.exec(await readFile('supabase/migrations/20261114000100_kq_school_tournament.sql','utf8'));
  const existingUsers=await users(4),existingRoom=await room(existingUsers);
  await ready(existingUsers,existingRoom.id);
  await db.query("UPDATE kq_school_tournament_rooms SET opened_at=clock_timestamp()-interval '1 second' WHERE id=$1",[existingRoom.id]);
  await call(existingUsers[0],command('answer',existingRoom.id,{questionId:plan.questions[0].question.id,optionId:'a'}));
  await db.exec(await readFile('supabase/migrations/20261114000200_kq_school_tournament_bootstrap_bots.sql','utf8'));
  check('upgrade preserves an existing room and submitted answer',[(await call(existingUsers[0])).room.id,await scalar('SELECT count(*)::INTEGER FROM kq_school_tournament_answers')],[existingRoom.id,1]);
  check('upgrade registers all pre-existing human participants',await scalar('SELECT count(*)::INTEGER FROM kq_school_tournament_actors WHERE NOT is_bot'),4);
  check('migration adds only fictional registry entries without auth accounts',[await scalar('SELECT count(*)::INTEGER FROM kq_school_tournament_actors WHERE is_bot'),await scalar('SELECT count(*)::INTEGER FROM auth.users')],[3,4]);
  await reset();

  const [human]=await users(),r=await room([human]);
  await reject('completion requires explicit ready',human,command('fill_opponents',r.id),/not_ready/);
  await ready([human],r.id);
  await reject('legacy fill retains empty-library error',human,command('fill_replays',r.id),/replays_unavailable/);
  await reject('caller cannot supply bot performance',human,command('fill_opponents',r.id,{botPerformance:[]}),/invalid/);
  const fill=command('fill_opponents',r.id),started=await call(human,fill);
  check('one real player can start an empty-library tournament',[started.room.status,started.room.players.length,started.room.players.filter(p=>p.isBot).length],['question',4,3]);
  check('bots identify fictional practice identities and never online replays',started.room.players.filter(p=>p.isBot).map(p=>[p.botCode,p.displayName,p.isReplay,p.replayRecordedAt,p.connected]),[['mila','Mila',false,null,false],['gabin','Gabin',false,null,false],['iris','Iris',false,null,false]]);
  check('real human keeps existing UUID and receives explicit human identity',[started.room.players[0].userId,started.room.players[0].isBot,started.room.players[0].botCode],[human,false,null]);
  const botIds=started.room.players.filter(p=>p.isBot).map(p=>p.userId);
  check('bots cannot create auth users or human statistics',[await scalar('SELECT count(*)::INTEGER FROM auth.users WHERE id=ANY($1::uuid[])',[botIds]),await scalar('SELECT count(*)::INTEGER FROM kq_school_tournament_players WHERE user_id=ANY($1::uuid[])',[botIds])],[0,0]);
  check('future questions and automated scripts are secret',plan.questions.slice(1).some(q=>JSON.stringify(started).includes(q.question.id))||/bot_performance|performance|correctOptionId|isCorrect/.test(JSON.stringify(started)),false);
  const scriptsBefore=(await db.query('SELECT user_id,bot_performance FROM kq_school_tournament_participants WHERE room_id=$1 AND is_bot ORDER BY seat',[r.id])).rows;
  check('three full bot performances are fixed before the first question',scriptsBefore.length===3&&scriptsBefore.every(p=>p.bot_performance.length===12)&&await scalar('SELECT count(*)::INTEGER FROM kq_school_tournament_answers WHERE room_id=$1',[r.id])===0,true);
  check('practice delays vary within six to seventeen seconds',scriptsBefore.every(p=>p.bot_performance.every(a=>a.elapsedMs>=6000&&a.elapsedMs<=17000)&&new Set(p.bot_performance.map(a=>a.elapsedMs)).size>1),true);
  check('every bot level has zero to two successes',scriptsBefore.every(p=>[0,3,6,9].every(start=>p.bot_performance.slice(start,start+3).filter(a=>a.isCorrect).length<=2)),true);
  check('lost fill retry does not add seats or change plans',[(await call(human,fill)).replayed,(await db.query('SELECT user_id,bot_performance FROM kq_school_tournament_participants WHERE room_id=$1 AND is_bot ORDER BY seat',[r.id])).rows],[true,scriptsBefore]);
  await assert.rejects(()=>db.query('UPDATE kq_school_tournament_participants SET is_bot=false,bot_performance=NULL WHERE room_id=$1 AND user_id=$2',[r.id,botIds[0]]),/foreign key/);checks.push('a bot identity cannot masquerade as a human participant');
  await openQuestion(r.id);
  const answer=command('answer',r.id,{questionId:plan.questions[0].question.id,optionId:'a'}),waiting=await call(human,answer);
  check('early human answer leaves bots pending and reveals no correction',[waiting.room.status,waiting.room.reveal,waiting.room.players.filter(p=>p.isBot).every(p=>!p.answered)],['question',null,true]);
  check('human answer retry is idempotent',(await call(human,answer)).replayed,true);
  await reject('first human answer stays locked',human,command('answer',r.id,{questionId:plan.questions[0].question.id,optionId:'b'}),/answer_locked/);
  const firstScripts=scriptsBefore.map(p=>p.bot_performance[0]);
  await db.query("UPDATE kq_school_tournament_rooms SET opened_at=clock_timestamp()-interval '19 seconds' WHERE id=$1",[r.id]);
  const revealed=await call(human);
  check('correction is shared only after all scheduled answers',[revealed.room.status,revealed.room.reveal.answers.length],['reveal',4]);
  check('bot scores reproduce exactly the plan fixed before human input',revealed.room.reveal.answers.filter(a=>botIds.includes(a.userId)).map(a=>[a.isCorrect,a.elapsedMs,a.awardedPoints]),firstScripts.map(a=>[a.isCorrect,a.elapsedMs,a.isCorrect?100+Math.floor(50*(20000-a.elapsedMs)/20000):0]));
  check('human input does not adapt bot plans',(await db.query('SELECT user_id,bot_performance FROM kq_school_tournament_participants WHERE room_id=$1 AND is_bot ORDER BY seat',[r.id])).rows,scriptsBefore);

  // Finish the initial match with real server-authoritative human answers.
  await advance(r.id,human);
  for(let index=0;index<2;index++){await answerHumans(r.id,human);await advance(r.id,human);}
  check('first elimination leaves three actual contenders',(await call(human)).room.players.filter(p=>p.isActive).length,3);
  await advance(r.id,human);
  for(const remaining of [2,1]){await finishStage(r.id,human);check('normal three-question elimination leaves '+remaining,(await call(human)).room.players.filter(p=>p.isActive).length,remaining);await advance(r.id,human);}
  check('only human can challenge vacant offline title',[(await call(human)).room.stage,(await call(human)).room.winnerId],[4,human]);
  await finishStage(r.id,human);
  const completed=await advance(r.id,human);
  check('first real human can win a title without fabricated history',[completed.room.status,completed.room.reason,completed.room.titleWon,completed.champion.userId],['complete','title_won',true,human]);
  check('complete human session becomes an immediate twelve-answer replay',await scalar("SELECT count(*)::INTEGER FROM kq_school_tournament_replays WHERE user_id=$1 AND source_kind='tournament' AND source_id=$2 AND jsonb_array_length(performance)=12",[human,r.id]),1);
  const actualPerformance=(await db.query("SELECT jsonb_agg(jsonb_build_object('isCorrect',correct,'elapsedMs',elapsed_ms) ORDER BY position) AS performance FROM kq_school_tournament_answers WHERE room_id=$1 AND user_id=$2",[r.id,human])).rows[0].performance;
  check('archived replay consists only of that human actual answers',await scalar('SELECT performance FROM kq_school_tournament_replays WHERE source_id=$1 AND user_id=$2',[r.id,human]),actualPerformance);
  check('bots never receive statistics, title or replay sources',[await scalar('SELECT count(*)::INTEGER FROM kq_school_tournament_players WHERE user_id=ANY($1::uuid[])',[botIds]),await scalar('SELECT count(*)::INTEGER FROM kq_school_tournament_replays WHERE user_id=ANY($1::uuid[])',[botIds]),completed.leaderboard.length],[0,0,1]);
  await call(human);
  check('completion remains one-time',await scalar('SELECT tournaments FROM kq_school_tournament_players WHERE user_id=$1',[human]),1);
  // A current champion is excluded from replay opponents; when the title moves,
  // the stored initial performance is already usable with no synthetic answers.
  await db.query('UPDATE kq_school_tournament_championship SET user_id=NULL');
  const [newcomer]=await users(),nextRoom=await room([newcomer]);await ready([newcomer],nextRoom.id);
  const next=await call(newcomer,command('fill_opponents',nextRoom.id));
  check('next newcomer gets the first real human replay before two bots',[next.room.players.filter(p=>p.isReplay).map(p=>p.userId),next.room.players.filter(p=>p.isBot).length],[[human],2]);
  const liveAgain=await call(human,command('join'));
  check('one real identity can play live while its recording is used elsewhere',[liveAgain.room.id!==nextRoom.id,liveAgain.room.players[0].userId,liveAgain.room.players[0].isReplay,liveAgain.room.players[0].isBot],[true,human,false,false]);
  check('live rejoin never changes the other room recorded participant',(await call(newcomer)).room.players.find(p=>p.userId===human).isReplay,true);

  await reset();
  const pair=await users(2),pairRoom=await room(pair);await ready([pair[0]],pairRoom.id);
  const pending=await call(pair[0],command('fill_opponents',pairRoom.id));
  check('bots never consent on behalf of an unready human',[pending.room.status,pending.room.players.filter(p=>p.isBot).length],['lobby',2]);
  await db.query("UPDATE kq_school_tournament_participants SET last_seen_at=clock_timestamp()-interval '5 minutes' WHERE room_id=$1 AND is_bot",[pairRoom.id]);
  check('bot lobby seats do not expire through human heartbeat rules',(await call(pair[0])).room.players.length,4);
  const paired=await ready([pair[1]],pairRoom.id);
  check('two ready humans plus two bots start together',[paired.room.status,paired.room.players.filter(p=>!p.isBot&&!p.isReplay).length],['question',2]);
  const leave=command('leave',pairRoom.id),left=await call(pair[1],leave);
  check('human can leave a mixed match without phantom presence',left.room,null);
  const another=await call(pair[1],command('join'));
  check('lost leave retry preserves a new lobby',(await call(pair[1],leave)).room.id,another.room.id);
  await finishStage(pairRoom.id,pair[0]);await advance(pairRoom.id,pair[0]);
  await finishStage(pairRoom.id,pair[0]);
  const soleSurvivor=await advance(pairRoom.id,pair[0]);
  check('early sole bootstrap finalist still plays the third real level',[soleSurvivor.room.stage,soleSurvivor.room.players.filter(p=>p.isActive).length],[3,1]);
  await finishStage(pairRoom.id,pair[0]);await advance(pairRoom.id,pair[0]);
  await finishStage(pairRoom.id,pair[0]);await advance(pairRoom.id,pair[0]);
  check('departure cannot truncate a winning bootstrap session below twelve answers',await scalar('SELECT jsonb_array_length(performance) FROM kq_school_tournament_replays WHERE source_id=$1 AND user_id=$2',[pairRoom.id,pair[0]]),12);
  check('departed human is never attributed fabricated remaining answers',[await scalar('SELECT count(*)::INTEGER FROM kq_school_tournament_answers WHERE room_id=$1 AND user_id=$2',[pairRoom.id,pair[1]]),await scalar('SELECT count(*)::INTEGER FROM kq_school_tournament_replays WHERE source_id=$1 AND user_id=$2',[pairRoom.id,pair[1]])],[0,0]);

  // Compatibility: real recordings always fill first, and the legacy command
  // deliberately remains partial when fewer than three recorded profiles exist.
  await reset();
  const replayUsers=await users(3),[mixedHuman]=await users();
  await recorded(replayUsers[0]);await recorded(replayUsers[1]);
  const mixedRoom=await room([mixedHuman]);await ready([mixedHuman],mixedRoom.id);
  const legacy=await call(mixedHuman,command('fill_replays',mixedRoom.id));
  check('legacy fill retains partial lobby and creates no bots',[legacy.room.status,legacy.room.players.length,legacy.room.players.filter(p=>p.isReplay).length,legacy.room.players.some(p=>p.isBot)],['lobby',3,2,false]);
  const mixed=await call(mixedHuman,command('fill_opponents',mixedRoom.id));
  check('new fill uses two real replay profiles before its remaining bot',[mixed.room.status,mixed.room.players.filter(p=>p.isReplay).map(p=>p.userId).sort(),mixed.room.players.filter(p=>p.isBot).length],['question',replayUsers.slice(0,2).sort(),1]);
  check('replayed human profiles retain human identity fields',mixed.room.players.filter(p=>p.isReplay).every(p=>p.isBot===false&&p.botCode===null&&p.replayRecordedAt!==null&&!p.connected),true);
  await reset();
  for(const replayUser of replayUsers)await recorded(replayUser);
  const allReplayRoom=await room([mixedHuman]);await ready([mixedHuman],allReplayRoom.id);
  const allReplays=await call(mixedHuman,command('fill_opponents',allReplayRoom.id));
  check('three available replays completely replace practice bots',[allReplays.room.players.filter(p=>p.isReplay).length,allReplays.room.players.filter(p=>p.isBot).length],[3,0]);
  await finishStage(allReplayRoom.id,mixedHuman,'b');const replayWon=await advance(allReplayRoom.id,mixedHuman);
  check('replay-only opposition preserves replay_won completion',[replayWon.room.status,replayWon.room.reason,replayWon.champion],['complete','replay_won',null]);

  // Losing remains possible. Partial real performances stay in answers, with no
  // manufactured missing responses or twelve-answer replay attributed to them.
  await reset();
  const loser=await bootstrap(),loserId=loser.ids[0],loserRoom=loser.snapshot.room;
  // All wrong human answers arrive after each bot, so a bot with zero successes
  // still wins its score tie by the authoritative elapsed time.
  for(let index=0;index<3;index++){
    await openQuestion(loserRoom.id,18000);
    await call(loserId,command('answer',loserRoom.id,{questionId:plan.questions[index].question.id,optionId:'b'}));
    await advance(loserRoom.id,loserId);
  }
  const botsWon=await advance(loserRoom.id,loserId);
  check('bots can fairly eliminate the only human without taking a title',[botsWon.room.status,botsWon.room.reason,botsWon.room.titleWon,botsWon.champion],['complete','bots_won',false,null]);
  check('losing human actual partial answers and statistics are retained',[await scalar('SELECT count(*)::INTEGER FROM kq_school_tournament_answers WHERE room_id=$1 AND user_id=$2',[loserRoom.id,loserId]),await scalar('SELECT tournaments FROM kq_school_tournament_players WHERE user_id=$1',[loserId]),await scalar('SELECT count(*)::INTEGER FROM kq_school_tournament_replays WHERE user_id=$1',[loserId])],[3,1,0]);
  check('no bot is registered in a leaderboard after bots_won',botsWon.leaderboard.every(p=>!botIds.includes(p.userId)),true);

  // Upgraded and new human identities both retain the auth deletion cascade.
  await db.query('DELETE FROM auth.users WHERE id=$1',[loserId]);
  check('auth deletion cascades through actor, participant, answers and stats',[await scalar('SELECT count(*)::INTEGER FROM kq_school_tournament_actors WHERE user_id=$1',[loserId]),await scalar('SELECT count(*)::INTEGER FROM kq_school_tournament_participants WHERE user_id=$1',[loserId]),await scalar('SELECT count(*)::INTEGER FROM kq_school_tournament_answers WHERE user_id=$1',[loserId]),await scalar('SELECT count(*)::INTEGER FROM kq_school_tournament_players WHERE user_id=$1',[loserId])],[0,0,0,0]);
  await db.query('DELETE FROM auth.users WHERE id=$1',[existingUsers[0]]);
  check('pre-upgrade human actor also follows auth deletion',await scalar('SELECT count(*)::INTEGER FROM kq_school_tournament_actors WHERE user_id=$1',[existingUsers[0]]),0);
  for(const role of ['anon','authenticated','service_role']){
    for(const table of ['actors','players','rooms','participants','answers','requests','championship','replays']){
      check(`${role} cannot access private ${table}`,await scalar("SELECT has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE')",[role,'public.kq_school_tournament_'+table]),false);
    }
    check(`${role} cannot inspect bot performance generator`,await scalar("SELECT has_function_privilege($1,'public.kq_school_tournament_bot_performance(uuid,text)','EXECUTE')",[role]),false);
    check(`${role} RPC permission remains server-only`,await scalar("SELECT has_function_privilege($1,'public.rpc_kq_school_tournament(uuid,jsonb,jsonb)','EXECUTE')",[role]),role==='service_role');
  }
  check('all eight private tournament tables retain RLS',await scalar("SELECT count(*)::INTEGER FROM pg_class WHERE relname IN ('kq_school_tournament_actors','kq_school_tournament_players','kq_school_tournament_rooms','kq_school_tournament_participants','kq_school_tournament_answers','kq_school_tournament_requests','kq_school_tournament_championship','kq_school_tournament_replays') AND relrowsecurity"),8);
  check('practice competition never touches the wallet',await scalar('SELECT cents FROM wallet_sentinel'),10700);
  console.log(JSON.stringify({status:'PASS',checks:checks.length,coverage:checks},null,2));
}finally{await db.close();}
