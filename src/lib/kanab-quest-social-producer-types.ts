import type { KqSocialContentImage, KqSocialContentMessage } from "./kanab-quest-social-content";

export type KqSocialRequirement = "general" | "culture" | "flowering" | "problem" | "harvest" | "curing" | "ready";
export type KqSocialProducerChoice = {
  label: string; description: string; upside: string; downside: string;
  outcome: string; post: string;
  replies: [KqSocialContentMessage, KqSocialContentMessage];
};
/** The player writes every post. NPCs appear only in the resulting replies. */
export type KqSocialProducerNarrative = {
  requirement: KqSocialRequirement;
  arc: string; title: string; body: string; audience: string; character: string;
  image: KqSocialContentImage;
  choices: Record<string, KqSocialProducerChoice>;
  continuations?: Record<string, {
    body: string;
    choices?: Record<string, Partial<KqSocialProducerChoice>>;
  }>;
};

/** Small immutable record of the observed subject, not the entire farm state. */
export type KqSocialSubject = {
  id: string;
  requirement: KqSocialRequirement;
  variety?: string;
  stage?: string;
  problem?: string;
  harvestGrams?: number;
  harvestedAt?: string;
  zone?: string;
};
