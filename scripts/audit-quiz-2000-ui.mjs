import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {Launcher} from 'chrome-launcher';
import {authorModule} from './audit-school-scenarios.mjs';
import {createTournamentFixture,tournamentFixtureOwner} from './school-tournament-fixture.mjs';
const out=process.argv.includes('--rebalance')?'output/quiz-rebalance-2026-11-17/ui':'output/quiz-2000/ui'; await mkdir(out,{recursive:true});
const fixture=await createTournamentFixture(),owner=tournamentFixtureOwner(1),checks=[],errors=[];
const {createKqSchoolTournamentPlan}=await authorModule('kanab-quest-school-tournament-server.ts');
const {HEMP_QUIZ_BANK_SIZE}=await authorModule('kanab-quest-hemp-quiz-meta.ts');
let plan;
const prefix=process.argv.includes('--rebalance')?'hemp-q2-r':process.argv.includes('--external')?'hemp-q2-ext-':'hemp-q2-';
for(let seed=0;seed<2000;seed++){const candidate=createKqSchoolTournamentPlan('quiz-2000-ui-'+seed);if(candidate.questions[0].question.id.startsWith(prefix)){plan=candidate;break;}}
assert(plan,'An independently reviewed new question must be reachable in the opening stage');
let browser;
try{
 const userDataDir=await mkdtemp(resolve(out,'chrome-profile-'));
 browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],userDataDir,headless:true,args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage(); page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(60000);
 page.on('pageerror',error=>errors.push(error.message));
 await page.setViewport({width:1440,height:1000});
 await page.setRequestInterception(true);
 page.on('request',async request=>{
  if(new URL(request.url()).pathname!=='/api/arena/placard/school/tournament')return request.continue();
  try{
   const command=request.method()==='POST'?JSON.parse(request.postData()):null;
   const result=await fixture.request(request.method(),command,owner);
   // Replace only an isolated test-room draw, before it starts, with a real seeded factory draw.
   if(command?.action==='join'&&result.body.room?.status==='lobby')await fixture.db.query('UPDATE kq_school_tournament_rooms SET plan=$1::jsonb WHERE id=$2',[JSON.stringify(plan.questions),result.body.room.id]);
   await request.respond({status:result.status,contentType:'application/json',body:JSON.stringify(result.body)});
  }catch(error){errors.push(error.message);if(!request.isInterceptResolutionHandled())await request.abort();}
 });
 const base=`http://127.0.0.1:${process.env.NAVIGATION_AUDIT_PORT||3266}/arene/placard?view=school`;
 await page.goto(base+'&section=tournament',{waitUntil:'networkidle0'});
 await page.waitForSelector('[data-tournament-question-bank]');
 assert((await page.$eval('[data-tournament-question-bank]',el=>el.textContent)).includes(`${HEMP_QUIZ_BANK_SIZE} questions`));
 checks.push('Lobby announces the measured active bank count');
 await page.$eval('[data-tournament-join]',el=>el.click());
 await page.waitForSelector('[data-tournament-question="'+plan.questions[0].question.id+'"]');
 const snapshot=(await fixture.request('GET',null,owner)).body;
 assert.equal(snapshot.room.question.id,plan.questions[0].question.id);
 assert.equal(snapshot.room.players.length,4);
 assert.equal(snapshot.room.players.filter(p=>p.isBot).length,3);
 assert(!JSON.stringify(snapshot).includes('correctOptionId'));
 checks.push('Actual SQL tournament draws a reviewed new question with three bots; answer remains private');
 for(const width of [1440,390,320]){
  await page.setViewport({width,height:1000});
  await page.$eval('[data-tournament-question]',el=>el.scrollIntoView({block:'center',behavior:'instant'}));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.equal(await page.$$eval('[data-tournament-answer]',els=>els.length),4);
  await page.screenshot({path:`${out}/question-${width}.png`});
 }
 checks.push('New question and four choices fit 320, 390 and 1440px');
 await page.focus('[data-tournament-answer="'+plan.questions[0].answer.correctOptionId+'"]');
 await page.keyboard.press('Enter');
 await page.waitForSelector('[data-tournament-reveal]');
 assert.match(await page.$eval('[data-tournament-reveal]',el=>el.textContent),/Bonne réponse !/);
 const correctState=(await fixture.request('GET',null,owner)).body;
 const score=correctState.room.players.find(p=>p.userId===owner).score;
 assert(score>0);
 assert((await page.$eval('[data-tournament-reveal]',el=>el.textContent)).includes(plan.questions[0].answer.explanation));
 await fixture.db.query("UPDATE kq_school_tournament_rooms SET next_at=clock_timestamp()+interval '90 seconds' WHERE id=$1",[correctState.room.id]);
 await page.reload({waitUntil:'networkidle0'});
 await page.waitForSelector('[data-tournament-reveal]');
 assert.equal((await fixture.request('GET',null,owner)).body.room.players.find(p=>p.userId===owner).score,score);
 await page.screenshot({path:out+'/correction-320.png'});
 checks.push('Keyboard answer, matching explanation, SQL score and reload without double scoring');
 await fixture.db.query("UPDATE kq_school_tournament_rooms SET next_at=clock_timestamp()-interval '1 millisecond' WHERE id=$1",[correctState.room.id]);
 await page.waitForSelector('[data-tournament-question="'+plan.questions[1].question.id+'"]');
 const wrong=plan.questions[1].question.options.find(option=>option.id!==plan.questions[1].answer.correctOptionId).id;
 await page.$eval(`[data-tournament-answer="${wrong}"]`,el=>el.click());
 await page.waitForSelector('[data-tournament-reveal]');
 assert.match(await page.$eval('[data-tournament-reveal]',el=>el.textContent),/La bonne réponse était/);
 assert.equal((await fixture.request('GET',null,owner)).body.room.players.find(p=>p.userId===owner).score,score);
 checks.push('Wrong answer reveals the correct option and explanation without awarding points');
 const articleId=plan.questions[0].question.sectionId;
 await page.goto(base+'&section=learn&module=reference&passage='+articleId,{waitUntil:'networkidle0'});
 await page.waitForSelector(`[data-cannabis-article="${articleId}"]`);
 assert((await page.$eval('[data-cannabis-article]',el=>el.textContent)).length>100);
 for(const source of plan.questions[0].question.sources) assert(await page.$(`[data-cannabis-article] a[href="${source.url}"]`));
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:out+'/article-320.png'});
 checks.push('Linked article includes the actual question sources and fits mobile');
 for(const path of ['/src/lib/kanab-quest-hemp-quiz-additions.json','/src/lib/kanab-quest-hemp-quiz-reviewed.json','/docs/quiz-2000/batches/pilot-c.json','/docs/quiz-rebalance-2026-11-17/baseline.json']){
  const status=await page.evaluate(async path=>(await fetch(path)).status,path);
  assert.equal(status,403,path+' must remain private in preview');
 }
 checks.push('New answers, legacy revisions and editorial batches denied over preview HTTP');
 assert.deepEqual(errors,[]);
 await writeFile(out+'/report.json',JSON.stringify({success:true,checks,activeCount:HEMP_QUIZ_BANK_SIZE,questionId:plan.questions[0].question.id,errors,scope:'Actual UI and SQL in isolated local PGlite. Reveal timing controlled locally for reload checks. No remote data modified. One new question displayed at three widths; this is not a visual check of every bank entry.'},null,2)+'\n');
 console.log(JSON.stringify({success:true,checks:checks.length}));
}catch(error){
 const pages=browser?await browser.pages():[];
 const page=pages.at(-1);
 await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});
 await writeFile(out+'/failure.json',JSON.stringify({error:error.message,checks,pageErrors:errors,body:await page?.$eval('body',el=>el.innerText.slice(0,5000)).catch(()=>null)},null,2)+'\n');
 throw error;
}finally{await browser?.close();await fixture.close();}
