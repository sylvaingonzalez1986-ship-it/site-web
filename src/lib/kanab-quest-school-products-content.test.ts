import {readFileSync,existsSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {PRODUCTS_CHAPTERS as chapters,PRODUCTS_LESSONS as lessons,PRODUCTS_QUESTIONS as questions,PRODUCTS_TERMS as terms,PRODUCTS_SOURCES as sources,PRODUCTS_ATLAS as atlas,PRODUCTS_REGULATIONS as regulations,PRODUCTS_FIBRE_STAGES as stages,PRODUCTS_GROUPS as groups,PRODUCTS_PLATE_POINTS as points,PRODUCTS_PROCESS_CARDS as processes,PRODUCTS_LABEL_CLAIMS as claims,PRODUCTS_CERTIFICATE as certificate,PRODUCTS_TRACE_DOCUMENTS as documents,PRODUCTS_TRACE_QUESTIONS as investigation} from './kanab-quest-school-products';
import {PRODUCTS_ANSWERS as answers} from './kanab-quest-school-products-answers';
import {KQ_SCHOOL_PRODUCTS_LESSON_IDS,KQ_SCHOOL_PRODUCTS_ACTIVITY_IDS,KQ_SCHOOL_PRODUCTS_CHECKPOINT_IDS} from './kanab-quest-school-products-progress';
import {KQ_BUDDIES} from './kanab-quest-game';
const sorted=(ids:readonly string[])=>[...ids].sort();
const sourceIds=new Set(sources.map(s=>s.id)),lessonIds=new Set(lessons.map(l=>l.id)),termIds=new Set(terms.map(t=>t.id));
const refs=(ids:readonly string[],label:string)=>{expect(ids.length,label).toBeGreaterThan(0);for(const id of ids)expect(sourceIds.has(id),`${label}: ${id}`).toBe(true);};
const activities=chapters.flatMap(c=>[...c.lessons.map(l=>l.activity),c.checkpoint]);
describe('Products: traceable scope, measured quality and distinct exposure routes',()=>{
 it('connects the four groups and ten chapters to saved lessons and activities',()=>{
  expect(chapters).toHaveLength(10);expect(lessons).toHaveLength(20);expect(activities).toHaveLength(30);
  expect(sorted(groups.flatMap(g=>[...g.chapterIds]))).toEqual(sorted(chapters.map(c=>c.id)));
  expect(sorted(lessons.map(l=>l.id))).toEqual(sorted(KQ_SCHOOL_PRODUCTS_LESSON_IDS));expect(sorted(lessons.map(l=>l.activity.id))).toEqual(sorted(KQ_SCHOOL_PRODUCTS_ACTIVITY_IDS));expect(sorted(chapters.map(c=>c.checkpoint.id))).toEqual(sorted(KQ_SCHOOL_PRODUCTS_CHECKPOINT_IDS));
  for(const l of lessons){for(const block of [...l.essential,...l.deeper,l.example])refs(block.sourceIds,l.id);refs(l.visual.sourceIds,l.id);for(const id of l.relatedLessonIds)expect(lessonIds.has(id),id).toBe(true);for(const id of l.glossaryIds)expect(termIds.has(id),id).toBe(true);for(const code of l.buddyCodes??[])expect(KQ_BUDDIES.some(b=>b.code===code),code).toBe(true);}
 });
 it('has forty questions with private reference answers and explanations for every option',()=>{
  expect(questions).toHaveLength(40);expect(Object.keys(answers)).toHaveLength(40);expect(new Set(questions.map(q=>q.id)).size).toBe(40);for(const c of chapters)expect(questions.filter(q=>q.chapterId===c.id)).toHaveLength(4);
  for(const q of questions){expect(q.lessonId).toBe('profiles');expect(lessonIds.has(q.sectionId)).toBe(true);expect(q.options).toHaveLength(4);const a=answers[q.id];expect(q.options.some(o=>o.id===a.correctOptionId)).toBe(true);expect(sorted(Object.keys(a.optionExplanations))).toEqual(sorted(q.options.map(o=>o.id)));for(const explanation of Object.values(a.optionExplanations))expect(explanation.length).toBeGreaterThan(15);refs(q.sources.map(s=>s.id),q.id);}
  expect(readFileSync('src/lib/kanab-quest-school-products-answers.ts','utf8')).toContain('server-only');
 });
 it('requires an argument for every activity and covers six exercises plus the lot investigation',()=>{
  for(const activity of activities)for(const step of activity.steps){refs(step.sourceIds,activity.id);for(const options of [step.choices,step.reasons??[]]){expect(options.length,activity.id).toBeGreaterThan(1);expect(options.some(o=>o.correct)).toBe(true);expect(options.some(o=>!o.correct)).toBe(true);for(const option of options)expect(option.feedback.length).toBeGreaterThan(15);}}
  for(const id of ['seeds-1','fibres-2','resins-2','labels-1','quality-2','traceability-1','traceability-2'])expect(lessonIds.has(`products-${id}`)).toBe(true);
 });
 it('resolves references with dates, actual access scope and glossary links',()=>{
  expect(sourceIds.size).toBe(sources.length);for(const s of sources){for(const text of [s.title,s.author,s.organization,s.published,s.passage,s.limitation,s.access,s.documentKind])expect(text.trim().length,s.id).toBeGreaterThan(0);expect(s.url).toMatch(/^(https?:\/\/|\/arene\/placard\?)/);expect(s.verifiedAt).toBe('2026-11-12');}
  for(const term of terms){refs(term.sourceIds,term.id);for(const id of term.lessonIds)expect(lessonIds.has(id),id).toBe(true);}
 });
 it('gives every atlas entry an origin, process, documented market scope and checks',()=>{
  expect(atlas.length).toBeGreaterThanOrEqual(20);expect(new Set(atlas.map(p=>p.id)).size).toBe(atlas.length);
  for(const family of ['seed','fibre','material','resin','extract','formulation','exposure','origin'])expect(atlas.some(p=>p.family===family),family).toBe(true);
  for(const p of atlas){for(const text of [p.origin,p.principle,p.marketEvidence])expect(text.length,p.id).toBeGreaterThan(15);for(const arr of [p.properties,p.limits,p.checks])expect(arr.length,p.id).toBeGreaterThan(0);refs(p.sourceIds,p.id);expect(p.regulationIds.length,p.id).toBeGreaterThan(0);for(const id of p.regulationIds)expect(regulations.some(r=>r.id===id),`${p.id}/${id}`).toBe(true);for(const id of p.relatedIds)expect(atlas.some(a=>a.id===id),`${p.id}/${id}`).toBe(true);}
 });
 it('dates regulatory scope without turning a scientific opinion into an authorization',()=>{
  for(const r of regulations){expect(r.checkedAt).toBe('2026-11-12');expect(r.territory.length).toBeGreaterThan(1);expect(r.distinction.length).toBeGreaterThan(20);expect(r.rule.length).toBeGreaterThan(20);expect(r.limits.length).toBeGreaterThan(0);expect(r.appliesTo.length).toBeGreaterThan(0);refs(r.sourceIds,r.id);}
  const text=regulations.map(r=>`${r.rule} ${r.distinction} ${r.limits.join(' ')}`).join(' ');expect(text).toMatch(/avis/i);expect(text).toMatch(/autorisation/i);expect(text).toMatch(/mg\/kg/);
 });
 it('keeps unit-bearing fictitious measurements separate from untested criteria',()=>{
  expect(certificate.title).toMatch(/fictif/i);expect(certificate.lot).toBe('H-A-261102');expect(certificate.rows).toHaveLength(6);expect(certificate.rows.filter(r=>r.status==='not-tested')).toHaveLength(4);
  for(const row of certificate.rows){if(row.status==='not-tested'){expect(row.result).toMatch(/^Non /);expect(row.unit).toBe('—');}else expect(row.unit).toBe('mg/kg');expect(row.note.length).toBeGreaterThan(15);}
  expect(certificate.rows.find(r=>r.id==='cbd')?.note).toMatch(/ni zéro ni absence/);expect(certificate.rows.find(r=>r.id==='thc')?.note).toMatch(/0,877/);expect(certificate.rows.find(r=>r.id==='thc')?.note).toMatch(/k = 2/);refs(certificate.sourceIds,certificate.id);
 });
 it('makes the certificate mismatch and missing evidence central to the investigation',()=>{
  expect(documents).toHaveLength(4);for(const d of documents)refs(d.sourceIds,d.id);expect(documents.find(d=>d.id==='batch')?.text).toContain('H-B-261109');expect(documents.find(d=>d.id==='report')?.text).toContain(certificate.lot);
  expect(investigation).toHaveLength(2);for(const q of investigation){for(const options of [q.choices,q.reasons]){expect(options.filter(o=>o.correct)).toHaveLength(1);for(const option of options)expect(option.feedback.length).toBeGreaterThan(20);}}
  expect(investigation[0].choices.find(c=>c.correct)?.id).toBe('limited');expect(investigation[1].choices.find(c=>c.correct)?.id).toBe('hold');
 });
 it('documents fibre operations, process limits and the six misleading claims',()=>{
  expect(stages.length).toBeGreaterThanOrEqual(4);expect(new Set(stages.map(s=>s.id)).size).toBe(stages.length);for(const s of stages){refs(s.sourceIds,s.id);expect(s.limit.length).toBeGreaterThan(15);expect(s.controls.length).toBeGreaterThan(0);expect(s.outputs.length).toBeGreaterThan(0);}
  expect(processes).toHaveLength(5);for(const p of processes){refs(p.sourceIds,p.id);expect(p.limit.length).toBeGreaterThan(20);}
  expect(claims).toHaveLength(6);for(const c of claims){refs(c.sourceIds,c.id);expect(c.why.length).toBeGreaterThan(40);}
 });
 it('ships six clearly separated illustrated points without relying on image text',()=>{
  expect(existsSync('public/placard/school/products/plate-v1.webp')).toBe(true);expect(points).toHaveLength(6);for(const p of points){refs(p.sourceIds,p.id);expect(lessonIds.has(p.lesson),p.id).toBe(true);}
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){const a=points[i],b=points[j];expect(Math.abs(a.x-b.x)*2.8>=36||Math.abs(a.y-b.y)*(280/150)>=36,`${a.id}/${b.id}`).toBe(true);}
 });
});
