import { describe, expect, it } from "vitest";
import { getKqSocialAdventure, getKqSocialSubjects } from "./kanab-quest-social-adventure";
import { applyKqSocialCommand, createKqSocialSnapshot, isKqSocialSnapshot, normalizeKqSocialSnapshot, parseKqSocialCommand } from "./kanab-quest-social";
import { createKqSocialCultureContext, type KqSocialCultureRun, type KqSocialCultureLot } from "./kanab-quest-social-culture";
import { getKqSocialFeed, getKqSocialFeedOutcome } from "./kanab-quest-social-feed";
import { getKqSocialProducerNarrative, KQ_SOCIAL_PRODUCER_NARRATIVES } from "./kanab-quest-social-producer";
import { KQ_SOCIAL_SCENARIOS, KQ_SOCIAL_V2_SCENARIOS } from "./kanab-quest-social-stories";
import type { KqSocialCommand, KqSocialPlatform, KqSocialSnapshot } from "./kanab-quest-social-types";

const now = Date.parse("2026-10-24T14:00:00Z");
const stamp = new Date(now).toISOString();
const run = (overrides: Partial<KqSocialCultureRun> = {}): KqSocialCultureRun => ({
  id: "run-1", zoneId: "zone-1", zoneName: "Petit placard", varietyCode: "VAR-TEST", varietyName: "Brume",
  cultivation: "indoor", stageIndex: 2, phase: "prepare", updatedAt: stamp, cultureDead: false, ...overrides,
});
const lot = (overrides: Partial<KqSocialCultureLot> = {}): KqSocialCultureLot => ({
  id: "lot-1", runId: "old-run", varietyCode: "VAR-LOT", varietyName: "Aube", cultivation: "indoor", stage: "curing",
  harvestGrams: 125, remainingGrams: 80, harvestedAt: new Date(now - 86_400_000).toISOString(), ...overrides,
});
function state(runs: KqSocialCultureRun[] = [], lots: KqSocialCultureLot[] = []) {
  const snapshot = createKqSocialSnapshot(now);
  snapshot.culture = { ...createKqSocialCultureContext(now, "own"), runs, lots };
  return snapshot;
}
function choose(snapshot: KqSocialSnapshot, platform: KqSocialPlatform, choice = 0, subjectId?: string): KqSocialCommand {
  const adventure = getKqSocialAdventure(snapshot, platform, subjectId);
  return { modelVersion: 2, requestKey: `90000000-0000-4000-8000-${String(snapshot.revision + 1).padStart(12, "0")}`,
    expectedRevision: snapshot.revision, action: "choose", platform, scenarioId: adventure.scene.id,
    choiceId: adventure.scene.choices[choice].id, narrativeVersion: 3, subjectId: adventure.subject?.id, contextKey: adventure.contextKey };
}

