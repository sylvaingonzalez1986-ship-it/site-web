import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const db=new PGlite(),checks=[];
const plan={contentVersion:'2026-11-14.champion1',questions:Array.from({length:12},(_,index)=>({question:{id:`weekly-q${String(index+1).padStart(2,'0')}`,prompt:`Question ${index+1}`,level:Math.floor(index/3)+1,difficulty:'medium',themeId:'plant',lessonId:'reference',sectionId:'plant',sources:[{id:'test-source',title:'Source',url:'https://example.test/source'}],options:['a','b','c','d'].map(id=>({id,text:`Choix ${id}`}))},answer:{correctOptionId:'a',explanation:`Correction privée ${index+1}`}}))};
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const call=(owner,command=null)=>scalar('SELECT rpc_kq_school_tournament($1,$2,$3)',[owner,command,command?.action==='join'?plan:null]);
const command=(action,roomId,extra={})=>({action,requestKey:randomUUID(),...(roomId?{roomId}:{}),...extra});
const check=(name,value,expected)=>{assert.deepEqual(value,expected,name);checks.push(name);};
const reject=async(name,owner,input,pattern=/school_tournament_/)=>{await assert.rejects(()=>call(owner,input),pattern);checks.push(name);};
const setNow=instant=>db.query('UPDATE test_tournament_clock SET instant=$1',[instant]);
const state=id=>db.query('SELECT * FROM kq_school_tournament_rooms WHERE id=$1',[id]).then(result=>result.rows[0]);
const worker=()=>db.exec('SELECT rpc_kq_school_tournament_settle_weekly();');
async function users(count=1){const ids=Array.from({length:count},()=>randomUUID());for(const [index,id]of ids.entries()){await db.query('INSERT INTO auth.users VALUES($1)',[id]);await db.query('INSERT INTO contest_profiles VALUES($1,$2)',[id,`Humain ${index+1}`]);}return ids;}
async function start(owner){const joined=await call(owner,command('join'));await db.query("UPDATE kq_school_tournament_rooms SET autofill_at=kq_school_tournament_now()-interval '1 millisecond' WHERE id=$1",[joined.room.id]);return call(owner);}
async function advance(id,owner){await db.query("UPDATE kq_school_tournament_rooms SET next_at=kq_school_tournament_now()-interval '1 millisecond' WHERE id=$1",[id]);return call(owner);}
async function answer(id,owner,{elapsed=1000,option='a'}={}){
  const current=await state(id);
  await db.query("UPDATE kq_school_tournament_rooms SET opened_at=kq_school_tournament_now()-($2 * interval '1 millisecond'),closes_at=kq_school_tournament_now()+interval '20 seconds' WHERE id=$1",[id,elapsed]);
  const result=await call(owner,command('answer',id,{questionId:plan.questions[current.position].question.id,optionId:option}));
  if(result.room.status==='question')await db.query("UPDATE kq_school_tournament_rooms SET opened_at=kq_school_tournament_now()-interval '19 seconds' WHERE id=$1",[id]);
  return call(owner);
}
async function fullMatch(owner){const started=await start(owner),id=started.room.id;for(let stage=0;stage<4;stage++){for(let question=0;question<3;question++){const value=await answer(id,owner);check(`real match ${stage+1}/${question+1} reveals jointly`,value.room.status,'reveal');await advance(id,owner);}await advance(id,owner);}return call(owner);}
// Focused final-stage fixture; each ranked response still runs the real RPC,
// scoring, arrival-time checks and weekly recorder. No candidate is fabricated.
async function finalist(owner){const started=await start(owner),id=started.room.id;await db.query("UPDATE kq_school_tournament_rooms SET status='champion_wait',stage=4,position=9,finalist_id=$2,next_at=kq_school_tournament_now() WHERE id=$1",[id,owner]);await db.query('UPDATE kq_school_tournament_participants SET is_active=(user_id=$2),stage_score=0,stage_correct=0,stage_elapsed=0,stage_manual_answers=0 WHERE room_id=$1',[id,owner]);return call(owner);}
async function finalSession(owner,{elapsed=[1000,1000,1000],options=['a','a','a']}={}){const entered=await finalist(owner),id=entered.room.id;let final;for(let position=0;position<3;position++){final=await answer(id,owner,{elapsed:elapsed[position],option:options[position]});if(position<2)await advance(id,owner);}await advance(id,owner);await advance(id,owner);return {final,complete:await call(owner),id};}
async function calendar(instant){return scalar('SELECT kq_school_tournament_calendar($1)',[instant]);}

