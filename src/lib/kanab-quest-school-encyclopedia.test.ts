import { describe, expect, it } from "vitest";
import { SCHOOL_ENCYCLOPEDIA_SHELVES, loadSchoolEncyclopediaIndex, normalizeSchoolSearch, schoolEncyclopediaLetter, searchSchoolEncyclopedia } from "./kanab-quest-school-encyclopedia";

describe("school encyclopedia discovery", () => {
  it("keeps the nine existing curricula, all articles and every lexicon entry reachable", async () => {
    const index = await loadSchoolEncyclopediaIndex();
    expect(SCHOOL_ENCYCLOPEDIA_SHELVES.map(shelf => shelf.courseId)).toEqual(["history", "plant", "molecules", "evidence", "genetics", "biodiversity", "uses", "profiles", "prevention"]);
    expect(index.articleCount).toBe(168);
    expect(index.termCount).toBe(470);
    expect(new Set(index.entries.map(entry => entry.id)).size).toBe(index.entries.length);
    for (const shelf of SCHOOL_ENCYCLOPEDIA_SHELVES) {
      expect(index.entries.filter(entry => entry.shelfId === shelf.id && entry.kind === "article")).toHaveLength(shelf.lessonCount);
      expect(index.entries.filter(entry => entry.shelfId === shelf.id).every(entry => entry.courseId === shelf.courseId)).toBe(true);
    }
  });
  it("finds the same content with accented or plain French spelling", async () => {
    const index = await loadSchoolEncyclopediaIndex();
    const accented = searchSchoolEncyclopedia(index, { query: "FÉCONDATION", kind: "term" });
    const plain = searchSchoolEncyclopedia(index, { query: "fecondation", kind: "term" });
    expect(accented.total).toBeGreaterThan(0);
    expect(accented).toEqual(plain);
    expect(normalizeSchoolSearch("Œuvre, α-pinène et β−caryophyllène")).toBe(normalizeSchoolSearch("oeuvre alpha pinene et beta caryophyllene"));
  });
  it("finds a topic inside an article and retains its precise reader destination", async () => {
    const index = await loadSchoolEncyclopediaIndex();
    const result = searchSchoolEncyclopedia(index, { query: "Noyal", shelfId: "history", kind: "article" });
    expect(result.items.some(entry => entry.passageId.startsWith("history-brittany-") && entry.courseId === "history")).toBe(true);
    expect(result.items.every(entry => entry.kind === "article" && entry.shelfId === "history")).toBe(true);
    expect(searchSchoolEncyclopedia(index, { query: "Noyal", shelfId: "cannabinoids", kind: "article" }).total).toBe(0);
  });
  it("opens the original tool through the course ID, not the curriculum ID", async () => {
    const index = await loadSchoolEncyclopediaIndex();
    const result = searchSchoolEncyclopedia(index, { query: "registre moléculaire", kind: "tool" });
    expect(result.items[0]).toMatchObject({ courseId: "evidence", passageId: "cannabinoids-register", kind: "tool" });
    const term = searchSchoolEncyclopedia(index, { query: "fécondation", shelfId: "botany", kind: "term" }).items[0];
    expect(term.courseId).toBe("plant");
    expect(term.passageId).toMatch(/^botany-/);
  });
  it("can open a molecule or variety dossier directly from the common search", async () => {
    const index = await loadSchoolEncyclopediaIndex();
    expect(searchSchoolEncyclopedia(index, { query: "myrcène", kind: "record" }).items.some(entry => entry.courseId === "molecules" && entry.passageId.startsWith("compound-"))).toBe(true);
    expect(searchSchoolEncyclopedia(index, { query: "Haze", shelfId: "botany", kind: "record" }).items.some(entry => entry.courseId === "plant" && /haze/.test(entry.passageId))).toBe(true);
    const oils = searchSchoolEncyclopedia(index, { query: "huile", shelfId: "products", kind: "record" });
    expect(oils.total).toBeGreaterThan(0);
    expect(oils.items.every(entry => entry.passageId.startsWith("products-atlas-") && entry.courseId === "profiles")).toBe(true);
    expect(index.recordCount).toBeGreaterThan(100);
  });
  it("paginates the complete result set without dropping later entries", async () => {
    const index = await loadSchoolEncyclopediaIndex();
    const first = searchSchoolEncyclopedia(index, { kind: "term", page: 1 });
    const second = searchSchoolEncyclopedia(index, { kind: "term", page: 2 });
    expect(first.total).toBe(470);
    expect(first.items).toHaveLength(12);
    expect(second.items).toHaveLength(12);
    expect(second.items.some(entry => first.items.some(previous => previous.id === entry.id))).toBe(false);
    const allEntries = Array.from({ length: first.pages }, (_, page) => searchSchoolEncyclopedia(index, { kind: "term", page: page + 1 }).items).flat();
    expect(new Set(allEntries.map(entry => entry.id)).size).toBe(first.total);
    const final = searchSchoolEncyclopedia(index, { kind: "term", page: 9999 });
    expect(final.page).toBe(final.pages);
    expect((final.pages - 1) * 12 + final.items.length).toBe(first.total);
  });
  it("does not turn punctuation or an unknown word into all results", async () => {
    const index = await loadSchoolEncyclopediaIndex();
    expect(searchSchoolEncyclopedia(index, { query: "!!!" }).total).toBe(0);
    expect(searchSchoolEncyclopedia(index, { query: "notion-inexistante-zzzz" }).total).toBe(0);
  });
  it("lists every article once in its original chapter without sending readers to course indexes", async () => {
    const index = await loadSchoolEncyclopediaIndex();
    const ids = index.chapters.flatMap(chapter => chapter.articleIds);
    expect(ids).toHaveLength(index.articleCount);
    expect(new Set(ids).size).toBe(index.articleCount);
    for (const chapter of index.chapters) {
      expect(chapter.title).toBeTruthy();
      for (const id of chapter.articleIds) {
        const entry = index.entries.find(item => item.id === id);
        expect(entry).toMatchObject({ kind: "article", shelfId: chapter.shelfId });
        expect(entry?.passageId).not.toMatch(/-index$/);
        expect(entry?.minutes).toBeGreaterThan(0);
      }
    }
  });
  it("places every definition in one alphabetic group, including accents, ligatures and Greek prefixes", async () => {
    const index = await loadSchoolEncyclopediaIndex();
    expect(schoolEncyclopediaLetter("Évaporation")).toBe("E");
    expect(schoolEncyclopediaLetter("Œil")).toBe("O");
    expect(schoolEncyclopediaLetter("β-pinène")).toBe("B");
    expect(schoolEncyclopediaLetter("2-AG")).toBe("#");
    const letters = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "#"];
    const grouped = letters.flatMap(letter => index.entries.filter(entry => entry.kind === "term" && schoolEncyclopediaLetter(entry.title) === letter));
    expect(grouped).toHaveLength(470);
    expect(new Set(grouped.map(entry => entry.id)).size).toBe(470);
  });
  it("prioritizes matching titles and articles over tools for otherwise equal search matches", async () => {
    const original = await loadSchoolEncyclopediaIndex();
    const base = original.entries[0];
    const index = { ...original, entries: [
      { ...base, id: "tool", kind: "tool" as const, title: "Outil", searchText: "racine" },
      { ...base, id: "article", kind: "article" as const, title: "La plante", searchText: "racine" },
      { ...base, id: "term", kind: "term" as const, title: "Racine", searchText: "racine" },
    ] };
    expect(searchSchoolEncyclopedia(index, { query: "racine" }).items.map(entry => entry.id)).toEqual(["term", "article", "tool"]);
  });
});
