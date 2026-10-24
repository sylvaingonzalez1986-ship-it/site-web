import type { KqSocialContentImage, KqSocialContentMessage, KqSocialContentPerson } from "./kanab-quest-social-content";

/** Authored text is kept separate from stable command IDs and game balancing. */
export type KqSocialNarrative = {
  arc: string;
  title: string;
  body: string;
  audience: string;
  character: string;
  author: KqSocialContentPerson;
  image: KqSocialContentImage;
  caption: string;
  comments: [KqSocialContentMessage, KqSocialContentMessage];
  choices: Record<string, {
    label: string; description: string; upside: string; downside: string;
    outcome: string; post: string;
    replies: [KqSocialContentMessage, KqSocialContentMessage];
  }>;
  continuations?: Record<string, {
    body: string;
    comment: KqSocialContentMessage;
    caption?: string;
  }>;
};
