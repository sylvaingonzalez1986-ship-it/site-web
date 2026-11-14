// Real PostgreSQL, isolated cached container; no network, port or host mount.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {authorModule} from './audit-school-scenarios.mjs';
const docker='C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe';
const base=['--config','C:\\lesiteinternetquitue\\output\\school-sql\\docker-config','--host','npipe:////./pipe/docker_engine'];
const container='kq-school-tournament-test-'+randomUUID().slice(0,8),checks=[];
const image='public.ecr.aws/supabase/postgres:17.6.1.075';
let started=false;
assert.equal(process.argv.length,2,'Isolated test takes no arguments');
const run=(args,input='')=>new Promise((resolve,reject)=>{
 const child=spawn(docker,[...base,...args],{windowsHide:true,stdio:['pipe','pipe','pipe']});let output='',error='';
 child.stdout.on('data',part=>output+=part);child.stderr.on('data',part=>error+=part);child.on('error',reject);
 child.on('close',code=>code===0?resolve(output.trim()):reject(new Error(error.trim()||'docker exit '+code)));child.stdin.end(input);
});
const sql=text=>run(['exec','-i',container,'psql','-X','-h','/tmp','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-qAt'],text);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const literal=value=>"'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb";
const {createKqSchoolTournamentPlan}=await authorModule('kanab-quest-school-tournament-server.ts');
const plan=createKqSchoolTournamentPlan('real-postgres-tournament');
const call=(owner,command=null)=>`SELECT rpc_kq_school_tournament('${owner}',${command?literal(command):'NULL::jsonb'},${command?.action==='join'?literal(plan):'NULL::jsonb'});`;
const command=(action,extra={})=>({action,requestKey:randomUUID(),...extra});
const check=(name,actual,expected)=>{assert.deepEqual(actual,expected,name);checks.push(name);};
const result=async(owner,action)=>JSON.parse(await sql(call(owner,action)));
async function racing(name,leftSql,rightSql,rightErrorPattern=null){
 const tag=randomUUID(),outcome=text=>sql(text).then(value=>({value:JSON.parse(value)}),error=>({error}));
 const left=outcome(`SET application_name='tour-left-${tag}'; SET school.test_pause='hold'; ${leftSql}`);
 let holding=false;
 for(let n=0;n<40;n++){holding=await sql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='tour-left-${tag}' AND wait_event='PgSleep');`)==='t';if(holding)break;await wait(25);}
 assert(holding,name+': first transaction must be held');
 const right=outcome(`SET application_name='tour-right-${tag}'; ${rightSql}`);let blocked=false;
 for(let n=0;n<20;n++){blocked=await sql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='tour-right-${tag}' AND wait_event_type='Lock');`)==='t';if(blocked)break;await wait(25);}
 const [a,b]=await Promise.all([left,right]);check(name+': second independent connection waits on lock',blocked,true);
 if(a.error)throw a.error;
 if(b.error){if(!rightErrorPattern)throw b.error;assert.match(b.error.message,rightErrorPattern);return[a.value,b];}
 return[a.value,b.value];
}
try{
 await run(['run','--detach','--rm','--pull=never','--name',container,'--network','none','--read-only','--user','postgres','--tmpfs','/tmp:rw,mode=1777','--entrypoint','/bin/sh',image,'-c',"/usr/bin/initdb -D /tmp/tournament-db --auth=trust --encoding=UTF8 --no-locale >/tmp/tournament-init.log && exec /usr/bin/postgres -D /tmp/tournament-db -c listen_addresses='' -c unix_socket_directories=/tmp"]);started=true;
 let ready=false;for(let i=0;i<50;i++){try{await sql('SELECT 1;');ready=true;break;}catch{await wait(100);}}assert(ready);
 await sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY); CREATE TABLE contest_profiles(customer_id UUID PRIMARY KEY,pseudo TEXT); ${await readFile('supabase/migrations/20261112001100_kq_school_challenge.sql','utf8')} ${await readFile('supabase/migrations/20261114000100_kq_school_tournament.sql','utf8')} ${await readFile('supabase/migrations/20261114000200_kq_school_tournament_bootstrap_bots.sql','utf8')} ${await readFile('supabase/migrations/20261114000300_kq_school_tournament_sundays.sql','utf8')}
