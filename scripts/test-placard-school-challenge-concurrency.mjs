// Real PostgreSQL connections, entirely local: cached image, no network, port or host mount.
// Setup follows test-placard-school-concurrency.mjs; only this script's random container is stopped.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

const docker = "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe";
const base = ["--config", "C:\\lesiteinternetquitue\\output\\school-sql\\docker-config", "--host", "npipe:////./pipe/docker_engine"];
const container = `kq-school-challenge-test-${randomUUID().slice(0, 8)}`;
const image = "public.ecr.aws/supabase/postgres:17.6.1.075";
const checks = [];
let started = false;
assert.equal(process.argv.length, 2, "This isolated test takes no arguments");
function run(args, input = "") {
  return new Promise((resolve, reject) => {
    const child = spawn(docker, [...base, ...args], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let output = "", error = "";
    child.stdout.on("data", part => { output += part; });
    child.stderr.on("data", part => { error += part; });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve(output.trim()) : reject(new Error(error.trim() || `docker exit ${code}`)));
    child.stdin.end(input);
  });
}
const sql = text => run(["exec", "-i", container, "psql", "-X", "-h", "/tmp", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt"], text);
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const literal = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); checks.push(name); };

async function racing(name, firstSql, secondSql, expectedError = null) {
  const tag = randomUUID();
  // Both outcomes are caught immediately, so an expected rejection never becomes unhandled.
  const outcome = text => sql(text).then(value => ({ value: JSON.parse(value) }), error => ({ error }));
  const first = outcome(`SET application_name='feedback-first-${tag}'; SET school.test_pause='hold'; ${firstSql}`);
  let holding = false;
  for (let index = 0; index < 40; index++) {
    holding = await sql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='feedback-first-${tag}' AND wait_event='PgSleep');`) === "t";
    if (holding) break;
    await wait(25);
  }
  assert(holding, `${name}: first connection must hold the transaction inside the test trigger`);
  const second = outcome(`SET application_name='feedback-second-${tag}'; ${secondSql}`);
  let blocked = false;
  for (let index = 0; index < 20; index++) {
    blocked = await sql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='feedback-second-${tag}' AND wait_event_type='Lock');`) === "t";
    if (blocked) break;
    await wait(25);
  }
  const [left, right] = await Promise.all([first, second]);
  check(`${name}: independent second connection waits on a PostgreSQL lock`, blocked, true);
  if (left.error) throw left.error;
  if (expectedError) {
    assert.match(right.error?.message ?? "", expectedError, `${name}: expected rejection after waiting`);
    checks.push(`${name}: rejected after the first transaction commits`);
  } else if (right.error) throw right.error;
  return [left.value, right.value];
}

