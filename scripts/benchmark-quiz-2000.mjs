/** Local draw measurements. Synthetic entries never enter the application bank. */
import {performance} from 'node:perf_hooks';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {authorModule} from './audit-school-scenarios.mjs';
const start=performance.now();
const {HEMP_QUIZ_BANK,HEMP_QUIZ_SOURCES}=await authorModule('kanab-quest-hemp-quiz-bank.ts');
const {createKqSchoolQuestionPlan}=await authorModule('kanab-quest-school-challenge-server.ts');
const fixtureLoadMs=performance.now()-start;
const {target}=JSON.parse(await readFile('docs/quiz-2000/coverage-plan.json','utf8'));
const synthetic=Array.from({length:target},(_,index)=>({...HEMP_QUIZ_BANK[index%HEMP_QUIZ_BANK.length],id:`hemp-capacity-only-${index}`,subjectKey:`capacity-subject-${index%500}`}));
const measure=(pool,questionsPerLevel=3)=>{
  const durations=[];
  const entriesById=new Map(pool.map(entry=>[entry.id,entry]));
  const domainCounts={active:0,food:0,materials:0};
  let plan;
  for(let index=0;index<100;index++){
    const begin=performance.now();
    plan=createKqSchoolQuestionPlan(`capacity-${index}`,questionsPerLevel,pool,HEMP_QUIZ_SOURCES);
    durations.push(performance.now()-begin);
    for(const {question} of plan.questions) domainCounts[entriesById.get(question.id).domain]++;
  }
  durations.sort((a,b)=>a-b);
  const questionsDrawn=durations.length*questionsPerLevel*4;
  return {entries:pool.length,draws:durations.length,questionsPerDraw:questionsPerLevel*4,domainCounts,domainPercentages:Object.fromEntries(Object.entries(domainCounts).map(([domain,count])=>[domain,Number((100*count/questionsDrawn).toFixed(2))])),medianMs:Number(durations[50].toFixed(2)),p95Ms:Number(durations[95].toFixed(2)),privatePlanBytes:Buffer.byteLength(JSON.stringify(plan)),firstPublicQuestionBytes:Buffer.byteLength(JSON.stringify(plan.questions[0].question))};
};
const report={actual:measure(HEMP_QUIZ_BANK),actualChallenge20:measure(HEMP_QUIZ_BANK,5),syntheticCapacityOnly:measure(synthetic),fixtureLoadMs:Number(fixtureLoadMs.toFixed(2)),limits:`Local warm CPU draw and JSON size. Domain percentages describe these 100 deterministic draws per format, not an exact 80/10/10 guarantee in every 12-question game. The ${target} capacity entries are synthetic, not editorial content or a completion claim. Fixture loader time is not a production import benchmark. No network or database writes.`};
const output=process.argv.includes('--rebalance')?'output/quiz-rebalance-2026-11-17':'output/quiz-2000';
await mkdir(output,{recursive:true});
await writeFile(output+'/performance.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
