import { describe, expect, it } from "vitest";
import { applyKqOperationsRequest, createKqOperationsLesson, type KqOperationsLessonAction } from "./kanab-quest-operations-lesson";
import { getKqOperationsSocial } from "./kanab-quest-operations-social";
import { restoreKqOperationsLesson } from "./kanab-quest-operations-session";
import { getKqSocialFeed } from "./kanab-quest-social-feed";
import {
  applyKqSocialCommand as applyCommand, createKqSocialSnapshot as createSnapshot, getKqSocialChoicePreview, getKqSocialLocalRoll, getKqSocialScenario as getScene,
  isKqSocialSnapshot, KQ_SOCIAL_ENERGY_TICK_MS, KQ_SOCIAL_POST_MS,
  normalizeKqSocialSnapshot as normalizeSnapshot, parseKqSocialCommand, refreshKqSocialSnapshot as refreshSnapshot,
  type KqSocialCommand, type KqSocialPlatform, type KqSocialScenario, type KqSocialSnapshot,
} from "./kanab-quest-social";
import { KQ_SOCIAL_V2_SCENARIOS as KQ_SOCIAL_SCENARIOS } from "./kanab-quest-social-stories";
import { getKqSocialAdventure } from "./kanab-quest-social-adventure";
const createKqSocialSnapshot = (now: number, audience = 0, active = true) => createSnapshot(now, audience, active, 2);
const getKqSocialScenario: typeof getScene = (p, chapter, memory = {}, catalog = KQ_SOCIAL_SCENARIOS) => getScene(p, chapter, memory, catalog);
const applyKqSocialCommand: typeof applyCommand = (s, c, n, r = 0, roll = 50, original = false, legacy = false) => applyCommand(s, c, n, r, roll, original, legacy, !original && !legacy);
const refreshKqSocialSnapshot: typeof refreshSnapshot = (s, n, r = 0) => refreshSnapshot(s, n, r, 2);
const normalizeKqSocialSnapshot: typeof normalizeSnapshot = (s, n) => normalizeSnapshot(s, n, 2);

const now = Date.parse("2026-10-23T12:00:00Z");
const platforms = ["instagram", "x"] as const;
const originalIds: Record<KqSocialPlatform, string[]> = {
  instagram: ["ig-first-frame", "ig-comment", "ig-collab", "ig-sensitive-frame", "ig-moderation", "ig-return", "ig-demand", "ig-identity", "ig-open-house"],
  x: ["x-first-thread", "x-proof", "x-rival", "x-pile-on", "x-spotlight", "x-community", "x-invitation", "x-brief", "x-line"],
};
const key = (index: number) => `70000000-0000-4000-8000-${index.toString().padStart(12, "0")}`;
const scenesFor = (platform: KqSocialPlatform) => KQ_SOCIAL_SCENARIOS.filter(scene => scene.platform === platform);
const expansions = () => platforms.flatMap(platform => scenesFor(platform).slice(9));
const command = (snapshot: KqSocialSnapshot, scene: KqSocialScenario, choiceId: string, index: number): KqSocialCommand => ({
  modelVersion: 2, action: "choose", platform: scene.platform, scenarioId: scene.id, choiceId,
  requestKey: key(index), expectedRevision: snapshot.revision,
});

