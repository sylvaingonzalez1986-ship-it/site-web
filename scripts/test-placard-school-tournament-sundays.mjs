import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const db=new PGlite(),checks=[];
const plan={contentVersion:'2026-11-14.champion1',questions:Array.from({length:12},(_,index)=>({
  question:{id:`sunday-q${String(index+1).padStart(2,'0')}`,prompt:`Question ${index+1}`,level:Math.floor(index/3)+1,
    difficulty:'medium',themeId:'plant',lessonId:'reference',sectionId:'plant',sources:[{id:'test-source',title:'Source',url:'https://example.test/source'}],
    options:['a','b','c','d'].map(id=>({id,text:`Choix ${id}`}))},answer:{correctOptionId:'a',explanation:`Correction privée ${index+1}`}}))};
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const call=(owner,command=null)=>scalar('SELECT rpc_kq_school_tournament($1,$2,$3)',[owner,command,command?.action==='join'?plan:null]);
const command=(action,roomId,extra={})=>({action,requestKey:randomUUID(),...(roomId?{roomId}:{}),...extra});
const check=(name,value,expected)=>{assert.deepEqual(value,expected,name);checks.push(name);};
const reject=async(name,owner,input,pattern=/school_tournament_/)=>{await assert.rejects(()=>call(owner,input),pattern);checks.push(name);};
const calendar=instant=>scalar('SELECT kq_school_tournament_calendar($1)',[instant]);
const setNow=instant=>db.query('UPDATE test_tournament_clock SET instant=$1,started_at=clock_timestamp()',[instant]);
const state=id=>db.query('SELECT * FROM kq_school_tournament_rooms WHERE id=$1',[id]).then(result=>result.rows[0]);
async function users(count=1){const ids=Array.from({length:count},()=>randomUUID());for(const [index,id]of ids.entries()){await db.query('INSERT INTO auth.users VALUES($1)',[id]);await db.query('INSERT INTO contest_profiles VALUES($1,$2)',[id,`Humain ${index+1}`]);}return ids;}
async function room(ids){let snapshot;for(const id of ids)snapshot=await call(id,command('join'));return snapshot;}
async function reset(){await db.exec('TRUNCATE kq_school_tournament_requests,kq_school_tournament_answers,kq_school_tournament_participants,kq_school_tournament_rooms,kq_school_tournament_players,kq_school_tournament_championship,kq_school_tournament_replays CASCADE; INSERT INTO kq_school_tournament_championship(singleton) VALUES(true);');await setNow('2026-11-15T12:00:00Z');}
async function expireFill(id){await db.query("UPDATE kq_school_tournament_rooms SET autofill_at=kq_school_tournament_now()-interval '1 millisecond' WHERE id=$1",[id]);}
async function advance(id,viewer){await db.query("UPDATE kq_school_tournament_rooms SET next_at=kq_school_tournament_now()-interval '1 millisecond' WHERE id=$1",[id]);return call(viewer);}
async function answerHumans(id,viewer,optionId='a'){
  await db.query("UPDATE kq_school_tournament_rooms SET opened_at=kq_school_tournament_now()-interval '1 second',closes_at=kq_school_tournament_now()+interval '20 seconds' WHERE id=$1",[id]);
  await db.query('UPDATE kq_school_tournament_participants SET last_seen_at=kq_school_tournament_now() WHERE room_id=$1 AND NOT is_bot AND NOT is_replay',[id]);
  const current=await state(id),humans=(await db.query('SELECT user_id FROM kq_school_tournament_participants WHERE room_id=$1 AND is_active AND NOT is_replay AND NOT is_bot ORDER BY seat',[id])).rows;
  for(const {user_id:owner}of humans)await call(owner,command('answer',id,{questionId:plan.questions[current.position].question.id,optionId}));
  if((await state(id)).status==='question'){
    await db.query("UPDATE kq_school_tournament_rooms SET opened_at=kq_school_tournament_now()-interval '19 seconds' WHERE id=$1",[id]);
    await call(viewer);
  }
  return call(viewer);
}
async function finishStage(id,viewer,optionId='a'){
  for(let index=0;index<3;index++){
    const result=await answerHumans(id,viewer,optionId);
    check(`Sunday match stage ${result.room.stage} answer ${index+1} reveals jointly`,result.room.status,'reveal');
    await advance(id,viewer);
  }
  return call(viewer);
}
async function finishMatch(id,viewer){for(let stage=0;stage<4;stage++){await finishStage(id,viewer);await advance(id,viewer);}return call(viewer);}
async function record(owner,edition,{kind='tournament',recordedAt='2026-11-15T11:00:00Z'}={}){await db.query('INSERT INTO kq_school_tournament_replays(user_id,source_kind,source_id,recorded_at,performance,edition_date) VALUES($1,$2,$3,$4,$5,$6)',[owner,kind,randomUUID(),recordedAt,Array.from({length:12},()=>({isCorrect:false,elapsedMs:9000})),edition]);}

