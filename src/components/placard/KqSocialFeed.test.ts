import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { applyKqSocialCommand, createKqSocialSnapshot, getKqSocialScenario, type KqSocialPlatform } from "@/lib/kanab-quest-social";
import { getKqSocialFeed, getKqSocialFeedOutcome } from "@/lib/kanab-quest-social-feed";
import { getKqSocialPlayer } from "@/lib/kanab-quest-social-player";
import { KqSocialDraft, KqSocialFeed, KqSocialPublishedPost } from "./KqSocialFeed";
import { getKqSocialAdventure } from "@/lib/kanab-quest-social-adventure";

const now = Date.parse("2026-10-24T12:00:00Z");
const player = getKqSocialPlayer({ firstName: "Élodie", profile: null });
const platforms: KqSocialPlatform[] = ["instagram", "x"];

function publish(platform: KqSocialPlatform) {
  const snapshot = createKqSocialSnapshot(now), adventure = getKqSocialAdventure(snapshot, platform), scene = adventure.scene;
  return applyKqSocialCommand(createKqSocialSnapshot(now), {
    modelVersion: 2, action: "choose", platform, scenarioId: scene.id, choiceId: scene.choices[0].id,
    narrativeVersion: 3, subjectId: adventure.subject!.id, contextKey: adventure.contextKey,
    requestKey: "90000000-0000-4000-8000-000000000001", expectedRevision: 0,
  }, now).history[0];
}

describe("player publication composer", () => {
  it.each(platforms)("shows only the player's drafts on %s before publishing", platform => {
    const scene = getKqSocialScenario(platform, 0);
    const presentation = getKqSocialFeed(scene, {}, player);
    const props = {
      platform, scenarioId: scene.id, player,
      media: { image: presentation.image, imageAlt: presentation.imageAlt, artwork: presentation.artwork },
      children: scene.choices.map(choice => createElement(KqSocialDraft, {
        key: choice.id, platform, text: presentation.choicePosts[choice.id], choice,
        cost: 12, disabled: false, reason: "", onPublish: () => undefined, player,
      })),
    };
    const html = renderToStaticMarkup(createElement(KqSocialFeed, props));
    expect(html.match(/data-social-draft=/g)).toHaveLength(3);
    expect(html.match(/aria-label="Publier : /g)).toHaveLength(3);
    expect(html).toContain("data-social-composer");
    expect(html).toContain("Élodie");
    expect(html).toContain("12 pts de mental");
    expect(html).not.toContain("data-social-comment");
    expect(html).not.toContain("data-social-published");
    expect(html).not.toMatch(/data-person="(?:jade|noe|sam|ines|mila)"/);
    expect(html).not.toContain('aria-label="Publication de ');
    expect(html).not.toMatch(/En réponse à cette conversation|Tu réponds quoi/);
    if (platform === "x") expect(html).toContain("Nouvelle publication");
  });

  it.each(platforms)("attaches the authored reactions only to the confirmed player post on %s", platform => {
    const entry = publish(platform);
    const post = getKqSocialFeedOutcome(entry, player)!;
    const html = renderToStaticMarkup(createElement(KqSocialPublishedPost, { entry, player }));
    expect(html).toContain(`data-social-published="${entry.id}"`);
    expect(html.match(/data-social-comment=/g)).toHaveLength(2);
    expect(html).toContain("Élodie");
    for (const comment of post.comments) expect(html).toContain(`data-social-comment="${comment.id}"`);
    expect(html).not.toContain("data-social-draft");
  });

  it("does not fabricate a current post from an old receipt without its narrative marker", () => {
    const entry = publish("instagram");
    delete entry.narrativeVersion;
    expect(renderToStaticMarkup(createElement(KqSocialPublishedPost, { entry, player }))).toBe("");
  });
});
