import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const db=new PGlite(),checks=[];
const plan={contentVersion:'2026-11-14.champion1',questions:Array.from({length:12},(_,index)=>({
  question:{id:`tournament-q${String(index+1).padStart(2,'0')}`,prompt:`Question ${index+1}`,level:Math.floor(index/3)+1,
    difficulty:'medium',themeId:'plant',lessonId:'reference',sectionId:'plant',sources:[{id:'test-source',title:'Source',url:'https://example.test/source'}],
    options:['a','b','c','d'].map(id=>({id,text:`Choix ${id}`}))},answer:{correctOptionId:'a',explanation:`Correction privée ${index+1}`}}))};
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const call=(owner,command=null,bank=command?.action==='join'?plan:null)=>scalar('SELECT rpc_kq_school_tournament($1,$2,$3)',[owner,command,bank]);
const command=(action,roomId,extra={})=>({action,requestKey:randomUUID(),...(roomId?{roomId}:{}),...extra});
const check=(name,value,expected)=>{assert.deepEqual(value,expected,name);checks.push(name);};
const reject=async(name,owner,input,pattern=/school_tournament_/,bank)=>{await assert.rejects(()=>call(owner,input,bank),pattern);checks.push(name);};
async function users(count=4){const ids=Array.from({length:count},()=>randomUUID());for(const [index,id]of ids.entries()){await db.query('INSERT INTO auth.users VALUES($1)',[id]);await db.query('INSERT INTO contest_profiles VALUES($1,$2)',[id,`Participant ${index+1}`]);}return ids;}
async function room(ids){let snapshot;for(const id of ids)snapshot=await call(id,command('join'));return snapshot.room;}
async function ready(ids,id){let snapshot;for(const owner of ids)snapshot=await call(owner,command('ready',id,{ready:true}));return snapshot;}
async function openQuestion(id,elapsed=1000){await db.query("UPDATE kq_school_tournament_rooms SET opened_at=clock_timestamp()-($2||' milliseconds')::interval,closes_at=clock_timestamp()+interval '20 seconds' WHERE id=$1",[id,elapsed]);await db.query('UPDATE kq_school_tournament_participants SET last_seen_at=clock_timestamp() WHERE room_id=$1',[id]);}
async function fastForward(id){await db.query("UPDATE kq_school_tournament_rooms SET next_at=clock_timestamp()-interval '1 millisecond' WHERE id=$1",[id]);}
async function answerActive(id,options=new Map()){await openQuestion(id);const state=(await db.query('SELECT position FROM kq_school_tournament_rooms WHERE id=$1',[id])).rows[0];const players=(await db.query('SELECT user_id FROM kq_school_tournament_participants WHERE room_id=$1 AND is_active ORDER BY seat',[id])).rows;let result;for(const {user_id:owner}of players)result=await call(owner,command('answer',id,{questionId:plan.questions[state.position].question.id,optionId:options.get(owner)??'a'}));return result;}
async function finishStage(id,viewer){let snapshot;for(let i=0;i<3;i++){snapshot=await answerActive(id);check(`phase ${snapshot.room.stage} question ${i+1} reveals after all answers`,snapshot.room.status,'reveal');await fastForward(id);snapshot=await call(viewer);}return snapshot;}
async function advanceStage(id,viewer){await fastForward(id);return call(viewer);}
async function reset(){await db.exec('TRUNCATE kq_school_tournament_requests,kq_school_tournament_answers,kq_school_tournament_participants,kq_school_tournament_rooms,kq_school_tournament_players,kq_school_tournament_championship,kq_school_tournament_replays CASCADE; INSERT INTO kq_school_tournament_championship(singleton) VALUES(true);');}