describe("archived 54-situation catalogue and its unchanged economic rules", () => {
  it("keeps the original scenarios in order and adds 18 distinct scenes per network", () => {
    for (const platform of platforms) {
      const scenes = scenesFor(platform);
      expect(scenes.slice(0, 9).map(scene => scene.id)).toEqual(originalIds[platform]);
      expect(scenes.slice(9)).toHaveLength(18);
      expect(scenes.slice(9).filter(scene => scene.episode === 1)).toHaveLength(6);
    }
    const drafts = KQ_SOCIAL_SCENARIOS.flatMap(scene => Object.values(getKqSocialFeed(scene).choicePosts));
    expect(drafts).toHaveLength(162);
    expect(new Set(drafts).size, "Every proposed publication has its own authored message").toBe(162);
    const captions = KQ_SOCIAL_SCENARIOS.map(scene => getKqSocialFeed(scene).caption);
    expect(new Set(captions).size).toBe(54);
    for (const scene of expansions()) {
      const feed = getKqSocialFeed(scene);
      for (const choice of scene.choices) {
        expect([choice.label, choice.description, choice.upside, choice.downside, choice.outcome], `${scene.id}/${choice.id}`).not.toContain(feed.choicePosts[choice.id]);
        expect(feed.choicePosts[choice.id]).not.toMatch(/TODO|à compléter|choix [123]|option [123]/i);
      }
    }
  });

  it("gives every new second and third episode one meaningful branch for each previous choice", () => {
    let branches = 0;
    const catalogBefore = structuredClone(KQ_SOCIAL_SCENARIOS);
    for (const scene of expansions()) {
      const scenes = scenesFor(scene.platform), chapter = scenes.findIndex(item => item.id === scene.id);
      if (scene.episode === 1) {
        expect(scene.followups ?? []).toHaveLength(0);
        continue;
      }
      const previous = scenes[chapter - 1];
      expect(scene.followups, scene.id).toHaveLength(3);
      expect(scene.followups!.map(branch => branch.fromScenarioId)).toEqual([previous.id, previous.id, previous.id]);
      expect(new Set(scene.followups!.map(branch => branch.fromChoiceId))).toEqual(new Set(previous.choices.map(choice => choice.id)));
      for (const branch of scene.followups!) {
        const memory = { [previous.id]: branch.fromChoiceId };
        const resolved = getKqSocialScenario(scene.platform, chapter, memory);
        expect(resolved.body).toBe(branch.body);
        expect(resolved.choices.map(choice => choice.effects)).not.toEqual(scene.choices.map(choice => choice.effects));
        const state = createKqSocialSnapshot(now, 1_037);
        Object.assign(state.platforms[scene.platform], { followers: 1_000, trust: 55, haters: 40, moderation: 2, chapter, memory });
        state.socialFollowers = 1_000;
        for (const [choiceId, modifiers] of Object.entries(branch.choiceModifiers ?? {})) {
          const selected = resolved.choices.find(choice => choice.id === choiceId)!;
          const original = scene.choices.find(choice => choice.id === choiceId)!;
          for (const [field, adjustment] of Object.entries(modifiers)) {
            const effect = field as keyof typeof selected.effects;
            expect(selected.effects[effect], `${scene.id}/${branch.fromChoiceId}/${choiceId}/${field}`).toBe(original.effects[effect] + adjustment);
          }
          const preview = getKqSocialChoicePreview(state, scene.platform, selected);
          const next = applyKqSocialCommand(state, command(state, scene, choiceId, 1_000 + branches), now);
          expect(next.history[0]).toMatchObject({ scenarioId: scene.id, choiceId, energyDelta: preview.energy, trustDelta: preview.trust, hatersDelta: preview.haters, moderationDelta: preview.moderation });
          expect(next.history[0].followersDelta).toBeGreaterThanOrEqual(preview.followersMin);
          expect(next.history[0].followersDelta).toBeLessThanOrEqual(preview.followersMax);
          expect(isKqSocialSnapshot(next)).toBe(true);
        }
        branches++;
      }
    }
    expect(branches).toBe(72);
    expect(KQ_SOCIAL_SCENARIOS).toEqual(catalogBefore);
  });

  it("accepts all 108 new decisions through the server parser and bounds their actual effects", () => {
    let decisions = 0;
    for (const scene of expansions()) for (const selected of scene.choices) {
      for (const crowded of [false, true]) {
        const state = createKqSocialSnapshot(now, crowded ? 100_000 : 37);
        const chapter = scenesFor(scene.platform).findIndex(item => item.id === scene.id);
        state.platforms[scene.platform].chapter = chapter;
        if (crowded) {
          for (const platform of platforms) Object.assign(state.platforms[platform], { followers: 50_000, trust: 100, haters: 100, moderation: 5 });
          state.socialFollowers = 100_000;
        }
        const request = command(state, scene, selected.id, 2_000 + decisions);
        expect(parseKqSocialCommand(request)).toEqual(request);
        expect(parseKqSocialCommand({ ...request, platform: scene.platform === "instagram" ? "x" : "instagram" })).toBeNull();
        expect(parseKqSocialCommand({ ...request, choiceId: "invented-choice" })).toBeNull();
        const before = structuredClone(state);
        const low = applyKqSocialCommand(state, request, now, 0, 0);
        const high = applyKqSocialCommand(state, request, now, 0, 100);
        const preview = getKqSocialChoicePreview(state, scene.platform, selected);
        expect(low.history[0].followersDelta).toBe(preview.followersMin);
        expect(high.history[0].followersDelta).toBe(preview.followersMax);
        for (const result of [low, high]) {
          expect(isKqSocialSnapshot(result), `${scene.id}/${selected.id}/${crowded}`).toBe(true);
          expect(result.platforms[scene.platform].followers).toBeGreaterThanOrEqual(0);
          expect(result.platforms[scene.platform].followers).toBeLessThanOrEqual(50_000);
          expect(result.audienceFollowers).toBeGreaterThanOrEqual(0);
          expect(result.audienceFollowers).toBeLessThanOrEqual(100_000);
          expect(result.energy).toBeGreaterThanOrEqual(0);
          expect(result.history[0].id).toBe(request.requestKey);
          expect(result.audienceFollowers - state.audienceFollowers).toBe(result.history[0].followersDelta);
        }
        expect(applyKqSocialCommand(state, request, now, 0, 0)).toEqual(low);
        expect(() => applyKqSocialCommand(low, request, now)).toThrow(/situation a changé/);
        expect(state).toEqual(before);
      }
      decisions++;
    }
    expect(decisions).toBe(108);
  });

  it.each(platforms)("plays all 27 %s scenes before rotating, using real energy regeneration and arc cooldowns", platform => {
    let time = now, state = createKqSocialSnapshot(time, 37);
    const visited: string[] = [];
    for (let index = 0; index < 28; index++) {
      time = Math.max(time, Date.parse(state.platforms[platform].nextPostAt ?? state.serverNow));
      state = refreshKqSocialSnapshot(state, time);
      const scene = getKqSocialScenario(platform, state.platforms[platform].chapter, state.platforms[platform].memory);
      const selected = scene.choices.find(choice => choice.intent === ["craft", "reach", "care"][index % 3])!;
      const deficit = -(state.energy + getKqSocialChoicePreview(state, platform, selected).energy);
      if (deficit > 0) {
        time += deficit * KQ_SOCIAL_ENERGY_TICK_MS;
        state = refreshKqSocialSnapshot(state, time);
      }
      if (index < 27) {
        expect(visited).not.toContain(scene.id);
        visited.push(scene.id);
      } else expect(scene.id).toBe(visited[0]);
      const request = command(state, scene, selected.id, 3_000 + index);
      state = applyKqSocialCommand(state, request, time);
      expect(state.history[0]).toMatchObject({ id: request.requestKey, scenarioId: scene.id, choiceId: selected.id });
      expect(state.platforms[platform].memory[scene.id]).toBe(selected.id);
      expect(state.platforms[platform].nextPostAt).toBe(new Date(time + (scene.episode === 3 ? KQ_SOCIAL_POST_MS : 0)).toISOString());
      expect(isKqSocialSnapshot(state)).toBe(true);
      if (scene.episode === 3) {
        const nextScene = getKqSocialScenario(platform, state.platforms[platform].chapter, state.platforms[platform].memory);
        expect(() => applyKqSocialCommand(state, command(state, nextScene, nextScene.choices[0].id, 4_000 + index), time)).toThrow(/publication/);
      }
    }
    expect(visited).toEqual(scenesFor(platform).map(scene => scene.id));
    expect(state.platforms[platform].chapter).toBe(28);
    expect(state.platforms[platform].memory[originalIds[platform][1]]).toBeUndefined();
    expect(state.platforms[platform].memory[originalIds[platform][2]]).toBeUndefined();
    expect(time).toBeGreaterThan(now);
  });

  it("retries a newly added local decision once without duplicating its audience or spending cash", () => {
    const state = createKqOperationsLesson("market"), scene = scenesFor("instagram")[9];
    state.social = createKqSocialSnapshot(state.trial.clock, state.trial.commerce.online!.followers);
    state.social.platforms.instagram.chapter = 9;
    const action: KqOperationsLessonAction = { path: "/api/arena/placard/social", method: "POST", body: command(state.social, scene, scene.choices[0].id, 5_000) };
    const result = applyKqOperationsRequest(state, action, { replaySocialV2Narrative: true });
    expect(result.state.trial.commerce.cashCents).toBe(state.trial.commerce.cashCents);
    expect(getKqOperationsSocial(result.state).history[0].scenarioId).toBe(scene.id);
    expect(applyKqOperationsRequest(result.state, action).state).toBe(result.state);
    const collision = applyKqOperationsRequest(result.state, { ...action, body: { ...action.body, choiceId: scene.choices[1].id } });
    expect(collision.state).toBe(result.state);
    expect(collision.payload).toEqual(result.payload);
  });
});

