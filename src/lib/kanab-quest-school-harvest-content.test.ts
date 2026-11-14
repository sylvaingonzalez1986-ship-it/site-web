import {readFileSync,existsSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {HARVEST_CHAPTERS as chapters,HARVEST_LESSONS as lessons,HARVEST_QUESTIONS as questions,HARVEST_TERMS as terms,HARVEST_SOURCES as sources,HARVEST_LOTS as lots,HARVEST_INDICATORS as indicators,HARVEST_ADVICE as advice,HARVEST_TRIALS as trials,HARVEST_RECORD_FIELDS as fields,HARVEST_RESULTS as results,HARVEST_PLAN_FIELDS as plan,HARVEST_CASE_DOCUMENTS as documents,HARVEST_REVISION_LINKS as links,computeHarvestDryMatter,harvestLotMetrics,evaluateHarvestCase} from './kanab-quest-school-harvest';
import type {HarvestCaseState} from './kanab-quest-school-harvest-visuals';
import {HARVEST_ANSWERS as answers} from './kanab-quest-school-harvest-answers';
import {KQ_SCHOOL_HARVEST_LESSON_IDS,KQ_SCHOOL_HARVEST_ACTIVITY_IDS,KQ_SCHOOL_HARVEST_CHECKPOINT_IDS} from './kanab-quest-school-harvest-progress';
import {KQ_BUDDIES} from './kanab-quest-game';
import {HISTORY_LESSONS} from './kanab-quest-school-history';
import {BOTANY_LESSONS} from './kanab-quest-school-botany';
import {TERPENE_CHAPTERS} from './kanab-quest-school-terpenes-lessons';
import {CANNABINOID_CHAPTERS} from './kanab-quest-school-cannabinoids-lessons';
import {CULTIVATION_CHAPTERS} from './kanab-quest-school-cultivation-lessons';
import {HEALTH_CHAPTERS} from './kanab-quest-school-health-lessons';
import {SOIL_CHAPTERS} from './kanab-quest-school-soil-lessons';
import {PRODUCTS_CHAPTERS} from './kanab-quest-school-products-lessons';
const sorted=(ids:readonly string[])=>[...ids].sort();
const sourceIds=new Set(sources.map(s=>s.id)),lessonIds=new Set(lessons.map(l=>l.id)),termIds=new Set(terms.map(t=>t.id));
const refs=(ids:readonly string[],label:string)=>{expect(ids.length,label).toBeGreaterThan(0);for(const id of ids)expect(sourceIds.has(id),`${label}: ${id}`).toBe(true);};
const activities=chapters.flatMap(c=>[...c.lessons.map(l=>l.activity),c.checkpoint]);
const pathA:HarvestCaseState={requested:['specification','sampling'],hypotheses:['sampling','criteria'],evidence:{sampling:'sampling',criteria:'specification'},action:'observe',reason:'uncertainty',followup:'measure',followupReason:'same-basis',checked:true};
const pathB:HarvestCaseState={requested:['specification','sampling','handling','storage'],hypotheses:['handling','storage'],evidence:{handling:'handling',storage:'storage'},action:'hold',reason:'precaution',followup:'trial',followupReason:'test',checked:true};
describe('Harvest: comparable quantities, prudent decisions and plural justified paths',()=>{
 it('connects nine chapters and eighteen lessons to saved progression',()=>{
  expect(chapters).toHaveLength(9);expect(lessons).toHaveLength(18);expect(activities).toHaveLength(27);
  expect(sorted(lessons.map(l=>l.id))).toEqual(sorted(KQ_SCHOOL_HARVEST_LESSON_IDS));expect(sorted(lessons.map(l=>l.activity.id))).toEqual(sorted(KQ_SCHOOL_HARVEST_ACTIVITY_IDS));expect(sorted(chapters.map(c=>c.checkpoint.id))).toEqual(sorted(KQ_SCHOOL_HARVEST_CHECKPOINT_IDS));
  for(const l of lessons){for(const block of [...l.essential,...l.deeper,l.example])refs(block.sourceIds,l.id);refs(l.visual.sourceIds,l.id);for(const id of l.relatedLessonIds)expect(lessonIds.has(id),id).toBe(true);for(const id of l.glossaryIds)expect(termIds.has(id),id).toBe(true);for(const code of l.buddyCodes??[])expect(KQ_BUDDIES.some(b=>b.code===code),code).toBe(true);}
 });
 it('keeps thirty-six synthesis answers and all option explanations private',()=>{
  expect(questions).toHaveLength(36);expect(Object.keys(answers)).toHaveLength(36);expect(new Set(questions.map(q=>q.id)).size).toBe(36);for(const c of chapters)expect(questions.filter(q=>q.chapterId===c.id)).toHaveLength(4);
  for(const q of questions){expect(q.lessonId).toBe('prevention');expect(lessonIds.has(q.sectionId)).toBe(true);expect(q.options).toHaveLength(4);const a=answers[q.id];expect(q.options.some(o=>o.id===a.correctOptionId)).toBe(true);expect(sorted(Object.keys(a.optionExplanations))).toEqual(sorted(q.options.map(o=>o.id)));for(const explanation of Object.values(a.optionExplanations))expect(explanation.length).toBeGreaterThan(15);refs(q.sources.map(s=>s.id),q.id);}
  expect(readFileSync('src/lib/kanab-quest-school-harvest-answers.ts','utf8')).toContain('server-only');
 });
 it('covers six exercises plus the final workshop with evaluated reasons',()=>{
  for(const activity of activities)for(const step of activity.steps){refs(step.sourceIds,activity.id);for(const options of [step.choices,step.reasons??[]]){expect(options.length,activity.id).toBeGreaterThan(1);expect(options.some(o=>o.correct)).toBe(true);expect(options.some(o=>!o.correct)).toBe(true);for(const option of options)expect(option.feedback.length).toBeGreaterThan(15);}}
  for(const id of ['outcomes-1','units-1','outcomes-2','limits-2','trials-1','trials-2','tips-2'])expect(lessonIds.has(`harvest-${id}`)).toBe(true);
 });
 it('resolves dated sources, glossary terms and exact access limits',()=>{
  expect(sourceIds.size).toBe(sources.length);for(const s of sources){for(const text of [s.title,s.author,s.organization,s.published,s.passage,s.limitation,s.access,s.documentKind])expect(text.trim().length,s.id).toBeGreaterThan(0);expect(s.url).toMatch(/^(https?:\/\/|\/arene\/placard\?)/);expect(s.verifiedAt).toBe('2026-11-12');}
  for(const term of terms){refs(term.sourceIds,term.id);for(const id of term.lessonIds)expect(lessonIds.has(id),id).toBe(true);}
 });
 it('conserves dry matter and does not count disjoint losses twice',()=>{
  expect(lots).toHaveLength(3);
  for(const lot of lots){expect(lot.fictional).toBe(true);expect(lot.product).toBe('graines');expect(lot.durationDays).toBe(7);expect(computeHarvestDryMatter(lot.grossWetKg,lot.moistureWetBasisPct)).toBeCloseTo(lot.dryMatterKg,8);expect(lot.saleableDryKg+lot.losses.reduce((sum,l)=>sum+l.dryKg,0)).toBeCloseTo(lot.dryMatterKg,8);expect(lot.saleableDryKg).toBeLessThan(lot.dryMatterKg);refs(lot.sourceIds,lot.id);}
  expect(lots.map(l=>harvestLotMetrics(l)['gross-per-ha'])).toEqual([1500,1500,1500]);
  expect(lots.map(l=>harvestLotMetrics(l)['dry-per-ha'])).toEqual([1200,1050,1200]);
  expect(lots.map(l=>harvestLotMetrics(l)['saleable-per-ha'])).toEqual([1020,840,1080]);
  expect(lots.map(l=>l.saleableDryKg/l.dryMatterKg)).toEqual([.85,.8,.9]);
 });
 it('distinguishes missing water from zero and validates conversion inputs',()=>{
  expect(lots[1].waterM3).toBeNull();expect(harvestLotMetrics(lots[1])['water-per-ha']).toBeNull();expect(harvestLotMetrics({...lots[1],waterM3:0})['water-per-ha']).toBe(0);
  for(const args of [[-1,20],[100,-1],[100,101],[NaN,20],[100,Infinity]])expect(computeHarvestDryMatter(args[0],args[1])).toBeNull();
  expect(computeHarvestDryMatter(100,0)).toBe(100);expect(computeHarvestDryMatter(100,100)).toBe(0);
  expect(indicators).toHaveLength(8);for(const i of indicators){refs(i.sourceIds,i.id);expect(i.unit.length).toBeGreaterThan(1);expect(i.limits.length).toBeGreaterThan(0);}
 });
 it('gives each advice both supporting and contradicting evidence, with costs and context',()=>{
  expect(advice).toHaveLength(10);for(const a of advice){expect(a.hypothesis.length).toBeGreaterThan(20);expect(a.information.length).toBeGreaterThan(0);expect(a.confirmation.length).toBeGreaterThan(0);expect(a.contradiction.length).toBeGreaterThan(0);expect(a.limits.length).toBeGreaterThan(0);expect(a.contextCost.length).toBeGreaterThan(20);refs(a.sourceIds,a.id);}
 });
 it('documents experimental units, confounders and the consequences of missing records',()=>{
  expect(trials).toHaveLength(3);for(const t of trials){expect(t.fictional).toBe(true);for(const text of [t.unit,t.comparison,t.validConclusion,t.invalidConclusion])expect(text.length).toBeGreaterThan(10);expect(t.measurements.length).toBeGreaterThan(0);expect(t.limits.length).toBeGreaterThan(0);refs(t.sourceIds,t.id);}
  expect(fields).toHaveLength(12);for(const f of fields){expect(f.missingConsequence.length).toBeGreaterThan(15);refs(f.sourceIds,f.id);}
 });
 it('accepts two distinct prudent workshop paths without requiring irrelevant documents',()=>{
  expect(evaluateHarvestCase(pathA).passed).toBe(true);expect(evaluateHarvestCase(pathB).passed).toBe(true);expect(pathA.requested).toHaveLength(2);expect(pathB.requested).toHaveLength(4);expect(documents).toHaveLength(6);for(const d of documents)refs(d.sourceIds,d.id);
 });
 it('rejects duplicated hypotheses, unsupported diagnoses and mismatched reasons or evidence',()=>{
  const changes:Partial<HarvestCaseState>[]=[
   {hypotheses:['sampling','sampling']},{hypotheses:['sampling','toxin'],evidence:{sampling:'sampling',toxin:'specification'}},
   {requested:['sampling']},{evidence:{sampling:'specification',criteria:'sampling'}},{reason:'precaution'},
   {action:'add',reason:'guarantee'},{followup:'winner',followupReason:'certainty'},{followupReason:'test'},
  ];
  for(const change of changes)expect(evaluateHarvestCase({...pathA,...change}).passed).toBe(false);
 });
 it('connects all eight previous curricula to real revision lessons',()=>{
  const known:Record<string,string[]>={history:HISTORY_LESSONS.map(l=>l.id),plant:BOTANY_LESSONS.map(l=>l.id),molecules:TERPENE_CHAPTERS.flatMap(c=>c.lessons.map(l=>l.id)),evidence:CANNABINOID_CHAPTERS.flatMap(c=>c.lessons.map(l=>l.id)),genetics:CULTIVATION_CHAPTERS.flatMap(c=>c.lessons.map(l=>l.id)),biodiversity:HEALTH_CHAPTERS.flatMap(c=>c.lessons.map(l=>l.id)),uses:SOIL_CHAPTERS.flatMap(c=>c.lessons.map(l=>l.id)),profiles:PRODUCTS_CHAPTERS.flatMap(c=>c.lessons.map(l=>l.id))};
  expect(links).toHaveLength(8);expect(new Set(links.map(l=>l.course)).size).toBe(8);for(const link of links)expect(known[link.course]?.includes(link.passage),link.passage).toBe(true);
 });
 it('defines ten outcomes and a plan with real independent units rather than a universal recipe',()=>{
  expect(results).toHaveLength(10);for(const r of results)expect(r.limit.length).toBeGreaterThan(20);
  expect(plan).toHaveLength(4);for(const p of plan){expect(p.options.some(o=>o.correct)).toBe(true);expect(p.options.some(o=>!o.correct)).toBe(true);}
  expect(plan.find(p=>p.id==='units')?.options.filter(o=>o.correct)).toHaveLength(2);expect(existsSync('public/placard/school/harvest/desk-v1.webp')).toBe(true);
 });
});
