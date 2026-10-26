import { describe, expect, it } from "vitest";
import { KQ_SOCIAL_SCENARIOS, KQ_SOCIAL_SPONSORS, KQ_SOCIAL_LEGACY_SPONSORS, KQ_SOCIAL_SPONSOR_REGISTRY } from "./kanab-quest-social-stories";
import type { KqSocialEffects } from "./kanab-quest-social-types";

const effectKeys: Array<keyof KqSocialEffects> = ["followersMin", "followersMax", "haters", "trust", "moderation", "energy"];

describe("social narrative graph and meaningful choices", () => {
  it("has twenty-five complete three-episode arcs on each network, with unique command identifiers and authored scenes", () => {
    expect(KQ_SOCIAL_SCENARIOS).toHaveLength(150);
    expect(new Set(KQ_SOCIAL_SCENARIOS.map(scene => scene.id)).size).toBe(KQ_SOCIAL_SCENARIOS.length);
    expect(new Set(KQ_SOCIAL_SCENARIOS.map(scene => scene.title)).size).toBe(150);
    expect(new Set(KQ_SOCIAL_SCENARIOS.map(scene => scene.body)).size).toBe(150);
    expect(KQ_SOCIAL_SCENARIOS.flatMap(scene => scene.choices)).toHaveLength(450);
    for (const platform of ["instagram", "x"] as const) {
      const scenes = KQ_SOCIAL_SCENARIOS.filter(scene => scene.platform === platform);
      expect(scenes).toHaveLength(75);
      const arcs = [...new Set(scenes.map(scene => scene.arc))];
      expect(arcs).toHaveLength(25);
      for (const arc of arcs) expect(scenes.filter(scene => scene.arc === arc).map(scene => scene.episode)).toEqual([1, 2, 3]);
      for (const scene of scenes) {
        expect(new Set(scene.choices.map(choice => choice.id)).size).toBe(3);
        expect(new Set(scene.choices.map(choice => choice.label)).size).toBe(3);
        expect(scene.character.length).toBeGreaterThan(0);
        expect(new Set(scene.choices.map(choice => choice.intent))).toEqual(new Set(["reach", "craft", "care"]));
      }
    }
  });

  it("makes every follow-up reachable from an earlier decision in the same arc", () => {
    expect(KQ_SOCIAL_SCENARIOS.flatMap(scene => scene.followups ?? [])).toHaveLength(293);
    for (const [index, scene] of KQ_SOCIAL_SCENARIOS.entries()) {
      if (scene.episode === 1) continue;
      expect(scene.followups?.length, scene.id).toBeGreaterThanOrEqual(2);
      const conditions = new Set<string>();
      for (const followup of scene.followups ?? []) {
        const previous = KQ_SOCIAL_SCENARIOS.slice(0, index).find(candidate => candidate.id === followup.fromScenarioId);
        expect(previous, `${scene.id} references a missing or future scene`).toBeDefined();
        expect(previous?.platform).toBe(scene.platform);
        expect(previous?.arc).toBe(scene.arc);
        expect(previous?.choices.some(choice => choice.id === followup.fromChoiceId)).toBe(true);
        const condition = `${followup.fromScenarioId}:${followup.fromChoiceId}`;
        expect(conditions.has(condition), `${scene.id} has an ambiguous condition`).toBe(false);
        conditions.add(condition);
        expect(followup.body).not.toBe(scene.body);
        expect(Object.values(followup.choiceModifiers ?? {}).some(modifier => Object.values(modifier).some(value => value !== 0))).toBe(true);
        for (const [choiceId, modifier] of Object.entries(followup.choiceModifiers ?? {})) {
          const target = scene.choices.find(choice => choice.id === choiceId);
          expect(target, `${scene.id} modifies an absent choice ${choiceId}`).toBeDefined();
          if (!target) continue;
          const adjusted = Object.fromEntries(effectKeys.map(key => [key, target.effects[key] + (modifier[key] ?? 0)])) as KqSocialEffects;
          expect(adjusted.followersMin).toBeLessThanOrEqual(adjusted.followersMax);
          expect(adjusted.energy).toBeLessThan(0);
          expect(Object.values(adjusted).every(Number.isSafeInteger)).toBe(true);
        }
      }
    }
  });

  it("offers a real advantage for growth, craft and preserving attention in every scene", () => {
    for (const scene of KQ_SOCIAL_SCENARIOS) {
      const reach = scene.choices.find(choice => choice.intent === "reach")!;
      const craft = scene.choices.find(choice => choice.intent === "craft")!;
      const care = scene.choices.find(choice => choice.intent === "care")!;
      expect(reach.effects.followersMin, scene.id).toBeGreaterThan(craft.effects.followersMin);
      expect(reach.effects.followersMax, scene.id).toBeGreaterThan(craft.effects.followersMax);
      expect(craft.effects.trust, scene.id).toBeGreaterThan(reach.effects.trust);
      expect(craft.effects.trust, scene.id).toBeGreaterThan(care.effects.trust);
      expect(care.effects.energy, scene.id).toBeGreaterThan(reach.effects.energy);
      expect(care.effects.energy, scene.id).toBeGreaterThan(craft.effects.energy);
      expect(care.effects.haters, scene.id).toBeLessThan(reach.effects.haters);
      expect(care.effects.haters, scene.id).toBeLessThan(craft.effects.haters);
      for (const choice of scene.choices) {
        expect(choice.effects.followersMin).toBeLessThanOrEqual(choice.effects.followersMax);
        expect(choice.effects.energy).toBeLessThan(0);
        expect(Object.values(choice.effects).every(Number.isSafeInteger)).toBe(true);
        expect([choice.description, choice.upside, choice.downside, choice.outcome].every(Boolean)).toBe(true);
      }
    }
  });

  it("distinguishes slower X growth and its mental pressure from visual moderation", () => {
    const averages = (platform: "instagram" | "x", key: keyof KqSocialEffects) => {
      const choices = KQ_SOCIAL_SCENARIOS.filter(scene => scene.platform === platform).flatMap(scene => scene.choices);
      return choices.reduce((sum, choice) => sum + choice.effects[key], 0) / choices.length;
    };
    expect(averages("x", "followersMax")).toBeLessThan(averages("instagram", "followersMax"));
    expect(averages("x", "energy")).toBeLessThan(averages("instagram", "energy"));
    expect(averages("x", "haters")).toBeGreaterThan(averages("instagram", "haters"));
    expect(KQ_SOCIAL_SCENARIOS.filter(scene => scene.platform === "x").flatMap(scene => scene.choices).every(choice => choice.effects.moderation === 0)).toBe(true);
    const instagram = KQ_SOCIAL_SCENARIOS.filter(scene => scene.platform === "instagram").flatMap(scene => scene.choices);
    expect(instagram.some(choice => choice.effects.moderation > 0)).toBe(true);
    expect(instagram.some(choice => choice.effects.moderation < 0)).toBe(true);
  });

  it("does not make preserving energy the best acquisition strategy as well", () => {
    for (const platform of ["instagram", "x"] as const) {
      const choices = KQ_SOCIAL_SCENARIOS.filter(scene => scene.platform === platform).flatMap(scene => scene.choices);
      const ratio = (intent: "care" | "craft") => {
        const selected = choices.filter(choice => choice.intent === intent);
        const followers = selected.reduce((sum, choice) => sum + (choice.effects.followersMin + choice.effects.followersMax) / 2, 0);
        const energy = selected.reduce((sum, choice) => sum - choice.effects.energy, 0);
        return followers / energy;
      };
      expect(ratio("care")).toBeLessThan(ratio("craft") * .6);
    }
  });
});