describe("producer adventures use the player's observed culture", () => {
  it("does not reopen the account on every lap while the player has no crop to show", () => {
    let snapshot = state();
    const published: string[] = [];
    for (let index = 0; index < 7; index++) {
      const adventure = getKqSocialAdventure(snapshot, "instagram");
      const care = adventure.scene.choices.findIndex(choice => choice.intent === "care");
      snapshot = applyKqSocialCommand(snapshot, choose(snapshot, "instagram", care), now + index * 300_000);
      published.push(snapshot.history[0].scenarioId);
    }
    expect(published.filter(id => id === "ig-first-frame")).toHaveLength(1);
    expect(published[6]).toBe("ig-feed-overload");
  });
  it("keeps general topics playable with no culture, unavailable data or a borrowed exercise", () => {
    for (const source of ["own", "loan", "unknown"] as const) {
      const snapshot = state(); snapshot.culture!.source = source;
      for (const platform of ["instagram", "x"] as const) {
        const adventure = getKqSocialAdventure(snapshot, platform);
        expect(adventure.subject?.requirement).toBe("general");
        expect(JSON.stringify(getKqSocialFeed(adventure.scene))).not.toMatch(/\{\{(?:variety|stage|problem|harvestGrams)/);
        expect(isKqSocialSnapshot(applyKqSocialCommand(snapshot, choose(snapshot, platform), now))).toBe(true);
      }
    }
  });
  it("distinguishes flowering, visible symptoms, dead cultures and actual stored lots", () => {
    const snapshot = state([run()]);
    expect(getKqSocialSubjects(snapshot, "culture")).toHaveLength(1);
    for (const requirement of ["flowering", "problem", "harvest", "curing", "ready"] as const) expect(getKqSocialSubjects(snapshot, requirement)).toEqual([]);
    snapshot.culture!.runs = [run({ stageIndex: 3, problem: { symptom: "Le bord des feuilles pâlit.", status: "suspected", diagnosis: null } })];
    expect(getKqSocialSubjects(snapshot, "flowering")).toHaveLength(1);
    expect(getKqSocialSubjects(snapshot, "problem")[0].problem).toBe("Le bord des feuilles pâlit.");
    snapshot.culture!.runs[0].cultureDead = true;
    expect(getKqSocialSubjects(snapshot, "problem")).toEqual([]);
    expect(getKqSocialSubjects(snapshot, "flowering")).toEqual([]);
    snapshot.culture!.runs = [run({ stageIndex: 5 })];
    expect(getKqSocialSubjects(snapshot, "flowering")).toEqual([]);
    expect(getKqSocialSubjects(snapshot, "curing")).toEqual([]);
    snapshot.culture!.lots = [lot()];
    expect(getKqSocialSubjects(snapshot, "harvest")[0].harvestGrams).toBe(125);
    expect(getKqSocialSubjects(snapshot, "curing")).toHaveLength(1);
    expect(getKqSocialSubjects(snapshot, "ready")).toEqual([]);
    snapshot.culture!.lots[0].stage = "ready";
    expect(getKqSocialSubjects(snapshot, "ready")).toHaveLength(1);
    for (const remainingGrams of [0, null]) {
      snapshot.culture!.lots[0].remainingGrams = remainingGrams;
      expect(getKqSocialSubjects(snapshot, "ready")).toEqual([]);
    }
    snapshot.culture!.lots = [lot({ harvestGrams: null })];
    expect(getKqSocialSubjects(snapshot, "harvest")).toEqual([]);
  });
  it("requires a visible subject selection with multiple cultures and preserves it through the arc", () => {
    const snapshot = state([run(), run({ id: "run-2", varietyName: "Écume", zoneId: "zone-2", zoneName: "Grande tente" })]);
    const options = getKqSocialAdventure(snapshot, "x");
    expect(options.subjects).toHaveLength(2);
    expect(options.subject).toBeUndefined();
    expect(parseKqSocialCommand(choose(snapshot, "x"))).toBeNull();
    const first = applyKqSocialCommand(snapshot, choose(snapshot, "x", 1, "run:run-2"), now);
    expect(first.history[0].subject?.variety).toBe("Écume");
    const next = getKqSocialAdventure(first, "x", "run:run-1");
    expect(next.scene.episode).toBe(2);
    expect(next.subject?.variety).toBe("Écume");
    expect(getKqSocialFeed(next.scene).choicePosts).not.toEqual({});
    expect(JSON.stringify(getKqSocialFeed(next.scene))).not.toContain("Brume");
    const storedSubject = first.platforms.x.story!.subject;
    first.platforms.x.story!.subject = Object.fromEntries(Object.entries(storedSubject).reverse()) as typeof storedSubject;
    const afterJsonb = getKqSocialAdventure(first, "x");
    expect(afterJsonb.scene.id).toBe(next.scene.id);
    expect(afterJsonb.contextKey).toBe(next.contextKey);
  });
  it("rejects a stale preview before spending energy or adding followers", () => {
    const snapshot = state([run()]), command = choose(snapshot, "x");
    snapshot.culture!.runs[0].stageIndex = 3;
    const before = structuredClone(snapshot);
    expect(() => applyKqSocialCommand(snapshot, command, now)).toThrow(/changé/);
    expect(snapshot).toEqual(before);
    const fresh = choose(snapshot, "x");
    expect(isKqSocialSnapshot(applyKqSocialCommand(snapshot, fresh, now))).toBe(true);
  });
  it("never continues a live-culture story after the plant dies, while keeping its published receipt intact", () => {
    const snapshot = state([run()]);
    const first = applyKqSocialCommand(snapshot, choose(snapshot, "x", 1), now);
    const published = getKqSocialFeedOutcome(first.history[0]);
    first.culture!.runs[0].cultureDead = true;
    const next = getKqSocialAdventure(first, "x");
    expect(next.subject?.requirement).toBe("general");
    expect(next.scene.episode).toBe(1);
    expect(getKqSocialFeedOutcome(first.history[0])).toEqual(published);
  });
  it("covers all 54 situations, every choice and every actual continuation using one coherent subject", () => {
    const snapshot = state([run({ stageIndex: 3, problem: { symptom: "Quelques feuilles pâlissent.", status: "suspected", diagnosis: null } })], [lot(), lot({ id: "ready-lot", stage: "ready" })]);
    let publications = 0;
    for (const scene of KQ_SOCIAL_SCENARIOS) {
      const requirement = getKqSocialProducerNarrative(scene.id).requirement;
      const subject = getKqSocialSubjects(snapshot, requirement)[0];
      expect(subject, scene.id).toBeDefined();
      const catalogue = KQ_SOCIAL_SCENARIOS.filter(item => item.platform === scene.platform), chapter = catalogue.findIndex(item => item.id === scene.id);
      for (const previousChoice of [undefined, ...(scene.followups ?? []).map(branch => branch.fromChoiceId)]) {
        const current = structuredClone(snapshot), account = current.platforms[scene.platform];
        account.chapter = chapter;
        if (scene.episode !== 1) {
          account.story = { startId: catalogue[chapter - scene.episode + 1].id, subject };
          if (previousChoice) account.memory[catalogue[chapter - 1].id] = previousChoice;
        }
        const adventure = getKqSocialAdventure(current, scene.platform, subject.id);
        expect(adventure.scene.id).toBe(scene.id);
        for (let choiceIndex = 0; choiceIndex < 3; choiceIndex++) {
          const draft = getKqSocialFeed(adventure.scene), command = choose(current, scene.platform, choiceIndex, subject.id);
          const resolved = applyKqSocialCommand(current, command, now), entry = resolved.history[0];
          const result = getKqSocialFeedOutcome(entry)!;
          expect(result.text, `${scene.id}/${previousChoice}/${choiceIndex}`).toBe(draft.choicePosts[scene.choices[choiceIndex].id]);
          expect(result.author.avatar).toBe("player");
          expect(result.comments).toHaveLength(2);
          expect(result.comments.every(comment => comment.text.length > 10 && comment.author.avatar !== "player")).toBe(true);
          expect(JSON.stringify([adventure.scene.title, adventure.scene.body, adventure.scene.choices, result])).not.toMatch(/\{\{(?:variety|stage|problem|harvestGrams)/);
          expect(isKqSocialSnapshot(resolved)).toBe(true);
          publications++;
        }
      }
    }
    expect(Object.keys(KQ_SOCIAL_PRODUCER_NARRATIVES)).toHaveLength(54);
    expect(publications).toBe(465);
  });
  it("upgrades V2 without relabelling its posted text, losing followers, money or a partnership", () => {
    const snapshot = createKqSocialSnapshot(now, 80, true, 2), scene = KQ_SOCIAL_V2_SCENARIOS[0];
    const old = applyKqSocialCommand(snapshot, { modelVersion: 2, requestKey: "90000000-0000-4000-8000-000000000001", expectedRevision: 0,
      action: "choose", platform: "instagram", scenarioId: scene.id, choiceId: scene.choices[0].id }, now, 0, 50, false, false, true);
    const published = getKqSocialFeedOutcome(old.history[0]);
    const next = normalizeKqSocialSnapshot(old, now);
    expect(next.narrativeVersion).toBe(3);
    expect(next.platforms.instagram.memory).toEqual({});
    expect(next.platforms.instagram.followers).toBe(old.platforms.instagram.followers);
    expect(next.sponsors).toEqual(old.sponsors);
    expect(next.history).toEqual(old.history);
    expect(getKqSocialFeedOutcome(next.history[0])).toEqual(published);
    expect(published).not.toBeNull();
  });
});
