import { describe, expect, it } from "vitest";
import { KQ_SOCIAL_SCENARIOS } from "./kanab-quest-social-stories";
import { applyKqSocialCommand, createKqSocialSnapshot, getKqSocialAdventure, isKqSocialSnapshot } from "./kanab-quest-social";
import { getKqSocialFeed, getKqSocialFeedOutcome } from "./kanab-quest-social-feed";
import { getKqSocialProducerNarrative } from "./kanab-quest-social-producer";
import { getKqSocialPlayer } from "./kanab-quest-social-player";
import type { KqSocialScenario, KqSocialSnapshot } from "./kanab-quest-social-types";

const now = Date.parse("2026-10-25T10:00:00Z");
const player = getKqSocialPlayer({ firstName: "Élodie" });
const debates = KQ_SOCIAL_SCENARIOS.filter(scene => scene.id.includes("-debate-"));
const openings = debates.filter(scene => scene.episode === 1);

function atOpening(scene: KqSocialScenario) {
  const state = createKqSocialSnapshot(now);
  // Focus this arc without changing its logic or interrupting another story.
  for (const opening of openings) state.platforms[opening.platform].memory[opening.id] = opening.choices[0].id;
  state.platforms[scene.platform].chapter = KQ_SOCIAL_SCENARIOS.filter(item => item.platform === scene.platform).findIndex(item => item.id === scene.id);
  return state;
}

function choose(state: KqSocialSnapshot, platform: KqSocialScenario["platform"], choiceIndex: number) {
  const adventure = getKqSocialAdventure(state, platform);
  return applyKqSocialCommand(state, {
    modelVersion: 2, requestKey: `88000000-0000-4000-8000-${String(state.revision + 1).padStart(12, "0")}`,
    expectedRevision: state.revision, action: "choose", platform, scenarioId: adventure.scene.id,
    choiceId: adventure.scene.choices[choiceIndex].id, narrativeVersion: 3,
    subjectId: adventure.subject!.id, contextKey: adventure.contextKey,
  }, now + (adventure.scene.choices[choiceIndex].action === "publish" ? state.revision : 0) * 24 * 60 * 60 * 1000);
}