describe("fictional partnership briefs", () => {
  it("provides progressively available, distinct two-publication contracts on both networks", () => {
    expect(KQ_SOCIAL_SPONSORS).toHaveLength(8);
    expect(new Set(KQ_SOCIAL_SPONSORS.map(sponsor => sponsor.id)).size).toBe(8);
    expect(KQ_SOCIAL_SPONSORS.map(sponsor => sponsor.minimumFollowers)).toEqual([75, 200, 500, 1000, 2500, 5000, 10000, 12000]);
    for (const platform of ["instagram", "x"] as const) expect(KQ_SOCIAL_SPONSORS.filter(sponsor => sponsor.platform === platform)).toHaveLength(4);
    for (const sponsor of KQ_SOCIAL_SPONSORS) {
      expect(new Set(sponsor.requiredTags).size).toBe(2);
      expect(sponsor.requiredTags.every(tag => ["visual", "craft", "dialogue", "community"].includes(tag))).toBe(true);
      expect(sponsor.publicationBudget).toBeGreaterThan(sponsor.requiredTags.length);
      expect(sponsor.minimumTrust).toBeGreaterThan(0);
      expect(sponsor.maxHaters).toBeLessThan(100);
      expect(sponsor.rewardCents).toBeGreaterThan(0);
      expect(Number.isSafeInteger(sponsor.rewardCents)).toBe(true);
      expect(sponsor.pricingVersion).toBe(1);
      expect(sponsor.sector).toBeTruthy();
      expect(sponsor.maxRewardCents).toBeGreaterThan(sponsor.rewardCents);
      expect(Number.isSafeInteger(sponsor.maxRewardCents)).toBe(true);
      expect(Object.keys(sponsor.deliverables ?? {}).sort()).toEqual([...sponsor.requiredTags].sort());
      expect(new Set(Object.values(sponsor.deliverables ?? {}).map(deliverable => deliverable.title)).size).toBe(2);
      for (const tag of sponsor.requiredTags) {
        expect(sponsor.deliverables?.[tag]?.title).toBeTruthy();
        expect(sponsor.deliverables?.[tag]?.description).toBeTruthy();
      }
      expect(sponsor.brief).toContain("Partenariat rémunéré");
    }
  });

  it("preserves the four fixed-price historical agreements outside new offers", () => {
    expect(KQ_SOCIAL_LEGACY_SPONSORS.map(({ id, rewardCents }) => ({ id, rewardCents }))).toEqual([
      { id: "atelier-marne", rewardCents: 3000 }, { id: "carnet-brut", rewardCents: 6000 },
      { id: "planche-pixel", rewardCents: 10000 }, { id: "decibel-club", rewardCents: 18000 },
    ]);
    expect(KQ_SOCIAL_LEGACY_SPONSORS.every(sponsor => sponsor.pricingVersion === undefined)).toBe(true);
    expect(KQ_SOCIAL_SPONSOR_REGISTRY).toHaveLength(12);
    expect(new Set(KQ_SOCIAL_SPONSOR_REGISTRY.map(sponsor => sponsor.id)).size).toBe(12);
    for (const sponsor of KQ_SOCIAL_LEGACY_SPONSORS) {
      expect(KQ_SOCIAL_SPONSORS.some(current => current.id === sponsor.id)).toBe(false);
      expect(KQ_SOCIAL_SPONSOR_REGISTRY.find(registered => registered.id === sponsor.id)).toBe(sponsor);
    }
  });
});
