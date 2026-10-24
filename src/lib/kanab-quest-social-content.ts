import type { KqSocialChoice, KqSocialEffects, KqSocialScenario } from "./kanab-quest-social-types";

export type KqSocialContentPerson = "mila" | "jade" | "noe" | "ines" | "sam" | "visitor" | "skeptic";
export type KqSocialContentImage = "workshop" | "still-life" | "community";
export type KqSocialContentMessage = { id: string; person: KqSocialContentPerson; text: string; kind?: "reply" | "quote" };
/** Keep each authored episode, its playable decisions and its feed together. */
export type KqSocialStoryContent = {
  scenario: KqSocialScenario;
  feed: { author: KqSocialContentPerson; image: KqSocialContentImage; caption: string; comments: KqSocialContentMessage[]; choicePosts: Record<string, string> };
  branches?: Array<{ fromScenarioId: string; fromChoiceId: string; message: KqSocialContentMessage; caption?: string }>;
  choiceReplies?: Record<string, KqSocialContentMessage[]>;
  publishedImages?: Partial<Record<string, KqSocialContentImage>>;
};

export function socialChoice(
  id: string, label: string, description: string, upside: string, downside: string, outcome: string,
  intent: KqSocialChoice["intent"], tag: KqSocialChoice["tag"],
  [followersMin, followersMax, haters, trust, moderation, energy]: [number, number, number, number, number, number],
): KqSocialChoice {
  return { id, label, description, upside, downside, outcome, intent, tag, effects: { followersMin, followersMax, haters, trust, moderation, energy } };
}

export const socialGrowth = (min: number, max: number, rest: Partial<KqSocialEffects> = {}): Partial<KqSocialEffects> => ({ followersMin: min, followersMax: max, ...rest });
