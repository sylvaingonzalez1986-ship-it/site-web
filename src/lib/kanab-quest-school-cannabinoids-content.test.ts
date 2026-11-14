import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CANNABINOID_CHAPTERS as chapters, CANNABINOID_LESSONS as lessons, CANNABINOID_QUESTIONS as questions, CANNABINOID_TERMS as terms, CANNABINOID_SOURCES as sources, CANNABINOID_COMPOUNDS as compounds, foldCannabinoidName } from "./kanab-quest-school-cannabinoids";
import { CANNABINOID_ANSWERS as answers } from "./kanab-quest-school-cannabinoids-answers";
import { CANNABINOID_STUDIES as studies } from "./kanab-quest-school-cannabinoids-studies";
import { CANNABINOID_NETWORK_NODES as nodes, CANNABINOID_NETWORK_EDGES as edges } from "./kanab-quest-school-cannabinoids-network";
import { KQ_SCHOOL_CANNABINOIDS_LESSON_IDS, KQ_SCHOOL_CANNABINOIDS_ACTIVITY_IDS, KQ_SCHOOL_CANNABINOIDS_CHECKPOINT_IDS } from "./kanab-quest-school-cannabinoids-progress";
import { KQ_BUDDIES } from "./kanab-quest-game";
const sourceIds=new Set(sources.map(source=>source.id)),lessonIds=new Set(lessons.map(lesson=>lesson.id)),termIds=new Set(terms.map(term=>term.id));
const activities=chapters.flatMap(chapter=>[...chapter.lessons.map(lesson=>lesson.activity),chapter.checkpoint]);
const refs=(ids:readonly string[],label:string)=>{expect(ids.length,label).toBeGreaterThan(0);for(const id of ids)expect(sourceIds.has(id),`${label}: ${id}`).toBe(true);};
const sorted=(ids:readonly string[])=>[...ids].sort();
describe("Cannabinoids: authored content, source traceability and study boundaries",()=>{
  it("covers the ten chapters and every server progression identifier",()=>{
    expect(chapters).toHaveLength(10);expect(lessons).toHaveLength(20);expect(activities).toHaveLength(30);
    expect(sorted(lessons.map(x=>x.id))).toEqual(sorted(KQ_SCHOOL_CANNABINOIDS_LESSON_IDS));
    expect(sorted(lessons.map(x=>x.activity.id))).toEqual(sorted(KQ_SCHOOL_CANNABINOIDS_ACTIVITY_IDS));
    expect(sorted(chapters.map(x=>x.checkpoint.id))).toEqual(sorted(KQ_SCHOOL_CANNABINOIDS_CHECKPOINT_IDS));
    for(const lesson of lessons){expect(lesson.objective.length,lesson.id).toBeGreaterThan(10);for(const block of [...lesson.essential,...lesson.deeper,lesson.example]){expect(block.text.length,lesson.id).toBeGreaterThan(35);refs(block.sourceIds,lesson.id);}refs(lesson.visual.sourceIds,lesson.id);for(const id of lesson.relatedLessonIds)expect(lessonIds.has(id),id).toBe(true);for(const id of lesson.glossaryIds)expect(termIds.has(id),id).toBe(true);}
  });
  it("contains 40 privately corrected questions and preserves reward evidence",()=>{
    expect(questions).toHaveLength(40);expect(Object.keys(answers)).toHaveLength(40);
    for(const chapter of chapters)expect(questions.filter(q=>q.chapterId===chapter.id)).toHaveLength(4);
    for(const q of questions){expect(q.lessonId).toBe("evidence");expect(lessonIds.has(q.sectionId)).toBe(true);expect(q.options).toHaveLength(4);const key=answers[q.id];expect(q.options.some(o=>o.id===key.correctOptionId)).toBe(true);expect(sorted(Object.keys(key.optionExplanations))).toEqual(sorted(q.options.map(o=>o.id)));for(const value of Object.values(key.optionExplanations))expect(value.length).toBeGreaterThan(15);refs(q.sources.map(s=>s.id),q.id);}
    expect(readFileSync("src/lib/kanab-quest-school-cannabinoids-answers.ts","utf8")).toContain('import "server-only"');
  });
  it("requires reasons in the six requested exercise types and corrects every choice",()=>{
    for(const activity of activities){expect(activity.steps.length,activity.id).toBeGreaterThan(0);for(const step of activity.steps){refs(step.sourceIds,activity.id);for(const options of [step.choices,...(step.reasons?[step.reasons]:[])]){expect(options.filter(o=>o.correct),activity.id).toHaveLength(1);for(const option of options)expect(option.feedback.length,activity.id).toBeGreaterThan(10);}}}
    for(const id of ["origins-1","acid-forms-1","biosynthesis-1","reading-studies-1","clinical-evidence-2","emerging-products-2"]){const lesson=lessons.find(x=>x.id===`cannabinoids-${id}`)!;expect(lesson.activity.steps.some(s=>s.reasons?.length),id).toBe(true);}
  });
  it("resolves sources with precise access scope and glossary backlinks",()=>{
    expect(sourceIds.size).toBe(sources.length);for(const s of sources){for(const field of [s.author,s.published,s.passage,s.access,s.documentKind,s.limitation])expect(field.trim().length,s.id).toBeGreaterThan(0);expect(s.url).toMatch(/^(https?:\/\/|\/arene\/placard\?)/);expect(s.verifiedAt).toBe("2026-11-12");}
    for(const t of terms){refs(t.sourceIds,t.id);for(const id of t.lessonIds)expect(lessonIds.has(id),id).toBe(true);}
    for(const lesson of lessons)for(const code of lesson.buddyCodes??[])expect(KQ_BUDDIES.some(b=>b.code===code),code).toBe(true);
  });
  it("separates required molecular identities and records presence limitations",()=>{
    for(const id of ["delta9-thc","delta9-thca-a","cbd","cbda","cbg","cbga","cbc","cbca","cbn","cbna","thcv","thcva","cbdv","cbdva","thcp","cbdp","hhc","anandamide","2-ag"])expect(compounds.some(x=>x.id===id),id).toBe(true);
    expect(new Set(compounds.map(x=>x.id)).size).toBe(compounds.length);
    for(const c of compounds){refs(c.sourceIds,c.id);refs(c.identity.sourceIds,c.id);expect(c.identity.distinction.length,c.id).toBeGreaterThan(20);expect(c.occurrence.length,c.id).toBeGreaterThan(0);for(const o of c.occurrence){refs(o.sourceIds,c.id);expect(o.limitation.length,c.id).toBeGreaterThan(15);expect(o.locator.length,c.id).toBeGreaterThan(3);}refs(c.humanEvidence.sourceIds,c.id);for(const m of c.mechanisms)refs(m.sourceIds,c.id);expect(c.risks.length,c.id).toBeGreaterThan(0);expect(c.unknowns.length,c.id).toBeGreaterThan(0);}
    expect(foldCannabinoidName("Δ9–THC")).toBe(foldCannabinoidName("delta9 THC"));
  });
  it("has source-linked network edges, process separation and visible uncertainty",()=>{
    const ids=new Set(nodes.map(x=>x.id));for(const edge of edges){expect(ids.has(edge.from),edge.id).toBe(true);expect(ids.has(edge.to),edge.id).toBe(true);refs(edge.sourceIds,edge.id);expect(edge.limitation.length,edge.id).toBeGreaterThan(15);expect(["supported","proposed"]).toContain(edge.evidenceStatus);}
    for(const kind of ["biosynthesis","decarboxylation","oxidation","metabolism","commercial-conversion"])expect(edges.some(x=>x.kind===kind),kind).toBe(true);
    expect(edges.some(x=>x.evidenceStatus==="proposed")).toBe(true);
    const neutral=nodes.find(x=>x.compoundId==="cbg")?.id;expect(edges.filter(x=>x.from===neutral&&x.kind==="biosynthesis")).toHaveLength(0);
    for(const node of nodes)if(node.compoundId)expect(compounds.some(x=>x.id===node.compoundId),node.id).toBe(true);
  });
  it("keeps study results, adverse events, funding and unknown fields explicit",()=>{
    expect(new Set(studies.map(x=>x.id)).size).toBe(studies.length);expect(studies.length).toBeGreaterThanOrEqual(11);for(const study of studies){for(const field of [study.question,study.publicationDate,study.observationDate,study.population,study.sample,study.formulation,study.comparator,study.duration,study.primaryEndpoint,study.results,study.uncertainty,study.adverseEvents,study.funding,study.limits,study.registration.note,study.cohortNote])expect(field.length,study.id).toBeGreaterThan(5);refs(study.sourceIds,study.id);for(const id of study.compoundIds)expect(compounds.some(x=>x.id===id),id).toBe(true);}
    expect(studies.some(x=>x.result==="negative")).toBe(true);expect(studies.some(x=>x.result==="mixed")).toBe(true);expect(studies.some(x=>x.model==="preclinical")).toBe(true);
  });
  it("does not count the HHC follow-up as an independent cohort",()=>{
    const first=studies.find(x=>x.id==="hhc-human-2025")!,second=studies.find(x=>x.id==="hhc-metabolites-2026")!;
    expect(first.cohortId).toBe(second.cohortId);expect(second.model).toBe("analytical");expect(second.cohortNote).toMatch(/ême cohorte/);expect(second.sample).toMatch(/aucune nouvelle cohorte/);
    expect(studies.find(x=>x.id==="cbg-acute-2024")!.cohortId).not.toBe(studies.find(x=>x.id==="cbg-laboratory-2026")!.cohortId);
  });
  it("retains the negative primary endpoint despite positive secondary CBN signals",()=>{
    const study=studies.find(x=>x.id==="cbn-sleep-2026")!;expect(study.result).toBe("mixed");expect(study.primaryEndpoint).toContain("WASO");expect(study.results).toContain("principal non significatif");expect(study.uncertainty).toContain("+5,5");
  });
  it("does not insert dosage recipes, processing parameters or unfinished content",()=>{
    const text=JSON.stringify([chapters,terms,compounds,studies,edges,answers]);expect(text).not.toMatch(/\uFFFD|TODO|lorem ipsum|À RÉDIGER/);expect(text).not.toMatch(/\b\d+(?:[.,]\d+)?\s*(?:mg\/kg|mg·kg|°C)/);
  });
});
