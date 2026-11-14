import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TERPENE_CHAPTERS, TERPENE_LESSONS, TERPENE_QUESTIONS, TERPENE_TERMS, TERPENE_SOURCES, TERPENE_COMPOUNDS, TERPENE_CORPUS, TERPENE_CROSSWORD, TERPENE_BUDDY_LINKS, foldTerpeneName } from "./kanab-quest-school-terpenes";
import { TERPENE_ANSWERS } from "./kanab-quest-school-terpenes-answers";
import { KQ_SCHOOL_TERPENES_LESSON_IDS, KQ_SCHOOL_TERPENES_ACTIVITY_IDS, KQ_SCHOOL_TERPENES_CHECKPOINT_IDS } from "./kanab-quest-school-terpenes-progress";
import { getKqBuddieVariety } from "./kanab-quest-buddie-varieties";
import type { HistoryChoice } from "./kanab-quest-school-history-types";

const sources = new Set(TERPENE_SOURCES.map(source => source.id));
const lessons = new Set(TERPENE_LESSONS.map(lesson => lesson.id));
const terms = new Set(TERPENE_TERMS.map(term => term.id));
const activities = TERPENE_CHAPTERS.flatMap(chapter => [...chapter.lessons.map(lesson => lesson.activity), chapter.checkpoint]);
const sorted = (items: readonly string[]) => [...items].sort();
function refs(ids: readonly string[], label: string) { expect(ids.length,label).toBeGreaterThan(0); for(const id of ids) expect(sources.has(id),`${label}: ${id}`).toBe(true); }
function choiceSet(choices: readonly HistoryChoice[], label: string) { expect(choices.filter(choice => choice.correct),label).toHaveLength(1); expect(new Set(choices.map(choice=>choice.id)).size,label).toBe(choices.length); for(const choice of choices) expect(choice.feedback.trim().length,label).toBeGreaterThan(15); }
describe("Terpenes authored curriculum and documented inventory", () => {
  it("covers the ten requested chapters with meaningful lesson and checkpoint bodies", () => {
    expect(TERPENE_CHAPTERS.map(chapter=>chapter.id)).toEqual(["vocabulary","chemistry","classes","trichomes","profiles","mixtures","identification","transformation","claims","non-terpenes"]);
    expect(TERPENE_LESSONS).toHaveLength(20); expect(activities).toHaveLength(30);
    for(const lesson of TERPENE_LESSONS) {
      for(const field of [lesson.title,lesson.question,lesson.objective,lesson.nextQuestion,lesson.visual.caption]) expect(field.trim().length,lesson.id).toBeGreaterThan(12);
      expect(lesson.essential.length,lesson.id).toBeGreaterThan(0); expect(lesson.deeper.length,lesson.id).toBeGreaterThan(0);
      for(const block of [...lesson.essential,...lesson.deeper,lesson.example]) { expect(block.text.length,lesson.id).toBeGreaterThan(50); refs(block.sourceIds,lesson.id); }
      refs(lesson.visual.sourceIds,lesson.id); for(const id of lesson.relatedLessonIds) expect(lessons.has(id),id).toBe(true); for(const id of lesson.glossaryIds) expect(terms.has(id),id).toBe(true);
    }
  });
  it("provides forty private keys and all 160 option corrections with stable budget identity", () => {
    expect(TERPENE_QUESTIONS).toHaveLength(40); expect(Object.keys(TERPENE_ANSWERS)).toHaveLength(40);
    for(const chapter of TERPENE_CHAPTERS) expect(TERPENE_QUESTIONS.filter(q=>q.chapterId===chapter.id)).toHaveLength(4);
    for(const question of TERPENE_QUESTIONS) {
      expect(question.lessonId).toBe("molecules"); expect(lessons.has(question.sectionId)).toBe(true); expect(question.options).toHaveLength(4); refs(question.sources.map(source=>source.id),question.id);
      const answer = TERPENE_ANSWERS[question.id]; expect(answer,question.id).toBeDefined(); expect(question.options.some(option=>option.id===answer.correctOptionId)).toBe(true);
      expect(sorted(Object.keys(answer.optionExplanations))).toEqual(sorted(question.options.map(option=>option.id))); for(const explanation of Object.values(answer.optionExplanations)) expect(explanation.length).toBeGreaterThan(15);
    }
    expect(readFileSync("src/lib/kanab-quest-school-terpenes-answers.ts","utf8")).toContain('import "server-only"');
  });
  it("requires explicit answer reasons and feedback in the structured exercises", () => {
    for(const activity of activities) { expect(activity.steps.length,activity.id).toBeGreaterThan(0); expect(activity.evaluates.length,activity.id).toBeGreaterThan(12); for(const step of activity.steps) { choiceSet(step.choices,activity.id); if(step.reasons) choiceSet(step.reasons,activity.id); refs(step.sourceIds,activity.id); } }
    for(const id of ["terpenes-vocabulary-activity-1","terpenes-classes-activity-1","terpenes-non-terpenes-activity-1","terpenes-profiles-activity-1","terpenes-claims-activity-2"]) { const activity=activities.find(item=>item.id===id)!; expect(activity,id).toBeDefined(); expect(activity.steps.some(step=>step.reasons?.length),id).toBe(true); }
  });
  it("aligns every completion id with the server progress contract", () => {
    expect(sorted(TERPENE_LESSONS.map(lesson=>lesson.id))).toEqual(sorted(KQ_SCHOOL_TERPENES_LESSON_IDS));
    expect(sorted(TERPENE_LESSONS.map(lesson=>lesson.activity.id))).toEqual(sorted(KQ_SCHOOL_TERPENES_ACTIVITY_IDS));
    expect(sorted(TERPENE_CHAPTERS.map(chapter=>chapter.checkpoint.id))).toEqual(sorted(KQ_SCHOOL_TERPENES_CHECKPOINT_IDS));
  });
  it("declares access extent, passage, authorship and limitations for every source", () => {
    expect(sources.size).toBe(TERPENE_SOURCES.length);
    for(const source of TERPENE_SOURCES) { for(const field of [source.title,source.author,source.published,source.passage,source.limitation,source.documentKind]) expect(field.trim().length,source.id).toBeGreaterThan(0); expect(source.verifiedAt).toBe("2026-11-12"); expect(source.url).toMatch(/^(https?:\/\/|\/)/); expect(["full-text","abstract","catalogue","official-page","excerpt"]).toContain(source.access); }
    for(const term of TERPENE_TERMS) { refs(term.sourceIds,term.id); for(const id of term.lessonIds) expect(lessons.has(id),id).toBe(true); }
  });
  it("contains at least 25 substantive records and a distinct complementary inventory", () => {
    const detailed=TERPENE_COMPOUNDS.filter(item=>item.detailLevel==="detailed"); expect(detailed.length).toBeGreaterThanOrEqual(25); expect(TERPENE_COMPOUNDS.length).toBeGreaterThan(detailed.length);
    expect(new Set(TERPENE_COMPOUNDS.map(item=>item.id)).size).toBe(TERPENE_COMPOUNDS.length);
    for(const item of TERPENE_COMPOUNDS) { expect(item.cannabisEvidence.length,item.id).toBeGreaterThan(0); expect(item.identification.statement.length,item.id).toBeGreaterThan(25); expect(item.isomerNotes.length,item.id).toBeGreaterThan(20); expect(item.identification.limitations.length,item.id).toBeGreaterThan(0); expect(item.aroma.limitations.length,item.id).toBeGreaterThan(20); refs(item.sourceIds,item.id); refs(item.identification.sourceIds,item.id); for(const record of item.cannabisEvidence) { refs(record.sourceIds,item.id); expect(record.locator.length,item.id).toBeGreaterThan(5); } }
    for(const item of detailed) { expect(item.aroma.description.length,item.id).toBeGreaterThan(3); expect(item.otherPlants.length,item.id).toBeGreaterThan(0); for(const record of item.otherPlants) refs(record.sourceIds,item.id); expect(item.biology.length,item.id).toBeGreaterThan(0); for(const record of item.biology) { refs(record.sourceIds,item.id); expect(record.limitations.length,item.id).toBeGreaterThan(15); } }
  });
  it("preserves sensory references and supported/uncertain identification levels", () => {
    for(const item of TERPENE_COMPOUNDS) { expect(["reference-standard","ri-ms-supported","tentative","not-established"]).toContain(item.identification.level); if(item.aroma.families.length) refs(item.aroma.sourceIds,item.id); for(const record of item.biology) expect(["plant-enzyme","plant-ecology","cell","animal","human","analytical"]).toContain(record.model); }
    expect(TERPENE_COMPOUNDS.some(item=>item.identification.level==="tentative")).toBe(true);
  });
  it("covers the requested names without counting spelling variants as separate molecules", () => {
    const corpus=foldTerpeneName(TERPENE_COMPOUNDS.map(item=>[item.name,...item.synonyms].join(" ")).join(" "));
    for(const name of ["myrcene","limonene","pinene","terpinolene","ocimene","terpinene","caryophyllene","humulene","farnesene","bergamotene","selinene","linalol","nerolidol","guaiol","bisabolol","terpineol","borneol","fenchol","eudesmol"]) expect(corpus,name).toContain(name);
    expect(foldTerpeneName("β-pinène")).toBe(foldTerpeneName("beta pinene")); expect(foldTerpeneName("α–Humulène")).toBe("alpha humulene");
    expect(TERPENE_COMPOUNDS.find(item=>item.id==="alphapinene")).toBeDefined(); expect(TERPENE_COMPOUNDS.find(item=>item.id==="betapinene")).toBeDefined();
  });
  it("makes the corpus date, exclusions and synonym rules reviewable", () => {
    expect(TERPENE_CORPUS.checkedAt).toBe("2026-11-12"); expect(TERPENE_CORPUS.inclusionRules.length).toBeGreaterThan(0); expect(TERPENE_CORPUS.exclusions.length).toBeGreaterThan(0); expect(TERPENE_CORPUS.synonymRules.length).toBeGreaterThan(0); expect(TERPENE_CORPUS.limitations.length).toBeGreaterThan(0); refs(TERPENE_CORPUS.sourceIds,"corpus");
  });
  it("uses existing Buddies and known compounds with attributed descriptions", () => {
    expect(TERPENE_BUDDY_LINKS.length).toBeGreaterThan(0);
    for(const link of TERPENE_BUDDY_LINKS) { expect(getKqBuddieVariety(link.buddyCode),link.buddyCode).toBeDefined(); expect(link.exactExcerpt.length).toBeGreaterThan(3); expect(link.attribution.length).toBeGreaterThan(10); expect(link.limitation.length).toBeGreaterThan(25); refs(link.sourceIds,link.buddyCode); for(const id of link.compoundIds) expect(TERPENE_COMPOUNDS.find(item=>item.id===id),id).toBeDefined(); }
  });
  it("has a connected crossword with consistent crossings and no cell outside the grid", () => {
    const cells=new Map<string,{letter:string;words:number[]}>(); const edges=new Map<number,Set<number>>();
    TERPENE_CROSSWORD.entries.forEach((entry,index)=>{edges.set(index,new Set()); for(const [offset,letter] of [...entry.answer].entries()) { const row=entry.row+(entry.direction==="down"?offset:0),col=entry.col+(entry.direction==="across"?offset:0); expect(row).toBeLessThan(TERPENE_CROSSWORD.height); expect(col).toBeLessThan(TERPENE_CROSSWORD.width); expect(row).toBeGreaterThanOrEqual(0); expect(col).toBeGreaterThanOrEqual(0); const key=`${row}:${col}`,previous=cells.get(key); if(previous) { expect(previous.letter,`${key}/${entry.answer}`).toBe(letter); for(const peer of previous.words) { edges.get(peer)!.add(index); edges.get(index)!.add(peer); } } cells.set(key,{letter,words:[...(previous?.words??[]),index]}); } });
    const visited=new Set<number>(); const walk=(id:number)=>{if(visited.has(id))return;visited.add(id);for(const peer of edges.get(id)!)walk(peer);};walk(0);expect(visited.size).toBe(TERPENE_CROSSWORD.entries.length);expect(cells.size).toBeLessThan(TERPENE_CROSSWORD.entries.reduce((sum,entry)=>sum+entry.answer.length,0));
  });
  it("contains no replacement glyphs or unresolved placeholder prose", () => {
    const text=JSON.stringify([TERPENE_CHAPTERS,TERPENE_TERMS,TERPENE_SOURCES,TERPENE_COMPOUNDS,TERPENE_CORPUS,TERPENE_ANSWERS]);expect(text).not.toMatch(/\uFFFD|TODO|lorem ipsum|À RÉDIGER/);
  });
});
