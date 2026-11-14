import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { CULTIVATION_CHAPTERS as chapters,CULTIVATION_LESSONS as lessons,CULTIVATION_QUESTIONS as questions,CULTIVATION_TERMS as terms,CULTIVATION_SOURCES as sources,CULTIVATION_SYSTEMS as systems,CULTIVATION_CASES as cases,CULTIVATION_BALANCE as balance,CULTIVATION_GUIDE as guide,simulateCultivationScenario as simulate } from './kanab-quest-school-cultivation';
import { CULTIVATION_ANSWERS as answers } from './kanab-quest-school-cultivation-answers';
import { KQ_SCHOOL_CULTIVATION_LESSON_IDS,KQ_SCHOOL_CULTIVATION_ACTIVITY_IDS,KQ_SCHOOL_CULTIVATION_CHECKPOINT_IDS } from './kanab-quest-school-cultivation-progress';
import { KQ_BUDDIES } from './kanab-quest-game';
const sorted=(ids:readonly string[])=>[...ids].sort();
const sourceIds=new Set(sources.map(s=>s.id)),lessonIds=new Set(lessons.map(l=>l.id)),termIds=new Set(terms.map(t=>t.id));
const refs=(ids:readonly string[],label:string)=>{expect(ids.length,label).toBeGreaterThan(0);for(const id of ids)expect(sourceIds.has(id),`${label}: ${id}`).toBe(true);};
const activities=chapters.flatMap(c=>[...c.lessons.map(l=>l.activity),c.checkpoint]);
describe('Cultivation: comparable systems, authored reasoning and traceable boundaries',()=>{
  it('covers eight chapters with server-recognised lessons and checkpoints',()=>{
    expect(chapters).toHaveLength(8);expect(lessons).toHaveLength(16);expect(activities).toHaveLength(24);
    expect(sorted(lessons.map(l=>l.id))).toEqual(sorted(KQ_SCHOOL_CULTIVATION_LESSON_IDS));
    expect(sorted(lessons.map(l=>l.activity.id))).toEqual(sorted(KQ_SCHOOL_CULTIVATION_ACTIVITY_IDS));
    expect(sorted(chapters.map(c=>c.checkpoint.id))).toEqual(sorted(KQ_SCHOOL_CULTIVATION_CHECKPOINT_IDS));
    for(const lesson of lessons){expect(lesson.objective.length).toBeGreaterThan(10);for(const block of [...lesson.essential,...lesson.deeper,lesson.example])refs(block.sourceIds,lesson.id);refs(lesson.visual.sourceIds,lesson.id);for(const id of lesson.relatedLessonIds)expect(lessonIds.has(id),id).toBe(true);for(const id of lesson.glossaryIds)expect(termIds.has(id),id).toBe(true);for(const code of lesson.buddyCodes??[])expect(KQ_BUDDIES.some(b=>b.code===code),code).toBe(true);}
  });
  it('has 32 privately corrected questions without reopening a new reward',()=>{
    expect(questions).toHaveLength(32);expect(Object.keys(answers)).toHaveLength(32);expect(new Set(questions.map(q=>q.id)).size).toBe(32);
    for(const chapter of chapters)expect(questions.filter(q=>q.chapterId===chapter.id)).toHaveLength(4);
    for(const q of questions){expect(q.lessonId).toBe('genetics');expect(lessonIds.has(q.sectionId)).toBe(true);expect(q.options).toHaveLength(4);const key=answers[q.id];expect(q.options.some(o=>o.id===key.correctOptionId)).toBe(true);expect(sorted(Object.keys(key.optionExplanations))).toEqual(sorted(q.options.map(o=>o.id)));for(const explanation of Object.values(key.optionExplanations))expect(explanation.length).toBeGreaterThan(15);refs(q.sources.map(s=>s.id),q.id);}
    expect(readFileSync('src/lib/kanab-quest-school-cultivation-answers.ts','utf8')).toContain('import "server-only"');
  });
  it('requires reasons, corrects plausible errors and permits more than one coherent decision',()=>{
    for(const activity of activities)for(const step of activity.steps){refs(step.sourceIds,activity.id);for(const options of [step.choices,step.reasons??[]]){expect(options.length,activity.id).toBeGreaterThan(1);expect(options.some(o=>o.correct)).toBe(true);expect(options.some(o=>!o.correct)).toBe(true);for(const option of options)expect(option.feedback.length).toBeGreaterThan(15);}}
    for(const id of ['axes-1','climate-2','performance-2','footprint-2','decisions-2'])expect(lessons.some(l=>l.id===`cultivation-${id}`)).toBe(true);
    const decision=lessons.find(l=>l.id==='cultivation-decisions-2')!;
    expect(decision.activity.steps.some(s=>s.choices.filter(o=>o.correct).length>1)).toBe(true);
  });
  it('keeps citation access and the limits of transfer explicit',()=>{
    expect(sourceIds.size).toBe(sources.length);
    for(const s of sources){for(const text of [s.title,s.author,s.organization,s.published,s.passage,s.limitation,s.access,s.documentKind])expect(text.trim().length,s.id).toBeGreaterThan(0);expect(s.url).toMatch(/^(https?:\/\/|\/arene\/placard\?)/);expect(s.verifiedAt).toBe('2026-11-12');}
    for(const term of terms){refs(term.sourceIds,term.id);for(const id of term.lessonIds)expect(lessonIds.has(id),id).toBe(true);}
  });
  it('separates the three environments from the three root media',()=>{
    expect(systems).toHaveLength(8);expect(new Set(systems.map(s=>s.id)).size).toBe(8);
    expect(sorted([...new Set(systems.map(s=>s.environment))])).toEqual(['greenhouse','indoor','outdoor']);
    expect(sorted([...new Set(systems.map(s=>s.medium))])).toEqual(['soil','substrate','water']);
    expect(new Set(systems.filter(s=>s.environment==='greenhouse').map(s=>s.medium)).size).toBe(3);
    for(const system of systems){refs(system.sourceIds,system.id);for(const value of Object.values(system.traits))expect(value.length,system.id).toBeGreaterThan(15);expect(system.constraints.length).toBeGreaterThan(0);}
  });
  it('keeps cases fictional, constrained, sourced and connected to known systems',()=>{
    expect(cases).toHaveLength(3);expect(cases.some(c=>c.id==='brittany-fibre-seed')).toBe(true);
    for(const c of cases){expect(c.fictional).toBe(true);expect(c.constraints.length).toBeGreaterThan(2);refs(c.sourceIds,c.id);for(const option of c.options){expect(systems.some(s=>s.id===option.systemId)).toBe(true);expect(option.conditions.length).toBeGreaterThan(0);}}
    for(const item of guide){refs(item.sourceIds,item.id);for(const id of item.systems)expect(systems.some(s=>s.id===id),id).toBe(true);expect(item.limits.length).toBeGreaterThan(20);}
  });
  it('does not confuse energy, emissions or intensity in the toy balance',()=>{
    expect(balance.fictional).toBe(true);expect(balance.rows).toHaveLength(3);expect(balance.boundary.length).toBeGreaterThan(20);expect(balance.limits.length).toBeGreaterThan(0);
    for(const row of balance.rows){expect(row.outputKg).toBeGreaterThan(0);expect(row.energyPerKg).toBeCloseTo(row.energyKwh/row.outputKg);}
    const [a,b]=balance.rows;expect(b.energyKwh).toBeGreaterThan(a.energyKwh);expect(b.emissionsKgCo2e).toBeLessThan(a.emissionsKgCo2e);expect(a.emissionsKgCo2e/a.energyKwh).toBeCloseTo(.4);expect(b.emissionsKgCo2e/b.energyKwh).toBeCloseTo(.1);
  });
  it('changes qualitative questions with context while always exposing assumptions',()=>{
    const base={environment:'greenhouse',medium:'substrate',weather:'cool-humid',resources:'available',purpose:'education'} as const;
    const first=simulate(base),dry=simulate({...base,weather:'hot-dry'}),limited=simulate({...base,resources:'energy-limited'}),roots=simulate({...base,medium:'water'});
    expect(dry).not.toEqual(first);expect(limited).not.toEqual(first);expect(roots).not.toEqual(first);
    for(const result of [first,dry,limited,roots]){expect(result.assumptions.length).toBeGreaterThan(0);expect(result.limits.length).toBeGreaterThan(0);refs(result.sourceIds,'simulation');expect(Object.keys(result)).not.toEqual(expect.arrayContaining(['predictedYield','predictedProfit']));}
  });
});
