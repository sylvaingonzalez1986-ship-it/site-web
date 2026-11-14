import { readFileSync,existsSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { HEALTH_CHAPTERS as chapters,HEALTH_LESSONS as lessons,HEALTH_QUESTIONS as questions,HEALTH_TERMS as terms,HEALTH_SOURCES as sources } from './kanab-quest-school-health';
import { HEALTH_ANSWERS as answers } from './kanab-quest-school-health-answers';
import { HEALTH_ATLAS_ENTRIES as atlas } from './kanab-quest-school-health-atlas';
import { HEALTH_PHOTOS as photos,HEALTH_EPHY_RECORD as ephy,HEALTH_OBSERVATION_REQUESTS as requests } from './kanab-quest-school-health-documents';
import { KQ_SCHOOL_HEALTH_LESSON_IDS,KQ_SCHOOL_HEALTH_ACTIVITY_IDS,KQ_SCHOOL_HEALTH_CHECKPOINT_IDS } from './kanab-quest-school-health-progress';
import { KQ_BUDDIES } from './kanab-quest-game';
const sorted=(ids:readonly string[])=>[...ids].sort();
const sourceIds=new Set(sources.map(s=>s.id)),lessonIds=new Set(lessons.map(l=>l.id)),termIds=new Set(terms.map(t=>t.id));
const refs=(ids:readonly string[],label:string)=>{expect(ids.length,label).toBeGreaterThan(0);for(const id of ids)expect(sourceIds.has(id),`${label}: ${id}`).toBe(true);};
const activities=chapters.flatMap(c=>[...c.lessons.map(l=>l.activity),c.checkpoint]);
describe('Health curriculum: context, differential diagnosis and documentary evidence',()=>{
  it('connects all authored learning steps to server progress',()=>{
    expect(chapters).toHaveLength(8);expect(lessons).toHaveLength(16);expect(activities).toHaveLength(24);
    expect(sorted(lessons.map(l=>l.id))).toEqual(sorted(KQ_SCHOOL_HEALTH_LESSON_IDS));
    expect(sorted(lessons.map(l=>l.activity.id))).toEqual(sorted(KQ_SCHOOL_HEALTH_ACTIVITY_IDS));
    expect(sorted(chapters.map(c=>c.checkpoint.id))).toEqual(sorted(KQ_SCHOOL_HEALTH_CHECKPOINT_IDS));
    for(const l of lessons){for(const block of [...l.essential,...l.deeper,l.example])refs(block.sourceIds,l.id);refs(l.visual.sourceIds,l.id);for(const id of l.relatedLessonIds)expect(lessonIds.has(id),id).toBe(true);for(const id of l.glossaryIds)expect(termIds.has(id),id).toBe(true);for(const code of l.buddyCodes??[])expect(KQ_BUDDIES.some(b=>b.code===code),code).toBe(true);}
  });
  it('provides a privately corrected bank covering every chapter without changing reward identity',()=>{
    expect(questions).toHaveLength(32);expect(Object.keys(answers)).toHaveLength(32);expect(new Set(questions.map(q=>q.id)).size).toBe(32);
    for(const c of chapters)expect(questions.filter(q=>q.chapterId===c.id)).toHaveLength(4);
    for(const q of questions){expect(q.lessonId).toBe('biodiversity');expect(lessonIds.has(q.sectionId)).toBe(true);expect(q.options).toHaveLength(4);const a=answers[q.id];expect(q.options.some(o=>o.id===a.correctOptionId)).toBe(true);expect(sorted(Object.keys(a.optionExplanations))).toEqual(sorted(q.options.map(o=>o.id)));for(const explanation of Object.values(a.optionExplanations))expect(explanation.length).toBeGreaterThan(15);refs(q.sources.map(s=>s.id),q.id);}
    expect(readFileSync('src/lib/kanab-quest-school-health-answers.ts','utf8')).toContain('server-only');
  });
  it('requires explanations and makes uncertainty a valid conclusion',()=>{
    for(const activity of activities)for(const step of activity.steps){refs(step.sourceIds,activity.id);for(const options of [step.choices,step.reasons??[]]){expect(options.length,activity.id).toBeGreaterThan(1);expect(options.some(o=>o.correct)).toBe(true);expect(options.some(o=>!o.correct)).toBe(true);for(const option of options)expect(option.feedback.length).toBeGreaterThan(15);}}
    expect(activities.flatMap(a=>a.steps).flatMap(s=>s.choices).some(c=>c.correct&&/non confirm|insuffisan/i.test(c.text))).toBe(true);
    expect(requests).toHaveLength(4);expect(requests.some(r=>r.id==='analysis'&&r.finding.includes('Aucune analyse'))).toBe(true);
  });
  it('keeps every source and glossary link resolvable with access limits',()=>{
    expect(sourceIds.size).toBe(sources.length);
    for(const s of sources){for(const text of [s.title,s.author,s.organization,s.published,s.passage,s.limitation,s.access,s.documentKind])expect(text.trim().length,s.id).toBeGreaterThan(0);expect(s.url).toMatch(/^(https?:\/\/|\/arene\/placard\?)/);expect(s.verifiedAt).toBe('2026-11-12');}
    for(const term of terms){refs(term.sourceIds,term.id);for(const id of term.lessonIds)expect(lessonIds.has(id),id).toBe(true);}
  });
  it('covers the requested problem groups without omitting contextual evidence or differential diagnosis',()=>{
    expect(atlas.length).toBeGreaterThanOrEqual(24);expect(new Set(atlas.map(a=>a.id)).size).toBe(atlas.length);
    for(const kind of ['arthropod','mollusc','vertebrate','fungus','oomycete','virus','viroid','beneficial'])expect(atlas.some(a=>a.kind===kind),kind).toBe(true);
    for(const a of atlas){refs(a.sourceIds,a.id);for(const items of [a.organs,a.signs,a.conditions,a.spread,a.confusions,a.confirmation,a.prevention,a.management,a.limits])expect(items.length,a.id).toBeGreaterThan(0);for(const value of [a.scientificName,a.regionNote,a.taxonomyNote,a.lifeCycle])expect(value.length,a.id).toBeGreaterThan(0);expect(a.evidence.length).toBeGreaterThan(0);for(const evidence of a.evidence){refs(evidence.sourceIds,a.id);expect(evidence.context.length).toBeGreaterThan(0);expect(evidence.limitation.length).toBeGreaterThan(0);}}
  });
  it('does not conflate fungi, oomycetes, viroids or molecular detection with proven damage',()=>{
    expect(atlas.find(a=>a.id==='pythium-globisporangium')?.kind).toBe('oomycete');
    expect(atlas.find(a=>a.id==='hop-latent-viroid')?.kind).toBe('viroid');
    expect(atlas.find(a=>a.id==='citrus-yellow-vein-associated-virus')?.role).toBe('contextual');
    expect(atlas.filter(a=>a.role==='beneficial')).toHaveLength(4);
  });
  it('ships actual credited images and separates historical labels from current taxonomy',()=>{
    expect(photos).toHaveLength(4);
    for(const photo of photos){expect(existsSync(`public${photo.src}`),photo.id).toBe(true);expect(photo.license).toBe('https://creativecommons.org/licenses/by/4.0/');expect(photo.credit.length).toBeGreaterThan(30);expect(photo.limit.length).toBeGreaterThan(30);refs(photo.sourceIds,photo.id);for(const id of photo.atlasIds)expect(atlas.some(a=>a.id===id),id).toBe(true);}
    expect(photos.find(p=>p.id==='powdery')?.context).toContain('provisoirement');
    expect(photos.find(p=>p.id==='experiment')?.context).toContain('Expérience');
  });
  it('dates the regulatory snapshot separately from authorization and distinguishes generic crop scope from product conditions',()=>{
    refs(ephy.sourceIds,'E-Phy');expect(ephy.checkedAt).not.toBe(ephy.updatedAt);expect(ephy.authorizedAt).not.toBe(ephy.checkedAt);expect(ephy.usageCode).toBe('11012903');
    expect(ephy.fields.find(([label])=>label==='Cible')?.[1]).toContain('ne couvre pas les thrips');
    expect(ephy.fields.find(([label])=>label==='Culture ou groupe indiqué')?.[1]).toContain('donc le chanvre');
  });
});
