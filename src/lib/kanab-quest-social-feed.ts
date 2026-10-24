import { KQ_SOCIAL_CONTENT } from "./kanab-quest-social-stories";
import { DEFAULT_KQ_SOCIAL_PLAYER, type KqSocialPlayer } from "./kanab-quest-social-player";
import { getKqSocialArtwork, getKqSocialProducerArtwork, type KqSocialArtwork } from "./kanab-quest-social-art";
import type { KqSocialContentMessage } from "./kanab-quest-social-content";
import type { KqSocialHistoryEntry, KqSocialScenario } from "./kanab-quest-social-types";
import { getKqSocialProducerNarrative, renderKqSocialSubject } from "./kanab-quest-social-producer";

export type KqSocialFeedPerson = { name: string; handle: string; avatar: "mila" | "jade" | "noe" | "ines" | "sam" | "player"; profile?: KqSocialPlayer["profile"] };
export type KqSocialFeedMessage = { id: string; author: KqSocialFeedPerson; text: string; kind?: "reply" | "quote" };
export type KqSocialFeedPresentation = {
  author: KqSocialFeedPerson; caption: string; image: "workshop" | "still-life" | "community";
  imageAlt: string; artwork?: KqSocialArtwork; location: string; comments: KqSocialFeedMessage[]; choicePosts: Record<string, string>;
};

/** Fictional recurring voices and two visitors discovering the producer's posts. */
export const KQ_SOCIAL_FEED_PEOPLE = {
  mila: { name: "Mila", handle: "@mila.cadre", avatar: "mila" },
  jade: { name: "Jade", handle: "@jade.culture", avatar: "jade" },
  noe: { name: "Noé", handle: "@noe.cultive", avatar: "noe" },
  ines: { name: "Inès", handle: "@ines_du_quartier", avatar: "ines" },
  sam: { name: "Sami", handle: "@sami.cbd", avatar: "sam" },
  visitor: { name: "Lou", handle: "@lou.decouvre", avatar: "ines" },
  skeptic: { name: "Max", handle: "@max.sansfiltre", avatar: "sam" },
  player: DEFAULT_KQ_SOCIAL_PLAYER,
} as const satisfies Record<string, KqSocialFeedPerson>;
export const KQ_SOCIAL_FEED_PLAYER: KqSocialFeedPerson = DEFAULT_KQ_SOCIAL_PLAYER;

/** Tokens are replaced once, so user names can never introduce another substitution. */
function personalize(text: string, player: KqSocialPlayer): string {
  const fallback = player.name === DEFAULT_KQ_SOCIAL_PLAYER.name && player.handle === DEFAULT_KQ_SOCIAL_PLAYER.handle && player.profile === null;
  const owner = /^[aeiouyàâäéèêëîïôöùûüÿ]/iu.test(player.name) ? `d’${player.name}` : `de ${player.name}`;
  const replacements: Record<string, string> = {
    "{{player}}": player.name,
    "{{playerAtelier}}": fallback ? "ton atelier" : `l’atelier ${owner}`,
    "{{playerChez}}": fallback ? "chez toi" : `chez ${player.name}`,
    "{{playerFleurs}}": fallback ? "Tes fleurs" : `Les fleurs ${owner}`,
    "{{playerCarnet}}": fallback ? "ton carnet" : `le carnet ${owner}`,
    "{{playerQuartier}}": fallback ? "ton quartier" : `le quartier ${owner}`,
    "{{playerDest}}": fallback ? "à toi" : `à ${player.name}`,
    "{{playerIntro}}": fallback ? "" : `Moi, c’est ${player.name}. `,
  };
  return text.replace(/\{\{player(?:Atelier|Chez|Fleurs|Carnet|Quartier|Dest|Intro)?\}\}/g, token => replacements[token]);
}

function getArtworkAlt(image: KqSocialFeedPresentation["image"], player: KqSocialPlayer): string {
  if (image === "still-life") return "Un carnet et un appareil photo sur une table crème, sans personnage ni main.";
  if (!player.profile) return image === "workshop" ? "Un établi avec des bocaux et des sachets dans un atelier." : "Deux voisins devant un atelier.";
  return personalize(image === "workshop" ? "{{player}} près de l’établi, avec les bocaux et les sachets de l’atelier." : "{{player}} avec deux voisins devant l’atelier.", player);
}

function getPersonalizedArtwork(scenarioId: string, player: KqSocialPlayer): KqSocialArtwork | undefined {
  const artwork = getKqSocialArtwork(scenarioId);
  if (!artwork) return undefined;
  return { ...artwork, alt: player.profile && artwork.playerPlacement !== "none" ? `${artwork.alt} Ton personnage (${player.name}) apparaît dans la scène.` : artwork.alt };
}