try{
 await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY); CREATE TABLE contest_profiles(customer_id UUID PRIMARY KEY,pseudo TEXT); CREATE TABLE wallet_sentinel(cents INTEGER); INSERT INTO wallet_sentinel VALUES(10700);');
 await db.exec(await readFile('supabase/migrations/20261114000100_kq_school_tournament.sql','utf8'));
 await db.exec(await readFile('supabase/migrations/20261114000200_kq_school_tournament_bootstrap_bots.sql','utf8'));
 let ids=await users(5),r=await room(ids.slice(0,4));
 check('four distinct humans share exactly one lobby',r.players.length,4);
 check('pseudonyms use only public contest profiles',r.players[0].displayName,'Participant 1');
 const fifth=await call(ids[4],command('join'));
 check('a fifth join creates another room rather than a fifth seat',fifth.room.id!==r.id,true);
 check('same user cannot hold two active seats',(await call(ids[0],command('join'))).room.id,r.id);
 check('lobby contains no question or secret',[r.question,r.reveal,JSON.stringify(r).includes('correctOptionId')],[null,null,false]);
 await ready(ids.slice(0,3),r.id);check('three ready players cannot start',(await call(ids[0])).room.status,'lobby');
 let started=await call(ids[3],command('ready',r.id,{ready:true}));
 check('four explicitly ready players start together',[started.room.status,started.room.stage,started.room.questionNumber],['question',1,1]);
 const future=plan.questions.slice(1).map(q=>q.question.id);
 check('future identities and corrections stay private',future.some(id=>JSON.stringify(started).includes(id))||JSON.stringify(started).includes('correctOptionId'),false);
 await reject('forged client time or score is rejected',ids[0],command('answer',r.id,{questionId:'tournament-q01',optionId:'a',score:150}),/invalid/);
 await reject('another room cannot submit here',ids[4],command('answer',r.id,{questionId:'tournament-q01',optionId:'a'}),/room_changed/);
 await reject('future question cannot be guessed',ids[0],command('answer',r.id,{questionId:'tournament-q02',optionId:'a'}),/question_changed/);
 await reject('answer before common opening is refused',ids[0],command('answer',r.id,{questionId:'tournament-q01',optionId:'a'}),/question_changed/);
 await openQuestion(r.id,10000);
 const firstAnswer=command('answer',r.id,{questionId:'tournament-q01',optionId:'b'}),pending=await call(ids[0],firstAnswer);
 check('an early answer reveals neither correction nor result',[pending.room.status,pending.room.reveal,pending.room.ownAnswerId,pending.room.players[0].stageScore],['question',null,'b',0]);
 check('lost answer retry stays idempotent',(await call(ids[0],firstAnswer)).replayed,true);
 await reject('request key cannot be reused for another choice',ids[0],{...firstAnswer,optionId:'a'},/request_mismatch/);
 await reject('first submitted answer cannot be corrected',ids[0],command('answer',r.id,{questionId:'tournament-q01',optionId:'a'}),/answer_locked/);
 for(const owner of ids.slice(1,4))await call(owner,command('answer',r.id,{questionId:'tournament-q01',optionId:'a'}));
 const revealed=await call(ids[0]);check('common correction waits for all four submissions',revealed.room.status,'reveal');
 const timedAnswer=revealed.room.reveal.answers[1];
 check('wrong answer receives zero and server timing drives correct points',[revealed.room.reveal.answers[0].awardedPoints,timedAnswer.awardedPoints],[0,100+Math.floor(50*(20000-timedAnswer.elapsedMs)/20000)]);
 check('correct elapsed time comes from the database clock',timedAnswer.elapsedMs>=10000,true);
 check('duplicate answer under fresh key never awards twice',(await call(ids[0],command('answer',r.id,{questionId:'tournament-q01',optionId:'b'}))).room.players[0].score,0);
 await fastForward(r.id);let next=await call(ids[0]);check('reveal deadline opens the next common question',next.room.questionNumber,2);
 await db.query("UPDATE kq_school_tournament_rooms SET opened_at=clock_timestamp()-interval '21 seconds',closes_at=clock_timestamp()-interval '1 second' WHERE id=$1",[r.id]);
 const timeout=await call(ids[0]);check('timeout fixes absent answers and opens shared correction',[timeout.room.status,timeout.room.reveal.answers.length,timeout.room.reveal.answers.every(a=>a.optionId===null&&a.awardedPoints===0&&a.elapsedMs===20000)],['reveal',4,true]);
 await fastForward(r.id);await call(ids[0]);await answerActive(r.id,new Map([[ids[0],'b']]));await fastForward(r.id);const result=await call(ids[0]);
 check('first three questions eliminate exactly the weakest player',[result.room.status,result.room.players.filter(p=>p.isActive).length,result.room.eliminatedIds.includes(ids[0])],['stage_result',3,true]);
 const total=result.room.players[1].score;await fastForward(r.id);const stageTwo=await call(ids[1]);
 check('next stage resets only its score and retains the total',[stageTwo.room.stage,stageTwo.room.questionNumber,stageTwo.room.players[1].stageScore,stageTwo.room.players[1].score],[2,1,0,total]);
 await reject('eliminated spectators cannot answer',ids[0],command('answer',r.id,{questionId:'tournament-q04',optionId:'a'}),/not_active/);
 check('eliminated players can still follow',(await call(ids[0])).room.id,r.id);
 const leaveSpectator=command('leave',r.id),left=await call(ids[0],leaveSpectator);
 check('explicit leave detaches an eliminated spectator immediately',left.room,null);
 check('leaving keeps the old participant and their recorded score',await scalar('SELECT count(*)::INTEGER FROM kq_school_tournament_participants WHERE room_id=$1 AND user_id=$2 AND NOT is_active AND left_at IS NOT NULL',[r.id,ids[0]]),1);
 const rejoined=await call(ids[0],command('join'));
 check('a former spectator can join another lobby before the old tournament ends',rejoined.room.id!==r.id,true);
 check('new lobby does not reactivate the old participation',await scalar('SELECT count(*)::INTEGER FROM kq_school_tournament_participants WHERE user_id=$1 AND is_active',[ids[0]]),1);
 check('lost leave retry cannot detach the new lobby',(await call(ids[0],leaveSpectator)).room.id,rejoined.room.id);
 check('other players retain the same room and active stage',[(await call(ids[1])).room.id,(await call(ids[1])).room.stage],[r.id,2]);
 const activeOwner=ids[1],activeLeave=await call(activeOwner,command('leave',r.id));
 check('explicit leave also detaches an active player immediately',activeLeave.room,null);
 check('an active departure is fixed for the old room',await scalar('SELECT is_active FROM kq_school_tournament_participants WHERE room_id=$1 AND user_id=$2',[r.id,activeOwner]),false);

 // Full progression and one-time awards using short, manually advanced local deadlines.
 await reset();ids=await users();r=await room(ids);await ready(ids,r.id);
 for(const count of [3,2,1]){const stage=await finishStage(r.id,ids[0]);check(`elimination leaves ${count} participant(s)`,stage.room.players.filter(p=>p.isActive).length,count);await advanceStage(r.id,ids[0]);}
 let duel=await call(ids[0]);const finalist=duel.room.winnerId;
 check('finalist starts expert benchmark round with a reserved vacant title',[duel.room.stage,duel.room.status,duel.room.championTarget],[4,'question',null]);
 check('exactly one championship lease is held',await scalar('SELECT reservation_room_id FROM kq_school_tournament_championship'),r.id);
 await finishStage(r.id,finalist);const crowned=await advanceStage(r.id,finalist);
 check('present finalist establishes first champion',[crowned.room.status,crowned.room.titleWon,crowned.champion.userId,crowned.room.reason],['complete',true,finalist,'title_won']);
 check('champion benchmark uses only expert stage values',[crowned.champion.score,crowned.champion.correctCount,crowned.champion.elapsedMs],[crowned.room.players.find(p=>p.userId===finalist).stageScore,3,crowned.room.players.find(p=>p.userId===finalist).stageElapsedMs]);
 check('championship reservation is released',await scalar('SELECT reservation_room_id IS NULL FROM kq_school_tournament_championship'),true);
 const championStats=crowned.leaderboard.find(p=>p.userId===finalist);check('separate leaderboard counts title, final and completed tournament',[championStats.titles,championStats.finals,championStats.tournaments],[1,1,1]);
 await call(finalist);check('completion is counted exactly once',await scalar('SELECT tournaments FROM kq_school_tournament_players WHERE user_id=$1',[finalist]),1);
 check('best score records actual cumulative total',championStats.bestScore,crowned.room.players.find(p=>p.userId===finalist).score);

 // Set up a real phase-four state without replaying preliminary questions.
 async function contender(){const group=await users();const lobby=await room(group);await ready(group,lobby.id);await db.query("UPDATE kq_school_tournament_rooms SET status='champion_wait',stage=4,position=9,finalist_id=$2,next_at=clock_timestamp() WHERE id=$1",[lobby.id,group[0]]);await db.query('UPDATE kq_school_tournament_participants SET is_active=(user_id=$2),stage_score=0,stage_correct=0,stage_elapsed=0,stage_manual_answers=0 WHERE room_id=$1',[lobby.id,group[0]]);await db.query('UPDATE kq_school_tournament_players SET finals=finals+1 WHERE user_id=$1',[group[0]]);return {id:lobby.id,owner:group[0]};}
 const a=await contender();const target=await call(a.owner);check('offline champion is frozen when challenge starts',target.room.championTarget.userId,finalist);
 const b=await contender();const waiting=await call(b.owner);check('another finalist waits for the one title reservation',[waiting.room.status,waiting.room.championTarget],['champion_wait',null]);
 await finishStage(a.id,a.owner);
 const scoreRow=(await db.query('SELECT stage_score,stage_correct,stage_elapsed FROM kq_school_tournament_participants WHERE room_id=$1 AND user_id=$2',[a.id,a.owner])).rows[0];
 await db.query('UPDATE kq_school_tournament_championship SET score=$1,correct_count=$2,elapsed_ms=$3',[scoreRow.stage_score,scoreRow.stage_correct,scoreRow.stage_elapsed]);
 const tied=await advanceStage(a.id,a.owner);check('a perfect benchmark tie keeps current champion',[tied.room.titleWon,tied.champion.userId,tied.champion.defenses,tied.room.reason],[false,finalist,1,'champion_defended']);
 const released=await call(b.owner);check('waiting finalist claims the released title lease',released.room.status,'question');
 check('new contender sees current frozen champion',released.room.championTarget.defenses,1);
 await db.exec("UPDATE kq_school_tournament_championship SET reservation_until=clock_timestamp()-interval '1 second'");
 await db.query("UPDATE kq_school_tournament_participants SET last_seen_at=clock_timestamp()-interval '5 minutes' WHERE room_id=$1",[b.id]);
 await db.query("UPDATE kq_school_tournament_rooms SET opened_at=clock_timestamp()-interval '4 minutes',closes_at=clock_timestamp()-interval '3 minutes' WHERE id=$1",[b.id]);
 const c=await contender();const recovered=await call(c.owner);check('expired title lease catches up abandoned challenge without a cron',recovered.room.status,'question');
 check('abandoned finalist cannot take champion title',recovered.champion.userId,finalist);

 // Existing champion cannot enter a challenge against their own benchmark.
 await db.query('UPDATE kq_school_tournament_championship SET reservation_room_id=NULL,reservation_until=NULL');
 await reject('champion cannot enter and eliminate their challengers',finalist,command('join'),/already_champion/);

 const absent=await contender();await call(absent.owner);await finishStage(absent.id,absent.owner);await fastForward(absent.id);
 await db.query("UPDATE kq_school_tournament_participants SET last_seen_at=clock_timestamp()-interval '30 seconds' WHERE room_id=$1 AND user_id=$2",[absent.id,absent.owner]);
 const away=await call(absent.owner);check('late return cannot revive presence and collect a title',[away.room.reason,away.room.titleWon],['finalist_absent',false]);
 // Replay profiles come from completed source rows, never generated opponents.
 await reset();
 await db.exec('CREATE TABLE kq_school_challenge_rounds(user_id UUID,id UUID,answers JSONB,status TEXT,content_version TEXT,completed_at TIMESTAMPTZ,PRIMARY KEY(user_id,id));');
 const live=(await users(1))[0],replayUsers=await users(4);
 async function record(owner,{complete=true,correct=true,elapsed=5000,version='2026-11-13.hemp2',recorded='2026-11-13T12:00:00Z'}={}){
   const answers=Array.from({length:20},(_,position)=>({questionId:`source-q${position+1}`,isCorrect:correct,elapsedMs:elapsed,level:Math.floor(position/5)+1}));
   await db.query('INSERT INTO kq_school_challenge_rounds VALUES($1,$2,$3,$4,$5,$6)',[owner,randomUUID(),answers,complete?'complete':'question',version,complete?recorded:null]);
 }
 await record(replayUsers[0],{correct:false,recorded:'2026-11-12T12:00:00Z'});
 await record(replayUsers[0]);await record(replayUsers[1]);await record(replayUsers[2],{elapsed:30000});await record(replayUsers[3],{complete:false});await record(live);
 r=(await call(live,command('join'))).room;
 check('available replay count uses distinct completed profiles and excludes self',r.availableReplays,3);
 await reject('fill requires an explicitly ready human',live,command('fill_replays',r.id),/not_ready/);
 await call(live,command('ready',r.id,{ready:true}));
 const fill=command('fill_replays',r.id),filled=await call(live,fill);
 check('one ready human plus three recorded profiles starts the room',[filled.room.status,filled.room.players.length,filled.room.players.filter(p=>p.isReplay).length],['question',4,3]);
 check('replays identify original users and recording dates',filled.room.players.filter(p=>p.isReplay).every(p=>replayUsers.includes(p.userId)&&Date.parse(p.replayRecordedAt)===Date.parse('2026-11-13T12:00:00Z')&&!p.connected),true);
 check('recorded future timing and success never appear in snapshots',JSON.stringify(filled).includes('performance')||JSON.stringify(filled).includes('source-q'),false);
 check('repeated fill does not duplicate replay seats',(await call(live,fill)).room.players.length,4);
 check('replayed profiles are not registered as active human sessions',await scalar('SELECT count(*)::INTEGER FROM kq_school_tournament_players WHERE user_id=ANY($1::uuid[])',[replayUsers]),0);
 await openQuestion(r.id,1000);const before=await call(live,command('answer',r.id,{questionId:'tournament-q01',optionId:'b'}));
 check('replay answers wait for their actual recorded delay',before.room.players.filter(p=>p.isReplay).every(p=>!p.answered),true);
 await db.query("UPDATE kq_school_tournament_rooms SET opened_at=clock_timestamp()-interval '6 seconds' WHERE id=$1",[r.id]);
 const after=await call(live);
 check('recorded five-second answers become fixed while late replay still waits',[after.room.status,after.room.players.filter(p=>p.isReplay&&p.answered).length,after.room.reveal],['question',2,null]);
 check('newest completed source preserves recorded success and timing',await scalar('SELECT count(*)::INTEGER FROM kq_school_tournament_answers WHERE room_id=$1 AND user_id=ANY($2::uuid[]) AND correct AND elapsed_ms=5000',[r.id,replayUsers]),2);
 await db.query("UPDATE kq_school_tournament_rooms SET opened_at=clock_timestamp()-interval '21 seconds',closes_at=clock_timestamp()-interval '1 second' WHERE id=$1",[r.id]);
 const replayReveal=await call(live),late=replayReveal.room.reveal.answers.find(a=>a.userId===replayUsers[2]);
 check('source answer after twenty seconds becomes an explicit tournament timeout',[late.optionId,late.isCorrect,late.awardedPoints,late.elapsedMs],[null,false,0,20000]);
 await fastForward(r.id);await call(live);
 // The third replay times out; the human answers incorrectly but manually, so
 // exact score ties use shorter elapsed time instead of eliminating inactivity.
 for(const questionIndex of [1,2]){
   await openQuestion(r.id,1000);await call(live,command('answer',r.id,{questionId:plan.questions[questionIndex].question.id,optionId:'b'}));
   await db.query("UPDATE kq_school_tournament_rooms SET opened_at=clock_timestamp()-interval '21 seconds',closes_at=clock_timestamp()-interval '1 second' WHERE id=$1",[r.id]);
   await call(live);await fastForward(r.id);await call(live);
 }
 let replayStage=await call(live);check('replay with timed-out history can be eliminated normally',replayStage.room.eliminatedIds.includes(replayUsers[2]),true);
 await advanceStage(r.id,live);
 for(const questionIndex of [3,4,5]){
   await openQuestion(r.id,6000);await call(live,command('answer',r.id,{questionId:plan.questions[questionIndex].question.id,optionId:'b'}));
   await fastForward(r.id);await call(live);
 }
 replayStage=await call(live);check('recorded opponents can eliminate the human',replayStage.room.eliminatedIds.includes(live),true);
 const replayEnd=await advanceStage(r.id,live);
 check('replay victory never becomes a champion',[replayEnd.room.status,replayEnd.room.reason,replayEnd.room.titleWon,replayEnd.champion],['complete','replay_won',false,null]);
 check('only the human receives the completed-tournament statistic',[replayEnd.leaderboard.length,replayEnd.leaderboard[0].userId,replayEnd.leaderboard[0].tournaments],[1,live,1]);
 check('source profiles receive no new tournament, final, title or score',await scalar('SELECT count(*)::INTEGER FROM kq_school_tournament_players WHERE user_id=ANY($1::uuid[])',[replayUsers]),0);
 await reset();await db.exec('TRUNCATE kq_school_challenge_rounds');
 const fresh=(await users(1))[0],empty=(await call(fresh,command('join'))).room;await call(fresh,command('ready',empty.id,{ready:true}));
 await reject('no invented opponents when no recorded session exists',fresh,command('fill_replays',empty.id),/replays_unavailable/);
 check('missing replay history leaves the real lobby waiting',[(await call(fresh)).room.status,(await call(fresh)).room.players.length],['lobby',1]);
 await record(replayUsers[0]);
 await db.exec("UPDATE kq_school_tournament_championship SET replay_refreshed_at=clock_timestamp()-interval '31 seconds'");
 check('lobby polling eventually discovers newly recorded sessions',(await call(fresh)).room.availableReplays,1);
 const partial=await call(fresh,command('fill_replays',empty.id));
 check('insufficient recorded profiles fill only real available seats',[partial.room.status,partial.room.players.length],['lobby',2]);
 await call(fresh,command('leave',empty.id));check('a lobby containing only replays is cancelled',await scalar('SELECT status FROM kq_school_tournament_rooms WHERE id=$1',[empty.id]),'cancelled');
 check('no monetary side effects',await scalar('SELECT cents FROM wallet_sentinel'),10700);
 for(const table of ['players','rooms','participants','answers','requests','championship','replays']){
   check(table+' enables RLS',await scalar('SELECT relrowsecurity FROM pg_class WHERE oid=$1::regclass',['kq_school_tournament_'+table]),true);
   for(const role of ['anon','authenticated','service_role'])check(`${role} cannot access private ${table}`,await scalar("SELECT has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE')",[role,'kq_school_tournament_'+table]),false);
 }
 for(const role of ['anon','authenticated','service_role']){
   check(role+' named RPC permission',await scalar("SELECT has_function_privilege($1,'rpc_kq_school_tournament(uuid,jsonb,jsonb)','EXECUTE')",[role]),role==='service_role');
   for(const fn of ['kq_school_tournament_snapshot(uuid,boolean)','kq_school_tournament_tick(uuid,timestamptz)','kq_school_tournament_champion()','kq_school_tournament_refresh_replays(boolean)','kq_school_tournament_available_replays(uuid)'])check(role+' cannot invoke '+fn,await scalar("SELECT has_function_privilege($1,$2,'EXECUTE')",[role,fn]),false);
 }
 console.log(`PASS: ${checks.length} local tournament progression, secrecy, offline champion, lease recovery and permissions checks.`);
}finally{await db.close();}