CREATE SCHEMA cron; CREATE TABLE cron.job(jobid BIGSERIAL PRIMARY KEY,jobname TEXT UNIQUE,schedule TEXT,command TEXT,active BOOLEAN DEFAULT true,username TEXT DEFAULT 'postgres'); CREATE FUNCTION cron.schedule(p_name TEXT,p_schedule TEXT,p_command TEXT) RETURNS BIGINT LANGUAGE plpgsql AS $$ DECLARE result BIGINT; BEGIN INSERT INTO cron.job(jobname,schedule,command) VALUES(p_name,p_schedule,p_command) ON CONFLICT(jobname) DO UPDATE SET schedule=EXCLUDED.schedule,command=EXCLUDED.command RETURNING jobid INTO result; RETURN result; END $$;
${await readFile('supabase/migrations/20261114000400_kq_school_tournament_weekly_champion.sql','utf8').then(text=>text.replace('CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;',''))}
 CREATE TABLE test_clock_anchor AS SELECT clock_timestamp() actual;
 CREATE OR REPLACE FUNCTION public.kq_school_tournament_now() RETURNS TIMESTAMPTZ LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=public AS $$ SELECT '2026-11-15T12:00:00Z'::timestamptz+(clock_timestamp()-actual) FROM test_clock_anchor $$;
 CREATE FUNCTION test_tournament_hold() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN IF current_setting('school.test_pause',true)='hold' THEN PERFORM set_config('school.test_pause','done',true); PERFORM pg_sleep(3); END IF; RETURN NEW; END $$;
 CREATE TRIGGER test_tournament_join_hold BEFORE INSERT ON kq_school_tournament_participants FOR EACH ROW EXECUTE FUNCTION test_tournament_hold();
 CREATE TRIGGER test_tournament_answer_hold BEFORE INSERT ON kq_school_tournament_answers FOR EACH ROW EXECUTE FUNCTION test_tournament_hold();
 CREATE TRIGGER test_tournament_crown_hold BEFORE UPDATE ON kq_school_tournament_championship FOR EACH ROW EXECUTE FUNCTION test_tournament_hold();`);
 const users=Array.from({length:8},()=>randomUUID());
 for(const [i,user] of users.entries())await sql(`INSERT INTO auth.users VALUES('${user}'); INSERT INTO contest_profiles VALUES('${user}','Joueur ${i+1}');`);
 const first=await result(users[0],command('join')),room=first.room.id;
 await result(users[1],command('join'));await result(users[2],command('join'));
 let [a,b]=await racing('fourth and fifth entrants',call(users[3],command('join')),call(users[4],command('join')));
 check('fourth entrant completes first room',[a.room.id,a.room.players.length],[room,4]);
 assert.notEqual(b.room.id,room);check('fifth entrant gets another room',b.room.players.length,1);const otherRoom=b.room.id;
 check('no room contains five seats',await sql('SELECT max(n) FROM (SELECT count(*) n FROM kq_school_tournament_participants GROUP BY room_id) x;'),'4');
 for(const user of users.slice(5))await result(user,command('join'));

 await sql(`UPDATE kq_school_tournament_rooms SET opened_at=public.kq_school_tournament_now()-interval '1 second',closes_at=public.kq_school_tournament_now()+interval '20 seconds' WHERE id='${room}';`);
 const q=plan.questions[0],answer=command('answer',{roomId:room,questionId:q.question.id,optionId:q.answer.correctOptionId});
 [a,b]=await racing('duplicate answer',call(users[0],answer),call(users[0],answer));
 check('answer is persisted once',await sql(`SELECT count(*) FROM kq_school_tournament_answers WHERE room_id='${room}' AND user_id='${users[0]}';`),'1');
 check('replayed answer recognized',b.replayed,true);check('no premature correction',a.room.reveal,null);
 check('scores stay hidden until joint reveal',a.room.players.map(p=>p.stageScore),[0,0,0,0]);
 // The second answer arrives before expiry, but waits behind a three-second lock.
 await sql(`UPDATE kq_school_tournament_rooms SET closes_at=public.kq_school_tournament_now()+interval '2 seconds' WHERE id='${room}';`);
 const answering=user=>call(user,command('answer',{roomId:room,questionId:q.question.id,optionId:q.answer.correctOptionId}));
 await racing('arrival before deadline despite lock wait',answering(users[1]),answering(users[2]));
 check('valid queued answer is not converted into timeout',await sql(`SELECT option_id FROM kq_school_tournament_answers WHERE room_id='${room}' AND user_id='${users[2]}' AND position=0;`),q.answer.correctOptionId);
 // Concurrent polling at the auto-fill deadline must open one four-seat game.
 const fillingUsers=[randomUUID(),randomUUID()];
 for(const [index,user]of fillingUsers.entries())await sql(`INSERT INTO auth.users VALUES('${user}'); INSERT INTO contest_profiles VALUES('${user}','Dimanche ${index+1}');`);
 const fillLobby=(await result(fillingUsers[0],command('join'))).room.id;
 await result(fillingUsers[1],command('join'));
 await sql(`UPDATE kq_school_tournament_rooms SET autofill_at=public.kq_school_tournament_now()-interval '1 second' WHERE id='${fillLobby}';`);
 [a,b]=await racing('simultaneous automatic fills',call(fillingUsers[0]),call(fillingUsers[1]));
 check('first automatic completion starts two humans and two bots',[a.room.status,a.room.players.filter(p=>p.isBot).length,a.room.players.length],['question',2,4]);
 check('second poll recovers the same started room',[b.room.id,b.room.status,b.room.players.length],[fillLobby,'question',4]);
 check('both real seats preserved',b.room.players.filter(p=>!p.isBot&&!p.isReplay).map(p=>p.userId).sort(),[...fillingUsers].sort());
 check('no duplicate seat or participant',[new Set(b.room.players.map(p=>p.userId)).size,new Set(b.room.players.map(p=>p.seat)).size],[4,4]);
 check('both humans still own one room',await sql(`SELECT count(*) FROM kq_school_tournament_players WHERE user_id IN ('${fillingUsers[0]}','${fillingUsers[1]}') AND room_id='${fillLobby}';`),'2');
 // Stage fixture only; admission, final answer, recording and settlement are real SQL.
 await sql(`UPDATE kq_school_tournament_participants SET is_active=(user_id='${users[0]}'),last_seen_at=public.kq_school_tournament_now(),stage_score=280,stage_correct=2,stage_elapsed=8000,stage_manual_answers=2 WHERE room_id='${room}';
 UPDATE kq_school_tournament_rooms SET status='question',stage=4,position=11,finalist_id='${users[0]}',opened_at=public.kq_school_tournament_now()-interval '1 second',closes_at=public.kq_school_tournament_now()+interval '20 seconds' WHERE id='${room}';`);
 for(const position of [9,10])await sql(`INSERT INTO kq_school_tournament_answers(room_id,user_id,position,option_id,correct,points,elapsed_ms,answered_at) VALUES('${room}','${users[0]}',${position},'${plan.questions[position].answer.correctOptionId}',true,140,4000,public.kq_school_tournament_now()-interval '10 seconds');`);
 const final=await result(users[0],command('answer',{roomId:room,questionId:plan.questions[11].question.id,optionId:plan.questions[11].answer.correctOptionId}));
 check('finale is recorded without instantly awarding champion',final.champion,null);
 check('weekly ranking receives real final answer',final.weeklyLeaderboard[0].userId,users[0]);
 for(let step=0;step<2;step++){await sql(`UPDATE kq_school_tournament_rooms SET next_at=public.kq_school_tournament_now()-interval '1 second' WHERE id='${room}';`);await result(users[0]);}
 await sql("UPDATE test_clock_anchor SET actual=clock_timestamp()-interval '11 hours 1 second';");
 [a,b]=await racing('weekly worker and player polling at cutoff',"SELECT jsonb_build_object('settled',public.rpc_kq_school_tournament_settle_weekly());",call(users[0]));
 check('concurrent poll sees the committed weekly champion',b.champion.userId,users[0]);
 check('weekly title credited once',await sql(`SELECT titles FROM kq_school_tournament_players WHERE user_id='${users[0]}';`),'1');
 await Promise.all([sql('SELECT public.rpc_kq_school_tournament_settle_weekly();'),sql('SELECT public.rpc_kq_school_tournament_settle_weekly();')]);
 check('duplicate weekly workers cannot duplicate title',await sql(`SELECT titles FROM kq_school_tournament_players WHERE user_id='${users[0]}';`),'1');
 check('one settlement for the closed week',await sql("SELECT count(*) FROM kq_school_tournament_weekly_editions WHERE edition_date='2026-11-15' AND settled_at IS NOT NULL;"),'1');
 await mkdir('output/school',{recursive:true});const report={success:true,engine:'PostgreSQL 17, independent connections',checks};
 await writeFile('output/school/tournament-weekly-concurrency-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{if(started)await run(['stop',container]).catch(()=>{});}