describe("catalog expansion preserves saved adventures", () => {
  it.each([[9, 9], [11, 2], [28, 1]])("normalizes an old chapter %i to %i while preserving community, energy and receipts", (oldChapter, chapter) => {
    const original = createKqSocialSnapshot(now, 1_037);
    delete original.storyCatalogVersion;
    original.energy = 43;
    original.revision = 11;
    original.platforms.instagram.chapter = oldChapter;
    original.platforms.instagram.followers = 1_000;
    original.platforms.instagram.memory = { "ig-first-frame": "workshop", "ig-comment": "process" };
    original.socialFollowers = 1_000;
    const before = structuredClone(original), next = normalizeKqSocialSnapshot(original, now);
    expect(next).toEqual({ ...before, storyCatalogVersion: 2, platforms: { ...before.platforms, instagram: { ...before.platforms.instagram, chapter } } });
    expect(normalizeKqSocialSnapshot(next, now)).toEqual(next);
    expect(original).toEqual(before);
  });

  it.each(platforms)("restores an original %s journal beyond nine scenes and replays a new marked decision", platform => {
    const actions: KqOperationsLessonAction[] = [];
    const originalScenes = scenesFor(platform).slice(0, 9);
    for (let index = 0; index < 11; index++) {
      if (index > 0 && index % 3 === 0) actions.push({ path: "/api/arena/placard/commerce", method: "POST", body: { action: "online", command: "advance-online-time", payload: { hours: 1 }, requestKey: key(6_000 + index) } });
      const scene = originalScenes[index % 9];
      actions.push({ path: "/api/arena/placard/social", method: "POST", body: { modelVersion: 2, action: "choose", expectedRevision: index, requestKey: key(7_000 + index), platform, scenarioId: scene.id, choiceId: scene.choices.find(choice => choice.intent === "care")!.id } });
    }
    const initial = createKqOperationsLesson("market");
    let time = initial.trial.clock, expected = createKqSocialSnapshot(time, initial.trial.commerce.online!.followers);
    for (const action of actions) {
      if (action.body.action === "online") {
        time += 3_600_000;
        expected = refreshKqSocialSnapshot(expected, time);
      } else {
        const request = parseKqSocialCommand(action.body)!;
        expected = applyKqSocialCommand(expected, request, time, 0, getKqSocialLocalRoll(request.requestKey), true);
      }
    }
    const restored = restoreKqOperationsLesson("market", { version: 1, lesson: "market", actions });
    expect(restored.actions).toEqual(actions);
    const snapshot = getKqOperationsSocial(restored.state);
    expect(snapshot.revision).toBe(11);
    expect(snapshot.history).toHaveLength(11);
    expect(snapshot.platforms[platform].chapter).toBe(0);
    expect(snapshot.socialFollowers).toBeGreaterThan(0);
    expect(snapshot.socialFollowers).toBe(expected.socialFollowers);
    expect(snapshot.audienceFollowers).toBe(expected.audienceFollowers);
    expect(snapshot.energy).toBe(expected.energy);
    expect(snapshot.history).toEqual(expected.history);
    expect(snapshot.platforms[platform]).toEqual({ ...expected.platforms[platform], chapter: 0, memory: {} });
    const adventure = getKqSocialAdventure(snapshot, platform), scene = adventure.scene;
    expect(adventure.subject?.requirement).toBe("general");
    const marked: KqOperationsLessonAction = { path: "/api/arena/placard/social", method: "POST", socialCatalogVersion: 2, socialNarrativeVersion: 3,
      body: { ...command(snapshot, scene, scene.choices.find(choice => choice.intent === "care")!.id, 8_000), narrativeVersion: 3, subjectId: adventure.subject!.id, contextKey: adventure.contextKey } };
    const next = applyKqOperationsRequest(restored.state, marked).state;
    const replay = restoreKqOperationsLesson("market", { version: 1, lesson: "market", actions: [...actions, marked] });
    expect(replay.state).toEqual(next);
    expect(replay.actions).toHaveLength(actions.length + 1);
  });
});