function commentsForPlayer(comments: KqSocialContentMessage[], player: KqSocialPlayer): KqSocialFeedMessage[] {
  return comments.map(comment => ({ id: comment.id, author: KQ_SOCIAL_FEED_PEOPLE[comment.person], text: personalize(comment.text, player), ...(comment.kind ? { kind: comment.kind } : {}) }));
}

const stories = new Map(KQ_SOCIAL_CONTENT.map(content => [content.scenario.id, content]));

/** The caption, context and reply all follow the same committed memory branch as the game. */
export function getKqSocialFeed(scene: KqSocialScenario, memory: Record<string, string> = {}, player: KqSocialPlayer = DEFAULT_KQ_SOCIAL_PLAYER): KqSocialFeedPresentation {
  if (scene.narrativeVersion === 3) {
    const story = getKqSocialProducerNarrative(scene.id, scene.previousChoice);
    const artwork = getKqSocialProducerArtwork(scene.subject);
    return { author: player, caption: "", comments: [], image: story.image,
      imageAlt: artwork?.alt ?? getArtworkAlt(story.image, player), artwork, location: "Ton journal de producteur",
      choicePosts: Object.fromEntries(Object.entries(story.choices).map(([id, choice]) => [id, personalize(renderKqSocialSubject(choice.post, scene.subject), player)])) };
  }
  const content = stories.get(scene.id);
  const artwork = getPersonalizedArtwork(scene.id, player);
  if (!content) return {
    author: KQ_SOCIAL_FEED_PEOPLE.jade, caption: personalize(scene.body, player), image: "workshop",
    imageAlt: artwork?.alt ?? getArtworkAlt("workshop", player), artwork, location: "Journal de culture indoor", comments: [],
    choicePosts: Object.fromEntries(scene.choices.map(choice => [choice.id, personalize(choice.description, player)])),
  };
  const source = content.feed;
  const followup = scene.followups?.find(item => memory[item.fromScenarioId] === item.fromChoiceId);
  const branch = followup && content.branches?.find(item => item.fromScenarioId === followup.fromScenarioId && item.fromChoiceId === followup.fromChoiceId);
  return structuredClone({
    author: KQ_SOCIAL_FEED_PEOPLE[source.author], image: source.image,
    caption: personalize(branch?.caption ?? source.caption, player), imageAlt: artwork?.alt ?? getArtworkAlt(source.image, player),
    artwork, location: "Journal de culture indoor",
    comments: commentsForPlayer(branch ? [source.comments[0], branch.message] : source.comments, player),
    choicePosts: Object.fromEntries(Object.entries(source.choicePosts).map(([id, text]) => [id, personalize(text, player)])),
  });
}

/** Old receipts retain their original journal outcome; never rewrite their published message. */
export function getKqSocialFeedOutcome(entry: KqSocialHistoryEntry, player: KqSocialPlayer = DEFAULT_KQ_SOCIAL_PLAYER): { author: KqSocialFeedPerson; text: string; comments: KqSocialFeedMessage[]; image: KqSocialFeedPresentation["image"]; imageAlt: string; artwork?: KqSocialArtwork } | null {
  if (entry.narrativeVersion === 3) {
    if (!entry.subject || !entry.platform || !Number.isSafeInteger(entry.trustDelta)) return null;
    const story = getKqSocialProducerNarrative(entry.scenarioId, entry.previousChoice), choice = story.choices[entry.choiceId];
    if (!choice) return null;
    const artwork = getKqSocialProducerArtwork(entry.subject);
    return { author: player, text: personalize(renderKqSocialSubject(choice.post, entry.subject), player),
      comments: commentsForPlayer(choice.replies.map((reply, index) => ({ ...reply, id: `${entry.id}:reply:${index}`, text: renderKqSocialSubject(reply.text, entry.subject) })), player),
      image: story.image, imageAlt: artwork?.alt ?? getArtworkAlt(story.image, player), artwork };
  }
  if (entry.narrativeVersion !== 2 || typeof entry.trustDelta !== "number" || !Number.isSafeInteger(entry.trustDelta)) return null;
  const content = stories.get(entry.scenarioId);
  if (!content || content.scenario.platform !== entry.platform || !content.scenario.choices.some(choice => choice.id === entry.choiceId)) return null;
  const text = content.feed.choicePosts[entry.choiceId];
  const replies = content.choiceReplies?.[entry.choiceId];
  if (!text || !replies) return null;
  const image = content.publishedImages?.[entry.choiceId] ?? content.feed.image;
  const artwork = getPersonalizedArtwork(entry.scenarioId, player);
  return structuredClone({
    author: player, text: personalize(text, player),
    comments: commentsForPlayer(replies, player).map(comment => ({ ...comment, id: `${entry.id}:${comment.id}` })),
    image, imageAlt: artwork?.alt ?? getArtworkAlt(image, player), artwork,
  });
}
