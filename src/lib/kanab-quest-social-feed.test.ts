import { describe, expect, it } from "vitest";
import { getKqSocialScenario as getScene } from "./kanab-quest-social";
import { getKqSocialFeed, getKqSocialFeedOutcome, KQ_SOCIAL_FEED_PLAYER } from "./kanab-quest-social-feed";
import { KQ_SOCIAL_V2_CONTENT as KQ_SOCIAL_CONTENT, KQ_SOCIAL_V2_SCENARIOS as KQ_SOCIAL_SCENARIOS } from "./kanab-quest-social-stories";
import { DEFAULT_KQ_SOCIAL_PLAYER, getKqSocialPlayer } from "./kanab-quest-social-player";
import { getKqSocialArtwork } from "./kanab-quest-social-art";
import type { KqSocialHistoryEntry, KqSocialScenario } from "./kanab-quest-social-types";

const receipt = (scene: KqSocialScenario, choiceId: string): KqSocialHistoryEntry => ({
  id: "committed-choice", narrativeVersion: 2, platform: scene.platform, scenarioId: scene.id, choiceId,
  createdAt: "2026-10-23T12:00:00Z", outcome: "Résultat confirmé par le jeu.", followersDelta: -7,
  hatersDelta: 2, moderationDelta: 0, energyDelta: -10, trustDelta: 0,
});
const getKqSocialScenario: typeof getScene = (platform, chapter, memory = {}, catalog = KQ_SOCIAL_SCENARIOS) => getScene(platform, chapter, memory, catalog);

