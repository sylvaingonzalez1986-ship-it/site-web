/** Local-only transport running the actual tournament SQL in an ephemeral database. */
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {authorModule} from './audit-school-scenarios.mjs';

export const tournamentFixtureOwner=slot=>`00000000-0000-4000-8000-${String(slot).padStart(12,'0')}`;
export async function createTournamentFixture({seedReplays=false,now=null}={}){
 const db=new PGlite();
 await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY); CREATE TABLE public.contest_profiles(customer_id UUID PRIMARY KEY,pseudo TEXT);');
 const names=['Camille','Loïc','Maëlle','Yann','Nolwenn','Arthur','Lou','Robin'];
 for(let index=0;index<names.length;index++){
  const id=tournamentFixtureOwner(index+1);
  await db.query('INSERT INTO auth.users VALUES($1)',[id]);
  await db.query('INSERT INTO contest_profiles VALUES($1,$2)',[id,names[index]]);
 }
 for(const file of ['20261112001100_kq_school_challenge.sql','20261113000100_kq_school_hemp_quiz.sql'])await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
 await db.exec(await readFile('supabase/migrations/20261114000100_kq_school_tournament.sql','utf8'));
 await db.exec(await readFile('supabase/migrations/20261114000200_kq_school_tournament_bootstrap_bots.sql','utf8'));
 await db.exec(await readFile('supabase/migrations/20261114000300_kq_school_tournament_sundays.sql','utf8'));
 // PGlite cannot run pg_cron. Only schedule registration is stubbed here;
 // the real settlement function is exercised by integration tests.
 await db.exec(`CREATE SCHEMA cron;
 CREATE TABLE cron.job(jobid BIGSERIAL PRIMARY KEY,jobname TEXT UNIQUE,schedule TEXT,command TEXT,active BOOLEAN DEFAULT true,username TEXT DEFAULT 'postgres');
 CREATE FUNCTION cron.schedule(p_name TEXT,p_schedule TEXT,p_command TEXT) RETURNS BIGINT LANGUAGE plpgsql AS $$
 DECLARE result BIGINT; BEGIN INSERT INTO cron.job(jobname,schedule,command) VALUES(p_name,p_schedule,p_command)
 ON CONFLICT(jobname) DO UPDATE SET schedule=EXCLUDED.schedule,command=EXCLUDED.command RETURNING jobid INTO result; RETURN result; END $$;`);
 const weeklySql=await readFile('supabase/migrations/20261114000400_kq_school_tournament_weekly_champion.sql','utf8');
 await db.exec(weeklySql.replace('CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;',''));
 // This clock replacement exists only in this isolated in-memory fixture.
 // Production has no client clock parameter or calendar bypass.
 const setTime=async instant=>{
  const target=Date.parse(instant);if(!Number.isFinite(target))throw Error('Invalid fixture instant');
  const origin=(await db.query('SELECT extract(epoch FROM clock_timestamp())*1000 AS ms')).rows[0].ms;
  const offset=target-Number(origin);
  await db.exec(`CREATE OR REPLACE FUNCTION public.kq_school_tournament_now() RETURNS TIMESTAMPTZ LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=public AS $$ SELECT clock_timestamp()+(${offset} * interval '1 millisecond') $$;`);
 };
 if(now!==null)await setTime(now);
 const tournamentModule=await authorModule('kanab-quest-school-tournament-server.ts');
 const factory=tournamentModule.createKqSchoolTournamentPlan;
 if(typeof factory!=='function')throw new Error('Tournament plan factory missing');
 const {DEFAULT_CHANVRIER_APPEARANCE}=await authorModule('arena-chanvrier.ts');
 const appearances=[
  ['female','teal','ivory','ponytail','ginger','round-glasses','overalls'],
  ['male','blue','peach','quiff','chestnut','none','shirt'],
  ['female','violet','brown','braids','black','earrings','jacket'],
  ['male','ochre','copper','buzz','black','glasses','tee'],
  ['female','sage','honey','bob','black','none','apron'],
  ['male','berry','ivory','curls','blond','none','hoodie'],
  ['female','blue','peach','bun','chestnut','scarf','shirt'],
  ['male','teal','ebony','crop','black','round-glasses','overalls'],
 ];
 const avatars=new Map(appearances.map(([gender,clothing,skin,hair,hairColor,accessory,top],index)=>[tournamentFixtureOwner(index+1),{gender,clothing,skin,appearance:{...DEFAULT_CHANVRIER_APPEARANCE,hair,hairColor,accessory,top}}]));
 // Four explicitly fictional completed solo sessions, recorded using the actual solo RPC.
 // Their source answers and timestamps stay in this Node-only transport.
 const {createKqSchoolChallengePlan}=await authorModule('kanab-quest-school-challenge-server.ts');
 const solo=async(owner,command,plan=null)=>(await db.query('SELECT rpc_kq_school_challenge($1,$2,$3) AS snapshot',[owner,command,plan])).rows[0].snapshot;
 for(let slot=5;seedReplays && slot<=8;slot++){
  const owner=tournamentFixtureOwner(slot),plan=createKqSchoolChallengePlan('recorded-fixture-'+slot);
  let value=await solo(owner,{action:'start',requestKey:crypto.randomUUID()},plan);
  for(let index=0;index<20;index++){
   const elapsed=3200+(slot-5)*650+(index%5)*500;
   await db.query("UPDATE kq_school_challenge_rounds SET opened_at=clock_timestamp()-($1 * interval '1 millisecond') WHERE user_id=$2 AND id=$3",[elapsed,owner,value.round.id]);
   const item=plan.questions[index],correct=(index+slot)%4!==0;
   value=await solo(owner,{action:'answer',requestKey:crypto.randomUUID(),roundId:value.round.id,questionId:item.question.id,optionId:correct?item.answer.correctOptionId:item.question.options.find(option=>option.id!==item.answer.correctOptionId).id});
   value=await solo(owner,{action:'next',requestKey:crypto.randomUUID(),roundId:value.round.id,questionId:item.question.id});
  }
 }
 const {getKqTournamentBot}=await authorModule('kanab-quest-school-tournament-bots.ts');
 const addAvatar=person=>person?{...person,avatar:person.isBot?getKqTournamentBot(person.botCode)?.avatar||null:avatars.get(person.userId)||null}:null;
 const present=snapshot=>({...snapshot,champion:addAvatar(snapshot.champion),leaderboard:snapshot.leaderboard.map(addAvatar),weeklyLeaderboard:snapshot.weeklyLeaderboard.map(addAvatar),room:snapshot.room?{...snapshot.room,championTarget:addAvatar(snapshot.room.championTarget),players:snapshot.room.players.map(addAvatar)}:null});
 return {db,setTime,async request(method,input,owner){
  try{
   const command=method==='GET'?null:input;
   const plan=command?.action==='join'?factory():null;
   const result=await db.query('SELECT public.rpc_kq_school_tournament($1,$2,$3) AS snapshot',[owner,command,plan]);
   return {status:200,body:present(result.rows[0].snapshot)};
  }catch(error){
   const code=/\b(school_tournament_[a-z_]+)\b/.exec(error.message)?.[1];
   if(!code)throw error;
   return {status:code.includes('invalid')?400:409,body:{error:'Cette action ne correspond plus au tournoi. Retrouve le plateau enregistré.',code}};
  }
 },close:()=>db.close()};
}
