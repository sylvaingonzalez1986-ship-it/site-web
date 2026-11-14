import {readFileSync,existsSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {SOIL_CHAPTERS as chapters,SOIL_LESSONS as lessons,SOIL_QUESTIONS as questions,SOIL_TERMS as terms,SOIL_SOURCES as sources,SOIL_INDICATORS as indicators,SOIL_ANALYSES as analyses,SOIL_ANALYSIS_COMPARISONS as comparisons,SOIL_NUTRIENTS as nutrients,SOIL_INPUTS as inputs,SOIL_NETWORK_NODES as nodes,SOIL_NETWORK_EDGES as edges,SOIL_HOTSPOTS as hotspots} from './kanab-quest-school-soil';
import {SOIL_ANSWERS as answers} from './kanab-quest-school-soil-answers';
import {KQ_SCHOOL_SOIL_LESSON_IDS,KQ_SCHOOL_SOIL_ACTIVITY_IDS,KQ_SCHOOL_SOIL_CHECKPOINT_IDS} from './kanab-quest-school-soil-progress';
import {KQ_BUDDIES} from './kanab-quest-game';
const sorted=(ids:readonly string[])=>[...ids].sort();
const sourceIds=new Set(sources.map(s=>s.id)),lessonIds=new Set(lessons.map(l=>l.id)),termIds=new Set(terms.map(t=>t.id));
const refs=(ids:readonly string[],label:string)=>{expect(ids.length,label).toBeGreaterThan(0);for(const id of ids)expect(sourceIds.has(id),`${label}: ${id}`).toBe(true);};
const activities=chapters.flatMap(c=>[...c.lessons.map(l=>l.activity),c.checkpoint]);
describe('Soil: contextual evidence, comparable analyses and conserved progression',()=>{
 it('connects all ten chapters and twenty lessons to server-recognised steps',()=>{
  expect(chapters).toHaveLength(10);expect(lessons).toHaveLength(20);expect(activities).toHaveLength(30);
  expect(sorted(lessons.map(l=>l.id))).toEqual(sorted(KQ_SCHOOL_SOIL_LESSON_IDS));expect(sorted(lessons.map(l=>l.activity.id))).toEqual(sorted(KQ_SCHOOL_SOIL_ACTIVITY_IDS));expect(sorted(chapters.map(c=>c.checkpoint.id))).toEqual(sorted(KQ_SCHOOL_SOIL_CHECKPOINT_IDS));
  for(const l of lessons){for(const block of [...l.essential,...l.deeper,l.example])refs(block.sourceIds,l.id);refs(l.visual.sourceIds,l.id);for(const id of l.relatedLessonIds)expect(lessonIds.has(id),id).toBe(true);for(const id of l.glossaryIds)expect(termIds.has(id),id).toBe(true);for(const code of l.buddyCodes??[])expect(KQ_BUDDIES.some(b=>b.code===code),code).toBe(true);}
 });
 it('keeps forty authored questions and all proposition explanations private',()=>{
  expect(questions).toHaveLength(40);expect(Object.keys(answers)).toHaveLength(40);expect(new Set(questions.map(q=>q.id)).size).toBe(40);for(const c of chapters)expect(questions.filter(q=>q.chapterId===c.id)).toHaveLength(4);
  for(const q of questions){expect(q.lessonId).toBe('uses');expect(lessonIds.has(q.sectionId)).toBe(true);expect(q.options).toHaveLength(4);const a=answers[q.id];expect(q.options.some(o=>o.id===a.correctOptionId)).toBe(true);expect(sorted(Object.keys(a.optionExplanations))).toEqual(sorted(q.options.map(o=>o.id)));for(const explanation of Object.values(a.optionExplanations))expect(explanation.length).toBeGreaterThan(15);refs(q.sources.map(s=>s.id),q.id);}
  expect(readFileSync('src/lib/kanab-quest-school-soil-answers.ts','utf8')).toContain('server-only');
 });
 it('requires justification in each activity and covers the seven requested exercises',()=>{
  for(const activity of activities)for(const step of activity.steps){refs(step.sourceIds,activity.id);for(const options of [step.choices,step.reasons??[]]){expect(options.length,activity.id).toBeGreaterThan(1);expect(options.some(o=>o.correct)).toBe(true);expect(options.some(o=>!o.correct)).toBe(true);for(const option of options)expect(option.feedback.length).toBeGreaterThan(15);}}
  for(const id of ['nutrients-1','measures-2','analysis-1','analysis-2','organic-1','rhizosphere-2','inputs-1'])expect(lessonIds.has(`soil-${id}`)).toBe(true);
 });
 it('resolves sources and glossary links with dated access limits',()=>{
  expect(sourceIds.size).toBe(sources.length);for(const s of sources){for(const text of [s.title,s.author,s.organization,s.published,s.passage,s.limitation,s.access,s.documentKind])expect(text.trim().length,s.id).toBeGreaterThan(0);expect(s.url).toMatch(/^(https?:\/\/|\/arene\/placard\?)/);expect(s.verifiedAt).toBe('2026-11-12');}
  for(const term of terms){refs(term.sourceIds,term.id);for(const id of term.lessonIds)expect(lessonIds.has(id),id).toBe(true);}
 });
 it('pairs every indicator with its method, units and prohibited conclusions',()=>{
  expect(indicators.length).toBeGreaterThanOrEqual(10);expect(new Set(indicators.map(i=>i.id)).size).toBe(indicators.length);
  for(const i of indicators){refs(i.sourceIds,i.id);expect(i.units.length).toBeGreaterThan(0);for(const field of [i.measures,i.doesNotConclude,i.method,i.limits])expect(field.length,i.id).toBeGreaterThan(15);}
  for(const id of ['ph','ec','cec','organic-carbon','total-nitrogen','cn-ratio','extractable-phosphorus','texture'])expect(indicators.some(i=>i.id===id),id).toBe(true);
 });
 it('labels both datasets fictitious and keeps the carbon to nitrogen arithmetic exact',()=>{
  expect(analyses).toHaveLength(2);for(const a of analyses){expect(a.fictitious).toBe(true);expect(a.title).toMatch(/fictive/i);expect(a.measurements).toHaveLength(8);expect(a.sampling).toContain('0–20');expect(a.limits.length).toBeGreaterThan(0);for(const m of a.measurements){expect(indicators.some(i=>i.id===m.indicatorId),m.indicatorId).toBe(true);expect(m.method.length).toBeGreaterThan(15);expect(m.unit.length).toBeGreaterThan(0);expect(m.note.length).toBeGreaterThan(15);}
   const value=(id:string)=>a.measurements.find(m=>m.indicatorId===id)!.value;expect(Number(value('organic-carbon'))/Number(value('total-nitrogen'))).toBe(value('cn-ratio'));const percents=String(value('texture')).match(/\d+(?=\s*%)/g)!.map(Number);expect(percents.reduce((a,b)=>a+b,0)).toBe(100);
  }
 });
 it('rejects direct comparison of different pH, EC, CEC and P methods',()=>{
  for(const id of ['ph','ec','cec','extractable-phosphorus']){expect(comparisons.find(c=>c.indicatorId===id)?.status).toBe('method-mismatch');const [a,b]=analyses.map(item=>item.measurements.find(m=>m.indicatorId===id)!);expect(a.comparabilityGroup).not.toBe(b.comparabilityGroup);}
  for(const id of ['organic-carbon','total-nitrogen','cn-ratio','texture']){expect(comparisons.find(c=>c.indicatorId===id)?.status).toBe('comparable');const [a,b]=analyses.map(item=>item.measurements.find(m=>m.indicatorId===id)!);expect(a.comparabilityGroup).toBe(b.comparabilityGroup);expect(a.unit).toBe(b.unit);}
  for(const c of comparisons){expect(c.explanation.length).toBeGreaterThan(20);expect(c.missing.length).toBeGreaterThan(0);}
 });
 it('keeps the biological map connected and each relation conditional',()=>{
  expect(nodes).toHaveLength(14);expect(new Set(nodes.map(n=>n.id)).size).toBe(nodes.length);expect(new Set(edges.map(e=>e.id)).size).toBe(edges.length);
  for(const n of nodes){refs(n.sourceIds,n.id);expect(edges.some(e=>e.from===n.id||e.to===n.id),n.id).toBe(true);}
  for(const e of edges){expect(nodes.some(n=>n.id===e.from),e.id).toBe(true);expect(nodes.some(n=>n.id===e.to),e.id).toBe(true);expect(e.from).not.toBe(e.to);for(const text of [e.process,e.condition,e.limit])expect(text.length,e.id).toBeGreaterThan(10);refs(e.sourceIds,e.id);}
 });
 it('covers the specified essential elements and compares input purposes with risks',()=>{
  expect(sorted(nutrients.map(n=>n.symbol))).toEqual(sorted(['N','P','K','Ca','Mg','S','B','Cl','Cu','Fe','Mn','Mo','Ni','Zn']));for(const n of nutrients){expect(n.roles.length).toBeGreaterThan(0);expect(n.limits.length).toBeGreaterThan(15);refs(n.sourceIds,n.id);}
  expect(inputs.length).toBeGreaterThanOrEqual(6);for(const item of inputs){expect(item.functions.length).toBeGreaterThan(0);expect(item.maturity.length).toBeGreaterThan(15);expect(item.variability.length).toBeGreaterThan(15);expect(item.risks.length).toBeGreaterThan(0);expect(item.decisionQuestions.length).toBeGreaterThan(0);refs(item.sourceIds,item.id);}
 });
 it('ships the illustrated section with sourced, separated hotspots at narrow widths',()=>{
  expect(existsSync('public/placard/school/soil/cutaway-v1.webp')).toBe(true);expect(hotspots).toHaveLength(6);for(const point of hotspots){refs(point.sourceIds,point.id);expect(point.x).toBeGreaterThan(0);expect(point.x).toBeLessThan(100);expect(point.y).toBeGreaterThan(0);expect(point.y).toBeLessThan(100);}
  for(let i=0;i<hotspots.length;i++)for(let j=i+1;j<hotspots.length;j++){const a=hotspots[i],b=hotspots[j];expect(Math.abs(a.x-b.x)*2.8>=36||Math.abs(a.y-b.y)*(280/150)>=36,`${a.id}/${b.id}`).toBe(true);}
 });
});
