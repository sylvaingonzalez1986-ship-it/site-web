import { describe, expect, it } from "vitest";
import { FARM_GUIDE_CHAPTERS, getFarmGuideAdvice, getFarmGuideChapter, parseFarmGuide } from "./kanab-quest-farm-guide";

describe("farm guide persistence", () => {
  it("starts inactive without inventing completed actions", () => {
    expect(parseFarmGuide(null)).toEqual({ version: 1, active: false, read: [] });
  });
  it.each(["broken", "null", '{"version":2,"active":true,"read":[]}', '{"version":1,"active":true,"read":["unknown"]}', '{"version":1,"active":"yes","read":[]}'])("preserves unreadable/future saves: %s", raw => {
    expect(parseFarmGuide(raw)).toBeNull();
  });
  it("resumes or pauses independently of game progress and deduplicates read markers", () => {
    expect(parseFarmGuide('{"version":1,"active":false,"read":["culture","culture","arrival"]}')).toEqual({ version: 1, active: false, read: ["culture", "arrival"] });
  });
});

describe("contextual story", () => {
  it("explains the staff panel being read while keeping payroll in Personnel and trim in the Atelier", () => {
    const chapter = getFarmGuideChapter({ view: "staff" });
    const recruiting = getFarmGuideAdvice(chapter, { staffTab: "candidates" });
    expect(recruiting.target).toBe("[data-staff-profile]");
    expect(recruiting.instruction).toContain("rien n’est signé avant ta confirmation");
    const team = getFarmGuideAdvice(chapter, { staffTab: "team" });
    expect(team.instruction).toContain("même réserve d’heures");
    expect(team.instruction).toContain("Entrepôt → Atelier → Trim");
    const payroll = getFarmGuideAdvice(chapter, { staffTab: "payroll" });
    expect(payroll.target).toBe("[data-staff-panel=payroll]");
    expect(payroll.instruction).toContain("même sans mission");
    expect(payroll.instruction).toContain("Règle les salaires dans Personnel");
  });
  it("covers every main destination and distinguishes financial and commerce subpages", () => {
    for (const chapter of FARM_GUIDE_CHAPTERS) expect(getFarmGuideChapter(chapter)).toBe(chapter);
    expect(getFarmGuideChapter({ view: "market", section: "overview" }).id).toBe("sale");
    expect(getFarmGuideChapter({ view: "treasury" }).id).toBe("accounts");
  });
  it("keeps actual culture preparation ahead of any initial phase", () => {
    expect(getFarmGuideAdvice(getFarmGuideChapter({ view: "game" }), { preparation: true, phase: "prepare" }).title).toBe("Préparer avant de lancer");
  });
  it.each(["prepare", "rolled", "resolved"])("follows the displayed culture phase %s", phase => {
    const text = getFarmGuideAdvice(getFarmGuideChapter({ view: "game" }), { phase });
    expect(text.title).not.toBe("Culture");
    expect(text.instruction).not.toContain("culture est terminée");
  });
  it("does not call a failed culture a harvested lot", () => {
    expect(getFarmGuideAdvice(getFarmGuideChapter({ view: "game" }), { cultureDead: true, harvested: true }).title).toBe("Comprendre ce qui s’est passé");
  });
  it("explains a refusal before any apparent success", () => {
    expect(getFarmGuideAdvice(getFarmGuideChapter({ view: "market" }), { error: true, commerce: "receipt" }).target).toBe("[role=alert]");
  });
  it("does not infer empty storage from missing data", () => {
    const chapter = getFarmGuideChapter({ view: "harvests" });
    expect(getFarmGuideAdvice(chapter, {}).instruction).not.toContain("pas encore de lot");
    expect(getFarmGuideAdvice(chapter, { storageEmpty: true }).instruction).toContain("pas encore de lot");
  });
  it("keeps curing before jury and explains consumption before entering a duel", () => {
    const chapter = getFarmGuideChapter({ view: "arena" });
    expect(getFarmGuideAdvice(chapter, { curing: true }).target).toBe("[data-culture-open-storage]");
    expect(getFarmGuideAdvice(chapter, {}).instruction).toContain("stock récolté reste conservé");
    expect(FARM_GUIDE_CHAPTERS.findIndex(c => c.id === "storage")).toBeLessThan(FARM_GUIDE_CHAPTERS.findIndex(c => c.id === "jury"));
  });
  it("distinguishes an offer from a receipt and does not announce sales early", () => {
    const chapter = getFarmGuideChapter({ view: "market" });
    expect(getFarmGuideAdvice(chapter, { commerce: "offer" }).instruction).toContain("avant toute vente");
    expect(getFarmGuideAdvice(chapter, { commerce: "receipt" }).instruction).toContain("montant versé");
  });
  it.each(["loans", "savings", "crypto", "stocks"])("introduces the actual bank desk: %s", bank => {
    const advice = getFarmGuideAdvice(getFarmGuideChapter({ view: "treasury", pole: "bank" }), { bank });
    expect(advice.target).toBe("[id^=bank-panel-]");
    if (bank !== "loans") expect(advice.instruction).not.toContain("emprunt");
  });
  it("explains an empty plan and an uncommitted draft before following the generic zone instructions", () => {
    const chapter = getFarmGuideChapter({ view: "workshop" });
    expect(getFarmGuideAdvice(chapter, { room: "culture", emptyPlan: true }).title).toBe("Dessiner ta première zone");
    expect(getFarmGuideAdvice(chapter, { room: "culture", planDraft: true }).target).toBe("[data-warehouse-plan-review]");
  });
  it("places trim in the workshop while Personnel explains team management", () => {
    const workshop = getFarmGuideAdvice(getFarmGuideChapter({ view: "workshop" }), { room: "processing" });
    expect(workshop).toMatchObject({ title: "Préparer les récoltes à l’Atelier", target: "[data-warehouse-workshop]" });
    expect(workshop.instruction).toContain("Dans Trim");
    expect(workshop.instruction).toContain("toi-même ou choisis un salarié");
    const personnel = getFarmGuideAdvice(getFarmGuideChapter({ view: "staff" }), {});
    expect(personnel.instruction).not.toMatch(/trim/i);
    expect(personnel.instruction).toContain("contrat");
    expect(personnel.instruction).toContain("salaires à régler");
  });
});
