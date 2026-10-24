import { describe, expect, it } from "vitest";
import { KQ_SOCIAL_LEGACY_SCENARIOS, KQ_SOCIAL_V2_SCENARIOS as KQ_SOCIAL_SCENARIOS } from "./kanab-quest-social-stories";
import { getKqSocialFeed, getKqSocialFeedOutcome } from "./kanab-quest-social-feed";
import { getKqSocialPlayer } from "./kanab-quest-social-player";
import { KQ_SOCIAL_NARRATIVES } from "./kanab-quest-social-narrative";
import { applyKqSocialCommand as applyCommand, createKqSocialSnapshot, getKqSocialScenario, type KqSocialCommand } from "./kanab-quest-social";
const applyKqSocialCommand: typeof applyCommand = (s, c, n, r = 0, roll = 50, original = false, legacy = false) => applyCommand(s, c, n, r, roll, original, legacy, !original && !legacy);

const now = Date.parse("2026-10-24T12:00:00Z");
const key = (index: number) => `80000000-0000-4000-8000-${String(index).padStart(12, "0")}`;

describe("archived V2 narratives keep saved game mechanics and actual publications", () => {
  it("preserves French accents across every scene, publication and reply", () => {
    const corrupted = Object.entries(KQ_SOCIAL_NARRATIVES)
      .filter(([, story]) => /\p{L}\?\p{L}|\uFFFD/u.test(JSON.stringify(story)))
      .map(([id]) => id);
    expect(corrupted).toEqual([]);
  });

  it("rewrites all 54 situations and 162 outcomes without changing saved command identifiers or effects", () => {
    expect(KQ_SOCIAL_LEGACY_SCENARIOS).toHaveLength(54);
    expect(KQ_SOCIAL_SCENARIOS.map(scene => scene.id)).toEqual(KQ_SOCIAL_LEGACY_SCENARIOS.map(scene => scene.id));
    let choices = 0, continuations = 0;
    for (const old of KQ_SOCIAL_LEGACY_SCENARIOS) {
      const current = KQ_SOCIAL_SCENARIOS.find(scene => scene.id === old.id)!;
      expect(current.platform).toBe(old.platform);
      expect(current.episode).toBe(old.episode);
      expect(current.body, old.id).not.toBe(old.body);
      expect(current.choices.map(choice => choice.id)).toEqual(old.choices.map(choice => choice.id));
      for (const previous of old.choices) {
        const choice = current.choices.find(item => item.id === previous.id)!;
        expect(choice.outcome, `${old.id}/${previous.id}`).not.toBe(previous.outcome);
        expect(choice.effects).toEqual(previous.effects);
        expect(choice.intent).toBe(previous.intent);
        expect(choice.tag).toBe(previous.tag);
        choices++;
      }
      expect(current.followups?.length ?? 0).toBe(old.followups?.length ?? 0);
      for (const [index, previous] of (old.followups ?? []).entries()) {
        const branch = current.followups![index];
        expect(branch.fromScenarioId).toBe(previous.fromScenarioId);
        expect(branch.fromChoiceId).toBe(previous.fromChoiceId);
        expect(branch.choiceModifiers).toEqual(previous.choiceModifiers);
        expect(branch.body, `${old.id}/${previous.fromChoiceId}`).not.toBe(previous.body);
        continuations++;
      }
    }
    expect(choices).toBe(162);
    expect(continuations).toBe(101);
  });

  it("introduces indoor production on both networks without outdoor damage or unresolved crop placeholders", () => {
    for (const platform of ["instagram", "x"] as const) {
      const opening = KQ_SOCIAL_SCENARIOS.filter(scene => scene.platform === platform).slice(0, 3);
      const text = opening.map(scene => [scene.body, getKqSocialFeed(scene).caption, ...Object.values(getKqSocialFeed(scene).choicePosts)].join(" ")).join(" ");
      expect(text, platform).toMatch(/indoor/i);
      expect(text).not.toMatch(/(?:ta|tes) (?:culture|plantes?|récolte)[^.!?]{0,80}(?:sous la pluie|détruit[^.!?]{0,15}gel|en plein champ)/i);
      expect(text).not.toMatch(/\{\{(?:crop|variety|stage)/i);
    }
  });

  it("renders all newly committed choices with their own post and replies, while old narrative receipts remain intact", () => {
    const player = getKqSocialPlayer({ firstName: "Élodie" });
    let index = 0;
    for (const scene of KQ_SOCIAL_SCENARIOS) {
      const chapter = KQ_SOCIAL_SCENARIOS.filter(item => item.platform === scene.platform).findIndex(item => item.id === scene.id);
      for (const choice of scene.choices) {
        const state = createKqSocialSnapshot(now);
        state.platforms[scene.platform].chapter = chapter;
        const command: KqSocialCommand = { modelVersion: 2, action: "choose", platform: scene.platform, scenarioId: scene.id, choiceId: choice.id, requestKey: key(++index), expectedRevision: 0 };
        const fresh = applyKqSocialCommand(state, command, now), currentEntry = fresh.history[0];
        expect(currentEntry.narrativeVersion).toBe(2);
        expect(currentEntry.outcome).toBe(choice.outcome);
        expect(getKqSocialFeedOutcome(currentEntry, player)?.text).toBe(getKqSocialFeed(scene, {}, player).choicePosts[choice.id]);
        const legacy = applyKqSocialCommand(state, command, now, 0, 50, false, true), oldEntry = legacy.history[0];
        const oldScene = getKqSocialScenario(scene.platform, chapter, {}, KQ_SOCIAL_LEGACY_SCENARIOS);
        expect(oldEntry.outcome).toBe(oldScene.choices.find(item => item.id === choice.id)!.outcome);
        expect(getKqSocialFeedOutcome(oldEntry, player)).toBeNull();
        const withoutNarrative = (entry: typeof oldEntry) => {
          const copy = { ...entry };
          delete copy.narrativeVersion;
          return { ...copy, outcome: "authored text" };
        };
        expect(withoutNarrative(currentEntry)).toEqual(withoutNarrative(oldEntry));
        expect(fresh.audienceFollowers).toBe(legacy.audienceFollowers);
        expect(fresh.energy).toBe(legacy.energy);
      }
    }
    expect(index).toBe(162);
  });
});