try{
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY); CREATE TABLE contest_profiles(customer_id UUID PRIMARY KEY,pseudo TEXT); CREATE TABLE wallet_sentinel(cents INTEGER); INSERT INTO wallet_sentinel VALUES(10700);');
  for(const file of ['20261114000100_kq_school_tournament.sql','20261114000200_kq_school_tournament_bootstrap_bots.sql'])await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
  const legacyUsers=await users(4),legacy=await room(legacyUsers);
  for(const owner of legacyUsers)await call(owner,command('ready',legacy.room.id,{ready:true}));
  await db.query("UPDATE kq_school_tournament_rooms SET opened_at=clock_timestamp()-interval '1 second' WHERE id=$1",[legacy.room.id]);
  await call(legacyUsers[0],command('answer',legacy.room.id,{questionId:plan.questions[0].question.id,optionId:'a'}));
  await db.exec(await readFile('supabase/migrations/20261114000300_kq_school_tournament_sundays.sql','utf8'));
  check('production clock is exactly the database clock with no override',await scalar('SELECT abs(extract(epoch FROM kq_school_tournament_now()-clock_timestamp()))<0.1'),true);
  check('migration preserves existing started room, answer and unassigned edition',[await scalar('SELECT edition_date FROM kq_school_tournament_rooms WHERE id=$1',[legacy.room.id]),await scalar('SELECT count(*)::INTEGER FROM kq_school_tournament_answers WHERE room_id=$1',[legacy.room.id])],[null,1]);
  await db.exec("CREATE TABLE test_tournament_clock(instant TIMESTAMPTZ NOT NULL,started_at TIMESTAMPTZ NOT NULL); INSERT INTO test_tournament_clock VALUES('2026-11-15T12:00:00Z',clock_timestamp()); CREATE OR REPLACE FUNCTION public.kq_school_tournament_now() RETURNS TIMESTAMPTZ LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=public AS $$ SELECT instant+(clock_timestamp()-started_at) FROM test_tournament_clock; $$;");

  for(const [instant,isOpen,editionDate]of [
    ['2026-11-14T22:59:59.999Z',false,'2026-11-15'],
    ['2026-11-14T23:00:00Z',true,'2026-11-15'],
    ['2026-11-15T22:59:59.999Z',true,'2026-11-15'],
    ['2026-11-15T23:00:00Z',false,'2026-11-22'],
    ['2026-11-18T12:00:00Z',false,'2026-11-22'],
  ]){
    const event=await calendar(instant);
    check('Paris civil calendar at '+instant,[event.timeZone,event.isOpen,event.editionDate],['Europe/Paris',isOpen,editionDate]);
    check('calendar openness agrees with absolute bounds at '+instant,event.isOpen,Date.parse(instant)>=Date.parse(event.opensAt)&&Date.parse(instant)<Date.parse(event.closesAt));
  }
  for(const [instant,hours,opens,closes]of [
    ['2026-03-29T12:00:00Z',23,'2026-03-28T23:00:00Z','2026-03-29T22:00:00Z'],
    ['2026-10-25T12:00:00Z',25,'2026-10-24T22:00:00Z','2026-10-25T23:00:00Z'],
  ]){
    const event=await calendar(instant);
    check(`DST Sunday has ${hours} actual hours`,[event.isOpen,(Date.parse(event.closesAt)-Date.parse(event.opensAt))/3600000,Date.parse(event.opensAt),Date.parse(event.closesAt)],[true,hours,Date.parse(opens),Date.parse(closes)]);
  }
  const saturday=await calendar('2026-11-14T12:00:00Z'),sunday=await calendar('2026-11-15T12:00:00Z');
  check('next opening means upcoming Sunday while closed',Date.parse(saturday.nextOpensAt),Date.parse(saturday.opensAt));
  check('next opening moves one civil week while Sunday is open',Date.parse(sunday.nextOpensAt),Date.parse('2026-11-21T23:00:00Z'));

  // An old, already started room can still be read after admission closes.
  await setNow('2026-11-16T12:00:00Z');
  await db.query("UPDATE kq_school_tournament_rooms SET opened_at=kq_school_tournament_now()-interval '1 second',closes_at=kq_school_tournament_now()+interval '19 seconds' WHERE id=$1",[legacy.room.id]);
  await db.query('UPDATE kq_school_tournament_participants SET last_seen_at=kq_school_tournament_now() WHERE room_id=$1',[legacy.room.id]);
  const resumedLegacy=await call(legacyUsers[0],command('join'));
  check('legacy active match resumes off Sunday without assigning a false edition',[resumedLegacy.room.id,resumedLegacy.room.editionDate,resumedLegacy.room.autofillAt,resumedLegacy.event.isOpen],[legacy.room.id,null,null,false]);
  await reset();
  const [owner]=await users();
  await setNow('2026-11-14T12:00:00Z');
  const closed=await call(owner);
  check('Saturday snapshot advertises the upcoming event without fake participation',[closed.event.isOpen,closed.event.editionDate,closed.event.participated,closed.event.completed,closed.room],[false,'2026-11-15',false,false,null]);
  await reject('new admission is rejected on Saturday',owner,command('join'),/school_tournament_closed/);
  await reject('client cannot forge the server calendar',owner,command('join',undefined,{serverNow:'2026-11-15T12:00:00Z'}),/invalid/);
  await setNow('2026-11-15T12:00:00Z');
  const join=command('join'),joined=await call(owner,join),roomId=joined.room.id;
  check('Sunday entry itself consents and persists its edition',[joined.room.status,joined.room.players[0].ready,joined.room.editionDate,joined.event.participated,joined.event.completed],['lobby',true,'2026-11-15',false,false]);
  check('one fixed fifteen-second window leaves time for humans',await scalar('SELECT extract(epoch FROM autofill_at-created_at)::INTEGER FROM kq_school_tournament_rooms WHERE id=$1',[roomId]),15);
  check('join retry keeps the same immutable automatic deadline',(await call(owner,join)).room.autofillAt,joined.room.autofillAt);
  await reject('a modern lobby cannot be stalled by an obsolete not-ready command',owner,command('ready',roomId,{ready:false}),/invalid/);
  await setNow('2026-11-15T12:00:14Z');
  check('polling before the deadline keeps an authentic one-person lobby',[(await call(owner)).room.status,(await call(owner)).room.players.length],['lobby',1]);
  const [secondHuman]=await users(),secondJoin=await call(secondHuman,command('join'));
  check('another human takes an available seat without restarting the timer',[secondJoin.room.id,secondJoin.room.players.length,secondJoin.room.autofillAt],[roomId,2,joined.room.autofillAt]);
  await setNow('2026-11-15T12:00:16Z');
  const filled=await call(owner);
  check('polling alone automatically starts two humans plus two bots',[filled.room.status,filled.room.players.filter(p=>p.isBot).length,filled.room.players.filter(p=>!p.isBot&&!p.isReplay).length],['question',2,2]);
  check('actual start marks current weekly participation',[filled.event.participated,filled.event.completed], [true,false]);
  check('automatic start gives a fresh three-second common countdown',Date.parse(filled.room.openedAt)>Date.parse(filled.serverNow)+2900,true);
  check('bot scripts and future questions remain private',/bot_performance|performance|correctOptionId/.test(JSON.stringify(filled))||plan.questions.slice(1).some(q=>JSON.stringify(filled).includes(q.question.id)),false);
  await call(owner);
  check('repeated polls cannot duplicate automatic seats',await scalar('SELECT count(*)::INTEGER FROM kq_school_tournament_participants WHERE room_id=$1',[roomId]),4);

  await reset();
  const fullHumans=await users(4),allHuman=await room(fullHumans);
  check('four humans start immediately without the automatic wait',[allHuman.room.status,allHuman.room.players.length,allHuman.room.players.some(p=>p.isBot||p.isReplay)],['question',4,false]);
  for(const departing of fullHumans.slice(1))await call(departing,command('leave',allHuman.room.id));
  await finishStage(allHuman.room.id,fullHumans[0]);
  const surviving=await advance(allHuman.room.id,fullHumans[0]);
  check('sole Sunday human finalist still plays level two after other humans leave',[surviving.room.stage,surviving.room.players.filter(p=>p.isActive).length],[2,1]);
  for(let stage=1;stage<4;stage++){await finishStage(allHuman.room.id,fullHumans[0]);await advance(allHuman.room.id,fullHumans[0]);}
  check('all-human departures cannot truncate the actual Sunday finalist replay',await scalar('SELECT jsonb_array_length(performance) FROM kq_school_tournament_replays WHERE source_id=$1 AND user_id=$2',[allHuman.room.id,fullHumans[0]]),12);
  check('departing humans receive no invented answers or replay sources',[await scalar('SELECT count(*)::INTEGER FROM kq_school_tournament_answers WHERE room_id=$1 AND user_id=ANY($2::uuid[])',[allHuman.room.id,fullHumans.slice(1)]),await scalar('SELECT count(*)::INTEGER FROM kq_school_tournament_replays WHERE source_id=$1 AND user_id=ANY($2::uuid[])',[allHuman.room.id,fullHumans.slice(1)])],[0,0]);
  await reset();
  const recordingUsers=await users(5),[viewer]=await users();
  await record(recordingUsers[0],'2026-11-15');
  await record(recordingUsers[1],'2026-11-08',{recordedAt:'2026-11-15T11:30:00Z'});
  await record(recordingUsers[2],null,{kind:'solo'});
  await record(recordingUsers[3],null);
  await record(recordingUsers[4],'2026-11-15');
  const eligible=await call(viewer,command('join'));
  check('only this Sunday tournament recordings are eligible despite recent timestamps',eligible.room.availableReplays,2);
  await expireFill(eligible.room.id);
  const replayFilled=await call(viewer);
  check('automatic fill prefers current Sunday real recordings before its last bot',[replayFilled.room.players.filter(p=>p.isReplay).map(p=>p.userId).sort(),replayFilled.room.players.filter(p=>p.isBot).length],[[recordingUsers[0],recordingUsers[4]].sort(),1]);
  check('replays keep their original user identities without false presence',replayFilled.room.players.filter(p=>p.isReplay).every(p=>!p.isBot&&!p.connected&&p.botCode===null),true);

  await reset();
  const [solo]=await users(),soloLobby=await call(solo,command('join'));
  await expireFill(soloLobby.room.id);
  const soloStart=await call(solo);
  check('empty weekly history automatically supplies three marked practice bots',[soloStart.room.players.filter(p=>p.isBot).length,soloStart.room.players.filter(p=>p.isReplay).length],[3,0]);
  const won=await finishMatch(soloLobby.room.id,solo);
  check('tournament itself completes the real Sunday session',[won.room.status,won.room.titleWon,won.event.participated,won.event.completed],['complete',true,true,true]);
  check('twelve actual human performances are archived immediately with their Sunday',await scalar("SELECT count(*)::INTEGER FROM kq_school_tournament_replays WHERE source_id=$1 AND user_id=$2 AND source_kind='tournament' AND edition_date='2026-11-15' AND jsonb_array_length(performance)=12",[soloLobby.room.id,solo]),1);
  check('practice bots gain no rank or replay',[(await scalar('SELECT count(*)::INTEGER FROM kq_school_tournament_players')),await scalar('SELECT count(*)::INTEGER FROM kq_school_tournament_replays')],[1,1]);
  const champion=won.champion;
  await setNow('2026-11-22T12:00:00Z');
  const nextWeek=await call(solo);
  check('old champion and exact benchmark survive the next Sunday',[nextWeek.champion,nextWeek.event.editionDate,nextWeek.event.participated,nextWeek.event.completed],[champion,'2026-11-22',false,false]);
  await reject('incumbent champion remains exempt from challenging its own chair',solo,command('join'),/already_champion/);
  const [nextPlayer]=await users(),nextLobby=await call(nextPlayer,command('join'));
  check('previous Sunday recordings cannot populate a new edition',[nextLobby.room.editionDate,nextLobby.room.availableReplays],['2026-11-22',0]);

  // A started game crosses midnight; a waiting lobby cannot start on Monday.
  await reset();
  await setNow('2026-11-15T22:59:55Z');
  const [late]=await users(),lateLobby=await call(late,command('join'));
  await setNow('2026-11-15T23:00:01Z');
  const expired=await call(late);
  check('unfinished lobby expires at Monday midnight instead of starting bots',[expired.room.status,expired.room.reason,expired.room.players.length,expired.event.isOpen],['cancelled','event_closed',1,false]);
  check('a lobby cancelled before start is not counted as a session',await scalar('SELECT tournaments FROM kq_school_tournament_players WHERE user_id=$1',[late]),0);
  await reject('Monday cannot create a new edition',late,command('join'),/closed/);
  await reset();
  await setNow('2026-11-15T22:59:40Z');
  const [overnight]=await users(),overnightLobby=await call(overnight,command('join'));
  await setNow('2026-11-15T22:59:56Z');
  await call(overnight);
  await setNow('2026-11-15T23:00:01Z');
  const continuing=await call(overnight,command('join'));
  check('a started Sunday match can be recovered on Monday',[continuing.room.id,continuing.room.status,continuing.room.editionDate,continuing.event.isOpen],[overnightLobby.room.id,'question','2026-11-15',false]);
  const answer=command('answer',overnightLobby.room.id,{questionId:plan.questions[0].question.id,optionId:'a'});
  const answered=await call(overnight,answer);
  check('valid in-flight answer is accepted after civil admission closes',[answered.room.ownAnswerId,(await call(overnight,answer)).replayed],['a',true]);
  // Complete the remaining actual questions, including the already answered one.
  await db.query("UPDATE kq_school_tournament_rooms SET opened_at=kq_school_tournament_now()-interval '19 seconds' WHERE id=$1",[overnightLobby.room.id]);
  await call(overnight);await advance(overnightLobby.room.id,overnight);
  for(let index=0;index<2;index++){await answerHumans(overnightLobby.room.id,overnight);await advance(overnightLobby.room.id,overnight);}
  await advance(overnightLobby.room.id,overnight);
  for(let stage=1;stage<4;stage++){await finishStage(overnightLobby.room.id,overnight);await advance(overnightLobby.room.id,overnight);}
  const overnightComplete=await call(overnight);
  check('started Sunday final can finish and award the genuine title on Monday',[overnightComplete.room.status,overnightComplete.room.titleWon],['complete',true]);
  check('Monday finish keeps original Sunday source rather than inventing next-week participation',[await scalar('SELECT edition_date::TEXT FROM kq_school_tournament_replays WHERE source_id=$1 AND user_id=$2',[overnightLobby.room.id,overnight]),overnightComplete.event.editionDate,overnightComplete.event.participated],['2026-11-15','2026-11-22',false]);

  // No arbitrary one-attempt rule: a non-champion may leave and try again.
  await reset();
  const [retrying]=await users(),attempt=await call(retrying,command('join'));
  await expireFill(attempt.room.id);await call(retrying);
  const leave=command('leave',attempt.room.id);await call(retrying,leave);
  const retried=await call(retrying,command('join'));
  check('same Sunday permits another genuine attempt',[retried.room.id!==attempt.room.id,retried.room.editionDate], [true,'2026-11-15']);
  check('lost previous leave retry cannot remove the new Sunday seat',(await call(retrying,leave)).room.id,retried.room.id);
  await db.query('DELETE FROM auth.users WHERE id=$1',[retrying]);
  check('Sunday change retains human auth deletion cascade',[await scalar('SELECT count(*)::INTEGER FROM kq_school_tournament_actors WHERE user_id=$1',[retrying]),await scalar('SELECT count(*)::INTEGER FROM kq_school_tournament_participants WHERE user_id=$1',[retrying])],[0,0]);
  for(const role of ['anon','authenticated','service_role']){
    for(const signature of ['kq_school_tournament_now()','kq_school_tournament_calendar(timestamptz)','kq_school_tournament_event(uuid,timestamptz)','kq_school_tournament_fill(uuid,timestamptz,boolean)'])check(`${role} cannot invoke private ${signature}`,await scalar("SELECT has_function_privilege($1,$2,'EXECUTE')",[role,'public.'+signature]),false);
    for(const table of ['actors','players','rooms','participants','answers','requests','championship','replays'])check(`${role} has no direct ${table} Data API access`,await scalar("SELECT has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE')",[role,'public.kq_school_tournament_'+table]),false);
    check(`${role} keeps existing server-only RPC access`,await scalar("SELECT has_function_privilege($1,'public.rpc_kq_school_tournament(uuid,jsonb,jsonb)','EXECUTE')",[role]),role==='service_role');
  }
  check('Sunday competition still never mutates wallet',await scalar('SELECT cents FROM wallet_sentinel'),10700);
  console.log(JSON.stringify({status:'PASS',checks:checks.length,coverage:checks},null,2));
}finally{await db.close();}