try{
  await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY); CREATE TABLE contest_profiles(customer_id UUID PRIMARY KEY,pseudo TEXT); CREATE TABLE wallet_sentinel(cents INTEGER); INSERT INTO wallet_sentinel VALUES(10700); CREATE SCHEMA cron; CREATE TABLE cron.job(jobname TEXT PRIMARY KEY,schedule TEXT,command TEXT); CREATE FUNCTION cron.schedule(p_jobname TEXT,p_schedule TEXT,p_command TEXT) RETURNS BIGINT LANGUAGE sql AS $$ INSERT INTO cron.job VALUES(p_jobname,p_schedule,p_command) ON CONFLICT(jobname) DO UPDATE SET schedule=EXCLUDED.schedule,command=EXCLUDED.command RETURNING 1::BIGINT; $$;");
  for(const file of ['20261114000100_kq_school_tournament.sql','20261114000200_kq_school_tournament_bootstrap_bots.sql','20261114000300_kq_school_tournament_sundays.sql'])await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
  await db.exec("CREATE TABLE test_tournament_clock(instant TIMESTAMPTZ NOT NULL); INSERT INTO test_tournament_clock VALUES('2026-11-11T12:00:00Z'); CREATE OR REPLACE FUNCTION kq_school_tournament_now() RETURNS TIMESTAMPTZ LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=public AS $$ SELECT instant FROM test_tournament_clock; $$;");
  const [incumbent]=await users();
  await db.query('INSERT INTO kq_school_tournament_players(user_id,titles) VALUES($1,1)',[incumbent]);
  await db.query("UPDATE kq_school_tournament_championship SET user_id=$1,score=390,correct_count=3,elapsed_ms=24000,since='2026-11-08T23:00:00Z',defenses=2,version=7",[incumbent]);
  const migration=(await readFile('supabase/migrations/20261114000400_kq_school_tournament_weekly_champion.sql','utf8')).replace('CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;','-- pg_cron stubbed only in this isolated PGlite database.');
  await db.exec(migration);
  const baseline=(await call(incumbent)).champion;
  check('migration preserves incumbent and benchmark',[baseline.userId,baseline.score,baseline.correctCount,baseline.elapsedMs,baseline.defenses],[incumbent,390,3,24000,2]);
  check('one named PostgreSQL job handles both Paris UTC offsets',(await db.query('SELECT * FROM cron.job')).rows,[{jobname:'kq-school-tournament-weekly-champion',schedule:'0 22,23 * * 0',command:'SELECT public.rpc_kq_school_tournament_settle_weekly();'}]);
  for(const [instant,edition]of [['2026-11-09T00:00:00Z','2026-11-15'],['2026-11-11T12:00:00Z','2026-11-15'],['2026-11-14T12:00:00Z','2026-11-15'],['2026-11-15T22:59:59.999Z','2026-11-15'],['2026-11-15T23:00:00Z','2026-11-22']]){
    const event=await calendar(instant);
    check('weekly Paris edition at '+instant,[event.isOpen,event.editionDate,event.awardAt===event.closesAt],[true,edition,true]);
    check('server time always lies in its open civil week at '+instant,Date.parse(instant)>=Date.parse(event.opensAt)&&Date.parse(instant)<Date.parse(event.closesAt),true);
  }
  for(const [instant,hours,close]of [['2026-03-29T12:00:00Z',167,'2026-03-29T22:00:00Z'],['2026-10-25T12:00:00Z',169,'2026-10-25T23:00:00Z']]){
    const event=await calendar(instant);check('DST civil week lasts '+hours+' hours',[(Date.parse(event.closesAt)-Date.parse(event.opensAt))/3600000,Date.parse(event.awardAt)],[hours,Date.parse(close)]);
  }
  await reject('incumbent does not challenge its own recorded chair',incumbent,command('join'),/already_champion/);
  const [first]=await users(),completed=await fullMatch(first);
  check('Wednesday tournament is open and finishes as a weekly result',[completed.event.isOpen,completed.room.status,completed.room.reason,completed.room.titleWon], [true,'complete','weekly_recorded',false]);
  check('stronger final does not change the champion during the week',completed.champion,baseline);
  check('final records actual expert values independently of cumulative score',[completed.weeklyLeaderboard[0].score,completed.weeklyLeaderboard[0].correctCount,completed.weeklyLeaderboard[0].elapsedMs,completed.weeklyLeaderboard[0].userId],[441,3,3000,first]);
  check('result and full real replay retain the proper weekly edition',[completed.room.resultEditionDate,await scalar('SELECT edition_date::TEXT FROM kq_school_tournament_replays WHERE source_id=$1',[completed.room.id])],['2026-11-15','2026-11-15']);
  check('final attempt awards no immediate title or reservation',[await scalar('SELECT titles FROM kq_school_tournament_players WHERE user_id=$1',[first]),await scalar('SELECT reservation_room_id FROM kq_school_tournament_championship')],[0,null]);
  check('bots never enter weekly ranking',(await db.query('SELECT user_id FROM kq_school_tournament_weekly_results')).rows,[{user_id:first}]);
  await setNow('2026-11-12T12:00:00Z');
  const weaker=await finalSession(first,{elapsed:[12000,12000,12000]});
  check('each genuine session is saved but only the best per player is ranked',[await scalar('SELECT count(*)::INTEGER FROM kq_school_tournament_weekly_results WHERE user_id=$1',[first]),weaker.complete.weeklyLeaderboard.filter(row=>row.userId===first).length,weaker.complete.weeklyLeaderboard.find(row=>row.userId===first).score],[2,1,441]);
  check('result exists before its last reveal and result-screen polling',[weaker.final.room.status,weaker.final.room.resultEditionDate,weaker.final.event.completed],['reveal','2026-11-15',true]);
  const [tie,laterFast]=await users(2);
  const tieResult=await finalSession(tie);
  check('identical scores and timing retain earliest actual completion',tieResult.complete.weeklyLeaderboard.slice(0,2).map(row=>row.userId),[first,tie]);
  await setNow('2026-11-13T12:00:00Z');
  const fastest=await finalSession(laterFast,{elapsed:[900,900,900]});
  check('same scored points use actual faster timing before completion date',[fastest.complete.weeklyLeaderboard[0].userId,fastest.complete.weeklyLeaderboard[0].score,fastest.complete.weeklyLeaderboard[0].elapsedMs],[laterFast,441,2700]);
  const [twoCorrect,threeCorrect]=await users(2);
  await finalSession(twoCorrect,{elapsed:[0,0,0],options:['a','a','b']});
  const accuracy=await finalSession(threeCorrect,{elapsed:[19999,19999,19999]});
  const accuracyRows=accuracy.complete.weeklyLeaderboard.filter(row=>[twoCorrect,threeCorrect].includes(row.userId));
  check('correct count remains the documented secondary score tiebreaker',accuracyRows.map(row=>[row.userId,row.score,row.correctCount]),[[threeCorrect,300,3],[twoCorrect,300,2]]);
  await setNow('2026-11-15T22:00:00Z');await worker();
  check('winter earlier UTC invocation cannot award before Paris midnight',(await call(first)).champion,baseline);
  check('pending edition remains unclosed before its actual deadline',await scalar("SELECT settled_at IS NULL FROM kq_school_tournament_weekly_editions WHERE edition_date='2026-11-15'"),true);
  await setNow('2026-11-15T23:00:00Z');
  const formerChampion=await call(incumbent,command('join'));
  check('direct join reconciles a missed ceremony before blocking the former champion',[formerChampion.champion.userId,formerChampion.room.status],[laterFast,'lobby']);
  await call(incumbent,command('leave',formerChampion.room.id));
  await worker();
  const crowned=await call(first);
  check('Sunday midnight publishes the strongest eligible human final',[crowned.champion.userId,crowned.champion.score,crowned.champion.correctCount,crowned.champion.elapsedMs],[laterFast,441,3,2700]);
  check('weekly title timestamp is the actual boundary',Date.parse(crowned.champion.since),Date.parse('2026-11-15T23:00:00Z'));
  check('edition settlement is durably recorded once',await scalar("SELECT title_changed AND champion_before=$1 AND champion_after=$2 FROM kq_school_tournament_weekly_editions WHERE edition_date='2026-11-15'",[incumbent,laterFast]),true);
  await worker();await call(first);
  check('duplicate scheduler and RPC reconciliation cannot award twice',[await scalar('SELECT titles FROM kq_school_tournament_players WHERE user_id=$1',[laterFast]),(await call(first)).champion.defenses],[1,0]);
  check('new week starts with an empty weekly ranking',crowned.weeklyLeaderboard,[]);
  const oldReplayRoom=await call(first,command('join'));
  check('past-week replays are excluded even though their real histories remain',oldReplayRoom.room.availableReplays,0);
  await call(first,command('leave',oldReplayRoom.room.id));
  const tiedNext=await finalSession(tie,{elapsed:[900,900,900]});
  check('new-week challenger still does not take a title immediately',tiedNext.complete.champion.userId,laterFast);
  await setNow('2026-11-22T23:00:00Z');await worker();
  const defended=await call(first);
  check('perfect equality retains incumbent and counts one weekly defense',[defended.champion.userId,defended.champion.defenses,await scalar('SELECT titles FROM kq_school_tournament_players WHERE user_id=$1',[tie])],[laterFast,1,0]);
  await worker();check('repeated defense settlement is idempotent',(await call(first)).champion.defenses,1);
  await setNow('2026-11-29T23:00:00Z');await worker();
  check('empty week neither replaces champion nor invents a defense',[(await call(first)).champion.userId,(await call(first)).champion.defenses],[laterFast,1]);

  // Crossing cutoff dates is determined by the server's final answer, never by
  // the room's start week or a later screen refresh.
  await setNow('2026-12-06T22:59:30Z');
  const [crossing]=await users(),crossingRoom=(await finalist(crossing)).room.id;
  await answer(crossingRoom,crossing);await advance(crossingRoom,crossing);
  await answer(crossingRoom,crossing);await advance(crossingRoom,crossing);
  await setNow('2026-12-06T23:00:00Z');
  const crossed=await answer(crossingRoom,crossing);
  check('a final answer at exclusive midnight belongs to the next week',[crossed.room.editionDate,crossed.room.resultEditionDate,crossed.event.editionDate,crossed.event.completed],['2026-12-06','2026-12-13','2026-12-13',true]);
  const recordedAt=await scalar('SELECT completed_at FROM kq_school_tournament_weekly_results WHERE room_id=$1',[crossingRoom]);
  check('completed timestamp is the third actual server answer',new Date(recordedAt).toISOString(),'2026-12-06T23:00:00.000Z');
  await advance(crossingRoom,crossing);await advance(crossingRoom,crossing);
  await setNow('2026-12-07T12:00:00Z');await call(crossing);
  check('late result polling cannot move a recorded performance',new Date(await scalar('SELECT completed_at FROM kq_school_tournament_weekly_results WHERE room_id=$1',[crossingRoom])).toISOString(),'2026-12-06T23:00:00.000Z');

  // A due final timeout is recorded before settlement, provided the real player
  // submitted actual final answers and was present near the authoritative end.
  await setNow('2026-12-13T22:59:30Z');
  const [catchup,absent]=await users(2),catchRoom=(await finalist(catchup)).room.id;
  await answer(catchRoom,catchup);await advance(catchRoom,catchup);
  await answer(catchRoom,catchup);await advance(catchRoom,catchup);
  await db.query("UPDATE kq_school_tournament_rooms SET opened_at='2026-12-13T22:59:35Z',closes_at='2026-12-13T22:59:55Z' WHERE id=$1",[catchRoom]);
  await setNow('2026-12-13T22:59:50Z');await call(catchup);
  const absentRoom=(await finalist(absent)).room.id;
  await db.query("UPDATE kq_school_tournament_rooms SET opened_at='2026-12-13T22:58:30Z',closes_at='2026-12-13T22:58:50Z' WHERE id=$1",[absentRoom]);
  await db.query("UPDATE kq_school_tournament_participants SET last_seen_at='2026-12-13T22:58:00Z' WHERE room_id=$1 AND user_id=$2",[absentRoom,absent]);
  await setNow('2026-12-13T23:00:05Z');await worker();
  check('worker catches pre-cutoff final timeout before closing its edition',[await scalar('SELECT edition_date::TEXT FROM kq_school_tournament_weekly_results WHERE room_id=$1',[catchRoom]),new Date(await scalar('SELECT completed_at FROM kq_school_tournament_weekly_results WHERE room_id=$1',[catchRoom])).toISOString()],['2026-12-13','2026-12-13T22:59:55.000Z']);
  check('all-timeout absent finalist contributes no invented result',await scalar('SELECT count(*)::INTEGER FROM kq_school_tournament_weekly_results WHERE room_id=$1',[absentRoom]),0);

  // Missed scheduler invocation recovers from an ordinary authenticated read.
  await setNow('2026-12-14T12:00:00Z');
  const [recoveryWinner]=await users(),recovery=await finalSession(recoveryWinner,{elapsed:[0,0,0]});
  check('even maximum real final score waits for the weekly ceremony',[recovery.complete.weeklyLeaderboard[0].score,recovery.complete.champion.userId],[450,laterFast]);
  await setNow('2026-12-21T09:00:00Z');
  const recovered=await call(first);
  check('ordinary RPC catches a missed weekly job without losing its due winner',[recovered.champion.userId,recovered.champion.score,new Date(recovered.champion.since).toISOString()],[recoveryWinner,450,'2026-12-20T23:00:00.000Z']);
  check('scheduler no-op after RPC cannot duplicate recovery title',await scalar('SELECT titles FROM kq_school_tournament_players WHERE user_id=$1',[recoveryWinner]),1);
  await worker();check('recovered title remains single after scheduler retry',await scalar('SELECT titles FROM kq_school_tournament_players WHERE user_id=$1',[recoveryWinner]),1);
  await reject('no client admin or clock bypass was introduced',first,command('join_test'),/invalid/);
  for(const role of ['anon','authenticated','service_role']){
    for(const table of ['weekly_results','weekly_editions'])check(`${role} cannot directly access ${table}`,await scalar("SELECT has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE')",[role,'public.kq_school_tournament_'+table]),false);
    for(const signature of ['kq_school_tournament_record_weekly(uuid)','kq_school_tournament_ensure_edition(timestamptz)','kq_school_tournament_settle_weekly(timestamptz)','kq_school_tournament_weekly_leaderboard(timestamptz)','rpc_kq_school_tournament_settle_weekly()'])check(`${role} cannot invoke ${signature}`,await scalar("SELECT has_function_privilege($1,$2,'EXECUTE')",[role,'public.'+signature]),false);
    check(`${role} retains correct public gameplay RPC access`,await scalar("SELECT has_function_privilege($1,'public.rpc_kq_school_tournament(uuid,jsonb,jsonb)','EXECUTE')",[role]),role==='service_role');
  }
  await db.query('DELETE FROM auth.users WHERE id=$1',[recoveryWinner]);
  check('auth deletion removes weekly personal results and clears champion',[await scalar('SELECT count(*)::INTEGER FROM kq_school_tournament_weekly_results WHERE user_id=$1',[recoveryWinner]),await scalar('SELECT user_id FROM kq_school_tournament_championship')],[0,null]);
  check('both weekly tables enforce RLS',await scalar("SELECT count(*)::INTEGER FROM pg_class WHERE relname IN ('kq_school_tournament_weekly_results','kq_school_tournament_weekly_editions') AND relrowsecurity"),2);
  check('weekly championship never modifies wallet',await scalar('SELECT cents FROM wallet_sentinel'),10700);
  console.log(JSON.stringify({status:'PASS',checks:checks.length,coverage:checks},null,2));
}finally{await db.close();}