describe("archived V2 feeds preserve the text of existing receipts", () => {
  it("covers every scene and every draft without publishing a player choice in advance", () => {
    let draftCount = 0;
    for (const scene of KQ_SOCIAL_SCENARIOS) {
      const feed = getKqSocialFeed(scene, {});
      expect(JSON.stringify(feed)).not.toContain("de Toi");
      expect(feed.author.avatar, scene.id).not.toBe("player");
      expect(feed.caption.length).toBeGreaterThan(20);
      expect(feed.caption.length).toBeLessThan(300);
      expect(feed.imageAlt).not.toMatch(/Sylvain|\{\{player/);
      expect(feed.comments).toHaveLength(2);
      expect(feed.comments.every(comment => comment.author.avatar !== "player")).toBe(true);
      expect(new Set(feed.comments.map(comment => comment.id)).size).toBe(2);
      expect(Object.keys(feed.choicePosts).sort()).toEqual(scene.choices.map(choice => choice.id).sort());
      for (const post of Object.values(feed.choicePosts)) {
        expect(post.length).toBeGreaterThan(20);
        expect(post.length).toBeLessThan(300);
        expect(feed.caption).not.toBe(post);
        draftCount++;
      }
      expect(Object.keys(feed).sort()).toEqual(["artwork", "author", "caption", "choicePosts", "comments", "image", "imageAlt", "location"]);
      expect(feed.artwork, scene.id).toEqual(getKqSocialArtwork(scene.id));
      expect(feed.imageAlt).toBe(feed.artwork?.alt);
      for (const comment of feed.comments) expect(Object.keys(comment).sort()).toEqual(comment.kind ? ["author", "id", "kind", "text"] : ["author", "id", "text"]);
    }
    expect(draftCount).toBe(162);
  });

  it("gives every resolved follow-up a distinct comment from the actual prior choice", () => {
    let branchCount = 0;
    for (const scene of KQ_SOCIAL_SCENARIOS) {
      const chapter = KQ_SOCIAL_SCENARIOS.filter(item => item.platform === scene.platform).findIndex(item => item.id === scene.id);
      const baseline = getKqSocialFeed(scene, {});
      const branchTexts = new Set<string>();
      for (const branch of scene.followups ?? []) {
        const memory = { [branch.fromScenarioId]: branch.fromChoiceId };
        const resolved = getKqSocialScenario(scene.platform, chapter, memory);
        expect(resolved.body).toBe(branch.body);
        const feed = getKqSocialFeed(resolved, memory);
        const authoredBranch = KQ_SOCIAL_CONTENT.find(content => content.scenario.id === scene.id)?.branches?.find(item => item.fromScenarioId === branch.fromScenarioId && item.fromChoiceId === branch.fromChoiceId);
        if (authoredBranch?.caption) expect(feed.caption, `${scene.id}/${branch.fromChoiceId} keeps the caption consistent with the continuation`).not.toBe(baseline.caption);
        expect(feed.comments).toHaveLength(2);
        expect(feed.comments[0]).toEqual(baseline.comments[0]);
        expect(feed.comments[1].text, `${scene.id}/${branch.fromChoiceId}`).not.toBe(baseline.comments[1].text);
        expect(branchTexts.has(feed.comments[1].text)).toBe(false);
        branchTexts.add(feed.comments[1].text);
        expect(feed.choicePosts).toEqual(baseline.choicePosts);
        branchCount++;
      }
      expect(getKqSocialFeed(scene, { unrelated: "reveal" }).comments).toEqual(baseline.comments);
    }
    expect(branchCount).toBe(101);
  });

  it("renders only the committed choice and keeps negative audience outcomes from becoming success claims", () => {
    expect(KQ_SOCIAL_FEED_PLAYER).toEqual(DEFAULT_KQ_SOCIAL_PLAYER);
    const authoredReactions = new Set<string>();
    for (const scene of KQ_SOCIAL_SCENARIOS) {
      const presentation = getKqSocialFeed(scene, {});
      for (const selected of scene.choices) {
        const actual = receipt(scene, selected.id);
        const output = getKqSocialFeedOutcome(actual);
        expect(output?.author).toEqual(KQ_SOCIAL_FEED_PLAYER);
        expect(output?.text).toBe(presentation.choicePosts[selected.id]);
        expect(output?.comments).toHaveLength(2);
        expect(output?.comments.every(comment => comment.id.startsWith(`${actual.id}:`))).toBe(true);
        const reactionText = JSON.stringify(output?.comments.map(comment => comment.text));
        expect(authoredReactions.has(reactionText), `${scene.id}/${selected.id} repeats another choice's replies`).toBe(false);
        authoredReactions.add(reactionText);
        expect(output?.comments.every(comment => comment.text.length > 20 && comment.text.length < 300)).toBe(true);
        // Presentation adds no gain claim or invented measurement when the real net delta changes.
        expect(getKqSocialFeedOutcome({ ...actual, followersDelta: 25 })).toEqual(output);
        expect(["workshop", "still-life", "community"]).toContain(output?.image);
        expect(output?.artwork, `${scene.id}/${selected.id}`).toEqual(presentation.artwork);
        expect(output?.artwork?.src).toBe(getKqSocialArtwork(actual.scenarioId)?.src);
        expect(output?.imageAlt).toBe(output?.artwork?.alt);
        expect(output?.imageAlt).not.toMatch(/Sylvain|\{\{player/);
      }
      const growth = scene.choices.find(choice => choice.intent === "reach")!;
      const care = scene.choices.find(choice => choice.intent === "care")!;
      expect(getKqSocialFeedOutcome(receipt(scene, growth.id))?.comments).not.toEqual(getKqSocialFeedOutcome(receipt(scene, care.id))?.comments);
    }
    expect(authoredReactions.size).toBe(162);
  });

  it("keeps the illustration and its truthful alternative stable across choices in the same situation", () => {
    const sensitive = KQ_SOCIAL_SCENARIOS.find(scene => scene.id === "ig-sensitive-frame")!;
    const flower = getKqSocialFeedOutcome(receipt(sensitive, "flower"));
    const still = getKqSocialFeedOutcome(receipt(sensitive, "still"));
    // The illustration depicts this story's setting, without pretending a draft changed its pixels.
    expect(flower?.artwork).toEqual(getKqSocialArtwork(sensitive.id));
    expect(still?.artwork).toEqual(flower?.artwork);
    expect(flower?.imageAlt).toBe(flower?.artwork?.alt);
    expect(still?.imageAlt).toBe(flower?.imageAlt);
    const original = structuredClone(getKqSocialFeed(sensitive, {}));
    for (const choice of sensitive.choices) getKqSocialFeedOutcome(receipt(sensitive, choice.id));
    expect(getKqSocialFeed(sensitive, {})).toEqual(original);
  });

  it("does not invent publications for legacy receipts, another network, sponsors or unknown commands", () => {
    const scene = KQ_SOCIAL_SCENARIOS[0];
    const entry = receipt(scene, scene.choices[0].id);
    const oldV2 = { ...entry, narrativeVersion: undefined, outcome: "Ton ancien résultat reste écrit ainsi.", followersDelta: -7 };
    const before = structuredClone(oldV2);
    expect(getKqSocialFeedOutcome(oldV2)).toBeNull();
    expect(oldV2).toEqual(before);
    expect(getKqSocialFeedOutcome({ ...entry, trustDelta: undefined })).toBeNull();
    expect(getKqSocialFeedOutcome({ ...entry, platform: "x" })).toBeNull();
    expect(getKqSocialFeedOutcome({ ...entry, scenarioId: "atelier-marne", choiceId: "sponsor-claim" })).toBeNull();
    expect(getKqSocialFeedOutcome({ ...entry, scenarioId: "recover", choiceId: "recover", platform: null })).toBeNull();
    expect(getKqSocialFeedOutcome({ ...entry, choiceId: "invented-choice" })).toBeNull();
  });

  it("isolates presentations so a caller cannot corrupt other scenes or future outcomes", () => {
    const scene = KQ_SOCIAL_SCENARIOS[0];
    const first = getKqSocialFeed(scene, {});
    const before = structuredClone(first);
    first.author.name = "Changed";
    first.comments[0].text = "Changed";
    first.choicePosts[scene.choices[0].id] = "Changed";
    first.artwork!.alt = "Changed";
    expect(getKqSocialFeed(scene, {})).toEqual(before);
    const outcome = getKqSocialFeedOutcome(receipt(scene, scene.choices[0].id))!;
    outcome.author.name = "Changed";
    outcome.artwork!.src = "/changed.webp";
    expect(getKqSocialFeedOutcome(receipt(scene, scene.choices[0].id))?.artwork).toEqual(before.artwork);
    expect(KQ_SOCIAL_FEED_PLAYER.name).toBe("Toi");
  });

  it("resolves all 162 choices and 101 memory branches independently for alternating player identities", () => {
    const elodie = getKqSocialPlayer({ firstName: "Élodie", profile: { nickname: "elodie.atelier", gender: "female", skin: "brown", clothing: "berry", strength: "green-thumb", appearance: { hair: "braids" } } });
    const mehdi = getKqSocialPlayer({ firstName: "Mehdi", profile: { nickname: "mehdi.latelier", gender: "male", skin: "honey", clothing: "teal", strength: "merchant", appearance: { hair: "quiff" } } });
    const catalogBefore = structuredClone(KQ_SOCIAL_SCENARIOS);
    let choices = 0, branches = 0;
    for (const scene of KQ_SOCIAL_SCENARIOS) {
      const first = getKqSocialFeed(scene, {}, elodie);
      const other = getKqSocialFeed(scene, {}, mehdi);
      expect(other.author).toEqual(first.author);
      expect(other.comments.map(comment => comment.author)).toEqual(first.comments.map(comment => comment.author));
      expect(first.location).toBe("Journal de culture indoor");
      expect(other.location).toBe(first.location);
      expect(JSON.stringify(first)).not.toMatch(/Sylvain|Mehdi|\{\{player/);
      expect(JSON.stringify(other)).not.toMatch(/Sylvain|Élodie|\{\{player/);
      expect(getKqSocialFeed(scene, {}, elodie)).toEqual(first);
      for (const choice of scene.choices) {
        const entry = receipt(scene, choice.id), before = structuredClone(entry);
        const elodiePost = getKqSocialFeedOutcome(entry, elodie);
        const mehdiPost = getKqSocialFeedOutcome(entry, mehdi);
        expect(elodiePost?.author).toEqual(elodie);
        expect(mehdiPost?.author).toEqual(mehdi);
        expect(elodiePost?.text).toBe(first.choicePosts[choice.id]);
        expect(mehdiPost?.text).toBe(other.choicePosts[choice.id]);
        expect(getKqSocialFeedOutcome(entry, elodie)).toEqual(elodiePost);
        expect(entry).toEqual(before);
        choices++;
      }
      for (const branch of scene.followups ?? []) {
        const memory = { [branch.fromScenarioId]: branch.fromChoiceId };
        const forElodie = getKqSocialFeed(scene, memory, elodie);
        const forMehdi = getKqSocialFeed(scene, memory, mehdi);
        expect(JSON.stringify(forElodie)).not.toMatch(/Sylvain|Mehdi|\{\{player/);
        expect(JSON.stringify(forMehdi)).not.toMatch(/Sylvain|Élodie|\{\{player/);
        expect(forElodie.comments[1].id).toBe(forMehdi.comments[1].id);
        expect(getKqSocialFeed(scene, memory, elodie)).toEqual(forElodie);
        branches++;
      }
    }
    expect(choices).toBe(162);
    expect(branches).toBe(101);
    expect(KQ_SOCIAL_SCENARIOS).toEqual(catalogBefore);
  });

  it("inserts player text literally without replacing NPC names or recursively interpreting user content", () => {
    const firstScene = KQ_SOCIAL_SCENARIOS[0];
    const special = getKqSocialPlayer({ firstName: "Anaïs $& $` $' {{player}}" });
    const feed = getKqSocialFeed(firstScene, {}, special);
    expect(feed.caption).toContain(special.name);
    expect(Object.values(feed.choicePosts).some(post => post.includes(special.name))).toBe(true);
    const collab = KQ_SOCIAL_SCENARIOS.find(scene => scene.id === "ig-collab")!;
    const npcName = getKqSocialFeed(firstScene).author.name;
    const namedLikeNpc = getKqSocialPlayer({ firstName: npcName });
    const another = getKqSocialPlayer({ firstName: "Élodie" });
    expect(getKqSocialFeed(collab, {}, another).comments.map(comment => comment.author)).toEqual(getKqSocialFeed(collab, {}, namedLikeNpc).comments.map(comment => comment.author));
    expect(getKqSocialFeed(firstScene, {}, namedLikeNpc).author.name).toBe(npcName);
    expect(getKqSocialFeed(firstScene, {}, another).author.name).toBe(npcName);
    expect(getKqSocialFeedOutcome({ ...receipt(firstScene, "postcard"), trustDelta: undefined }, another)).toBeNull();
  });

  it("describes the real avatar only for a personalized placement and keeps object scenes free of invented players", () => {
    const absent = getKqSocialPlayer({ firstName: "Élodie", profile: null });
    const present = getKqSocialPlayer({ firstName: "Élodie", profile: { nickname: "elodie.atelier", gender: "female", skin: "brown", clothing: "berry", strength: "green-thumb" } });
    for (const scene of KQ_SOCIAL_SCENARIOS) {
      const art = getKqSocialArtwork(scene.id)!;
      const empty = getKqSocialFeed(scene, {}, absent);
      const personalized = getKqSocialFeed(scene, {}, present);
      expect(empty.artwork).toEqual(art);
      expect(empty.imageAlt).not.toContain("Élodie");
      expect(personalized.artwork?.src).toBe(art.src);
      expect(personalized.imageAlt).toBe(personalized.artwork?.alt);
      if (art.playerPlacement === "none") expect(personalized.artwork).toEqual(art);
      else {
        expect(personalized.imageAlt).toContain(art.alt);
        expect(personalized.imageAlt).toContain("Élodie");
        expect(personalized.imageAlt).not.toContain("Toi");
      }
      for (const choice of scene.choices) {
        expect(getKqSocialFeedOutcome(receipt(scene, choice.id), present)?.artwork).toEqual(personalized.artwork);
        expect(getKqSocialFeedOutcome(receipt(scene, choice.id), absent)?.artwork).toEqual(art);
      }
      expect(getKqSocialArtwork(scene.id)).toEqual(art);
    }
  });
});