const plan=(await import('./school-challenge-test-data.mjs')).challengeTestPlan();
const call=(owner,command=null,bank=command?.action==='start'?plan:null)=>`SELECT rpc_kq_school_challenge('${owner}',${command===null?"NULL::jsonb":literal(command)},${bank===null?"NULL::jsonb":literal(bank)});`;
const action=(action,roundId,questionId,extra={})=>({action,requestKey:randomUUID(),roundId,questionId,...extra});
async function player(){const id=randomUUID();await sql(`INSERT INTO auth.users VALUES('${id}');`);await sql(call(id));return id;}
async function start(owner){const command={action:'start',requestKey:randomUUID()};return JSON.parse(await sql(call(owner,command))).round;}
try {
 await run(['run','--detach','--rm','--pull=never','--name',container,'--network','none','--read-only','--user','postgres','--tmpfs','/tmp:rw,mode=1777','--entrypoint','/bin/sh',image,'-c',"/usr/bin/initdb -D /tmp/school-db --auth=trust --encoding=UTF8 --no-locale >/tmp/school-init.log && exec /usr/bin/postgres -D /tmp/school-db -c listen_addresses='' -c unix_socket_directories=/tmp"]);started=true;
 let ready=false;for(let index=0;index<50;index++){try{await sql('SELECT 1;');ready=true;break;}catch{await wait(100);}}assert(ready);
 await sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY); CREATE TABLE wallet_sentinel(cents INTEGER); INSERT INTO wallet_sentinel VALUES(10700); ${await readFile('supabase/migrations/20261112001100_kq_school_challenge.sql','utf8')}
 CREATE FUNCTION test_challenge_hold() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN IF current_setting('school.test_pause',true)='hold' THEN PERFORM pg_sleep(3); END IF; RETURN NEW; END $$;
 CREATE TRIGGER test_challenge_hold BEFORE INSERT OR UPDATE ON kq_school_challenge_rounds FOR EACH ROW EXECUTE FUNCTION test_challenge_hold();`);
 let owner=await player(),round=await start(owner),answer=action('answer',round.id,'test-q01',{optionId:'b'});
 let [first,second]=await racing('duplicate answer response',call(owner,answer),call(owner,answer));
 check('same command returns identical persisted feedback',second.round.feedback,first.round.feedback);check('duplicate answer does not append twice',[second.replayed,second.round.answers.length,second.round.score],[true,1,0]);
 owner=await player();round=await start(owner);
 await racing('first answer wins over a later corrected choice',call(owner,action('answer',round.id,'test-q01',{optionId:'b'})),call(owner,action('answer',round.id,'test-q01',{optionId:'a'})),/school_challenge_answer_locked/);
 check('wrong first answer stays zero after concurrent correction',JSON.parse(await sql(call(owner))).round.score,0);
 owner=await player();round=await start(owner);await sql(call(owner,action('answer',round.id,'test-q01',{optionId:'a'})));
 const next=action('next',round.id,'test-q01');[first,second]=await racing('duplicate next response',call(owner,next),call(owner,{...next,requestKey:randomUUID()}));
 check('two next commands advance exactly once',[first.round.questionNumber,second.round.questionNumber,second.replayed],[2,2,true]);check('duplicate next retains question opening time',second.round.openedAt,first.round.openedAt);
 owner=await player();round=await start(owner);await sql(call(owner,action('answer',round.id,'test-q01',{optionId:'a'})));
 const openingNext=action('next',round.id,'test-q01');
 const delayedOpen=`BEGIN; DO $$ BEGIN PERFORM 1 FROM kq_school_challenge_players WHERE user_id='${owner}' FOR UPDATE; PERFORM pg_sleep(3); PERFORM set_config('school.test_pause','none',true); END $$; ${call(owner,openingNext)} COMMIT;`;
 await racing('answer arriving before its question opens',delayedOpen,call(owner,action('answer',round.id,'test-q02',{optionId:'a'})),/school_challenge_question_changed/);
 check('pre-open request cannot earn an instant bonus',JSON.parse(await sql(call(owner))).round.answeredCount,1);
 owner=await player();round=await start(owner);
 const replacement={action:'start',requestKey:randomUUID(),replaceRoundId:round.id};
 await racing('new round versus a late old-round answer',call(owner,replacement),call(owner,action('answer',round.id,'test-q01',{optionId:'a'})),/school_challenge_round_changed/);
 check('replaced round never inherits an old answer',[JSON.parse(await sql(call(owner))).round.id,JSON.parse(await sql(call(owner))).round.answers.length],[replacement.requestKey,0]);
 owner=await player();round=await start(owner);
 const replaceA={action:'start',requestKey:randomUUID(),replaceRoundId:round.id},replaceB={...replaceA,requestKey:randomUUID()};
 await racing('two explicitly confirmed replacements',call(owner,replaceA),call(owner,replaceB),/school_challenge_round_changed/);
 check('only one replacement becomes active',JSON.parse(await sql(call(owner))).round.id,replaceA.requestKey);
 owner=await player();round=await start(owner);
 for(let index=0;index<20;index++){const questionId=plan.questions[index].question.id;await sql(call(owner,action('answer',round.id,questionId,{optionId:'a'})));if(index<19)await sql(call(owner,action('next',round.id,questionId)));}
 const finish=action('next',round.id,'test-q20');[first,second]=await racing('double completion',call(owner,finish),call(owner,{...finish,requestKey:randomUUID()}));
 check('completed count increments once',[first.completedCount,second.completedCount,second.round.status],[1,1,'complete']);check('best score is the completed server total',[second.bestScore,second.bestCorrectCount],[second.round.score,20]);
 check('challenge has no monetary side effect',await sql('SELECT cents FROM wallet_sentinel;'),'10700');
 console.log(`PASS: ${checks.length} real PostgreSQL17 challenge concurrency checks; isolated local container, no network, ports or mounts.`);
}finally{if(started)await run(['stop','--time','2',container]).catch(error=>{if(!error.message.includes('No such container'))throw error;});}