describe("authored discussions beneath the player's own posts", () => {
  it("provides thirty-two debate stories including twenty with two responses beneath the same post", () => {
    expect(openings).toHaveLength(32);
    expect(debates).toHaveLength(96);
    expect(new Set(openings.map(scene => scene.arc)).size).toBe(32);
    expect(debates.filter(scene => scene.episode === 3 && getKqSocialProducerNarrative(scene.id).replyTo)).toHaveLength(20);
    for (const opening of openings) {
      const arc = debates.filter(scene => scene.arc === opening.arc);
      expect(arc.map(scene => scene.episode)).toEqual([1, 2, 3]);
      for (let index = 1; index < 3; index++) {
        expect(arc[index].followups?.map(branch => branch.fromChoiceId).sort()).toEqual(arc[index - 1].choices.map(choice => choice.id).sort());
      }
      expect(getKqSocialProducerNarrative(arc[1].id).replyTo?.scenarioId).toBe(opening.id);
      expect(arc[1].choices.map(choice => choice.action).sort()).toEqual(["ignore", "reply", "reply"]);
    }
  });

  it("keeps all 864 complete paths consistent with the chosen post, both comments and every response", () => {
    let paths = 0;
    for (const opening of openings) {
      for (let initial = 0; initial < 3; initial++) {
        const first = choose(atOpening(opening), opening.platform, initial);
        const original = getKqSocialFeedOutcome(first.history[0], player)!;
        expect(original).not.toBeNull();
        const next = getKqSocialAdventure(first, opening.platform);
        const discussion = getKqSocialFeed(next.scene, {}, player);
        expect(discussion.thread?.text).toBe(original.text);
        expect(discussion.thread?.comments.map(comment => comment.text)).toEqual(original.comments.map(comment => comment.text));
        expect(discussion.thread?.comments.some(comment => comment.id === discussion.thread?.targetCommentId)).toBe(true);
        for (let reaction = 0; reaction < 3; reaction++) {
          const second = choose(first, opening.platform, reaction);
          const choice = next.scene.choices[reaction];
          const result = getKqSocialFeedOutcome(second.history[0], player)!;
          expect(result.thread).toEqual(discussion.thread);
          expect(result.action).toBe(choice.action);
          expect(result.text).toBe(discussion.choicePosts[choice.id]);
          if (choice.action === "ignore") {
            expect(result.text).toBe("");
            expect(result.comments).toEqual([]);
          } else {
            expect(result.text.length).toBeGreaterThan(30);
            expect(result.comments).toHaveLength(2);
          }
          const last = getKqSocialAdventure(second, opening.platform);
          expect(last.scene.episode).toBe(3);
          expect(last.scene.previousChoice).toBe(choice.id);
          const lastDrafts = getKqSocialFeed(last.scene, {}, player);
          if (getKqSocialProducerNarrative(last.scene.id).replyTo) {
            expect(last.scene.parentChoice).toBe(first.history[0].choiceId);
            expect(lastDrafts.thread?.text).toBe(original.text);
            expect(lastDrafts.thread?.targetCommentId).toBe(discussion.thread!.comments[1].id);
            const retained = lastDrafts.thread!.comments;
            expect(retained).toHaveLength(choice.action === "ignore" ? 2 : 5);
            expect(retained[0]).toEqual(discussion.thread!.comments[0]);
            expect(retained.at(-1)).toEqual(discussion.thread!.comments[1]);
            if (choice.action === "reply") expect(retained[1].text).toBe(result.text);
          } else expect(lastDrafts.thread).toBeUndefined();
          for (let final = 0; final < 3; final++) {
            const third = choose(second, opening.platform, final);
            const publication = getKqSocialFeedOutcome(third.history[0], player)!;
            expect(isKqSocialSnapshot(third)).toBe(true);
            expect(publication.text).toBe(lastDrafts.choicePosts[last.scene.choices[final].id]);
            expect(publication.comments).toHaveLength(last.scene.choices[final].action === "ignore" ? 0 : 2);
            expect(publication.thread).toEqual(lastDrafts.thread);
            if (lastDrafts.thread) {
              expect(third.platforms[opening.platform].publishedDay).toBe(first.platforms[opening.platform].publishedDay);
              expect(third.platforms[opening.platform].nextPostAt).toBe(first.platforms[opening.platform].nextPostAt);
              expect(third.history[0].parentChoice).toBe(first.history[0].choiceId);
            }
            expect(getKqSocialFeedOutcome(first.history[0], player)).toEqual(original);
            expect(JSON.stringify([discussion, result, lastDrafts, publication])).not.toMatch(/\{\{(?:variety|stage|player|problem)/);
            paths++;
          }
        }
      }
    }
    expect(paths).toBe(864);
  });

  it("does not fabricate a parent post for a broken or cross-network reaction receipt", () => {
    const opening = openings[0];
    const first = choose(atOpening(opening), opening.platform, 0);
    const second = choose(first, opening.platform, 0), entry = second.history[0];
    expect(getKqSocialFeedOutcome({ ...entry, previousChoice: undefined })).toBeNull();
    expect(getKqSocialFeedOutcome({ ...entry, previousChoice: "unselected" })).toBeNull();
    expect(getKqSocialFeedOutcome({ ...entry, action: "ignore" })).toBeNull();
    expect(getKqSocialFeedOutcome({ ...entry, platform: opening.platform === "x" ? "instagram" : "x" })).toBeNull();
    expect(getKqSocialFeedOutcome({ ...entry, scenarioId: "unknown" })).toBeNull();
  });

  it("requires the original post choice to reconstruct a second reply after history is trimmed", () => {
    const opening = openings.find(scene => {
      const end = debates.find(candidate => candidate.arc === scene.arc && candidate.episode === 3)!;
      return !!getKqSocialProducerNarrative(end.id).replyTo;
    })!;
    const first = choose(atOpening(opening), opening.platform, 1);
    const second = choose(first, opening.platform, 0);
    const trimmed = { ...second, history: [] };
    const adventure = getKqSocialAdventure(trimmed, opening.platform);
    expect(getKqSocialFeed(adventure.scene, {}, player).thread?.text).toBe(getKqSocialFeedOutcome(first.history[0], player)!.text);
    const third = choose(trimmed, opening.platform, 1), entry = third.history[0];
    expect(getKqSocialFeedOutcome(entry, player)).not.toBeNull();
    expect(getKqSocialFeedOutcome({ ...entry, parentChoice: undefined }, player)).toBeNull();
    expect(getKqSocialFeedOutcome({ ...entry, parentChoice: "unselected" }, player)).toBeNull();
    delete trimmed.platforms[opening.platform].memory[second.history[0].scenarioId];
    expect(getKqSocialAdventure(trimmed, opening.platform).scene.episode).toBe(1);
  });
});
