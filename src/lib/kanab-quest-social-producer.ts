import { KQ_SOCIAL_PRODUCER_INSTAGRAM } from "./kanab-quest-social-producer-instagram";
import { KQ_SOCIAL_PRODUCER_X } from "./kanab-quest-social-producer-x";
import { KQ_SOCIAL_DEBATE_NARRATIVES } from "./kanab-quest-social-debates";
import type { KqSocialScenario } from "./kanab-quest-social-types";
import type { KqSocialProducerNarrative, KqSocialSubject } from "./kanab-quest-social-producer-types";

export const KQ_SOCIAL_PRODUCER_NARRATIVES: Record<string, KqSocialProducerNarrative> = {
  ...KQ_SOCIAL_PRODUCER_INSTAGRAM, ...KQ_SOCIAL_PRODUCER_X, ...KQ_SOCIAL_DEBATE_NARRATIVES,
};

export function getKqSocialProducerNarrative(id: string, previousChoice?: string): KqSocialProducerNarrative {
  const original = KQ_SOCIAL_PRODUCER_NARRATIVES[id];
  if (!original) throw new Error(`Missing producer narrative: ${id}`);
  const story = structuredClone(original), branch = previousChoice ? story.continuations?.[previousChoice] : undefined;
  if (branch) {
    story.body = branch.body;
    for (const [key, changes] of Object.entries(branch.choices ?? {})) story.choices[key] = { ...story.choices[key], ...changes };
  }
  return story;
}

/** Fixed authored vocabulary; replacing once never interprets a player's variety as a template. */
export function renderKqSocialSubject(text: string, subject?: KqSocialSubject | null): string {
  const values: Record<string, string> = {
    variety: subject?.variety ?? "ta variété", stage: subject?.stage ?? "son stade actuel",
    problem: subject?.problem ?? "le symptôme observé",
    harvestGrams: subject?.harvestGrams?.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) ?? "—",
  };
  return text.replace(/\{\{(variety|stage|problem|harvestGrams)\}\}/g, (_token, key: string) => values[key]);
}

/** Stable IDs/effects are shared with the historic catalogue; every V3 word is separately authored. */
export function applyKqSocialProducerNarrative(original: KqSocialScenario): KqSocialScenario {
  const story = getKqSocialProducerNarrative(original.id);
  return {
    ...original, narrativeVersion: 3, arc: story.arc, title: story.title, body: story.body,
    audience: story.audience, character: story.character,
    choices: original.choices.map(choice => {
      const authored = story.choices[choice.id];
      if (!authored) throw new Error(`Missing producer choice: ${original.id}/${choice.id}`);
      const { label, description, upside, downside, outcome } = authored;
      return { ...choice, label, description, upside, downside, outcome, ...(authored.action ? { action: authored.action } : {}) };
    }),
    followups: original.followups?.map(followup => {
      const branch = story.continuations?.[followup.fromChoiceId];
      if (!branch) throw new Error(`Missing producer continuation: ${original.id}/${followup.fromChoiceId}`);
      return { ...followup, body: branch.body };
    }),
  };
}

export function isKqSocialSubject(value: unknown): value is KqSocialSubject {
  if (!value || typeof value !== "object") return false;
  const subject = value as Record<string, unknown>;
  if (typeof subject.id !== "string" || subject.id.length > 180 || !["general", "culture", "flowering", "problem", "harvest", "curing", "ready"].includes(String(subject.requirement))) return false;
  if (!["variety", "stage", "problem", "zone"].every(key => subject[key] === undefined || typeof subject[key] === "string" && (subject[key] as string).length <= 400)) return false;
  if (subject.harvestedAt !== undefined && (typeof subject.harvestedAt !== "string" || subject.harvestedAt.length > 40 || !Number.isFinite(Date.parse(subject.harvestedAt)))) return false;
  return subject.harvestGrams === undefined || typeof subject.harvestGrams === "number" && Number.isFinite(subject.harvestGrams) && subject.harvestGrams > 0 && subject.harvestGrams <= 1_000_000_000;
}
