import type { KqSocialContentMessage, KqSocialStoryContent } from "./kanab-quest-social-content";
import { KQ_SOCIAL_CBD_INSTAGRAM } from "./kanab-quest-social-cbd-instagram";
import { KQ_SOCIAL_CBD_X } from "./kanab-quest-social-cbd-x";
import type { KqSocialScenario } from "./kanab-quest-social-types";

export const KQ_SOCIAL_NARRATIVES = { ...KQ_SOCIAL_CBD_INSTAGRAM, ...KQ_SOCIAL_CBD_X };
const identified = (message: KqSocialContentMessage, id: string): KqSocialContentMessage => ({ ...message, id });

/** Change the story while retaining command IDs, economic effects and memory rules. */
export function applyKqSocialNarrative(original: KqSocialScenario): KqSocialStoryContent {
  const story = KQ_SOCIAL_NARRATIVES[original.id];
  if (!story) throw new Error(`Missing CBD narrative: ${original.id}`);
  const choices = original.choices.map(originalChoice => {
    const text = story.choices[originalChoice.id];
    if (!text) throw new Error(`Missing CBD choice: ${original.id}/${originalChoice.id}`);
    const { label, description, upside, downside, outcome } = text;
    return { ...originalChoice, label, description, upside, downside, outcome };
  });
  const followups = original.followups?.map(originalFollowup => {
    const text = story.continuations?.[originalFollowup.fromChoiceId];
    if (!text) throw new Error(`Missing CBD continuation: ${original.id}/${originalFollowup.fromChoiceId}`);
    return { ...originalFollowup, body: text.body };
  });
  return {
    scenario: { ...original, arc: story.arc, title: story.title, body: story.body, audience: story.audience, character: story.character, choices, ...(followups ? { followups } : {}) },
    feed: {
      author: story.author, image: story.image, caption: story.caption,
      comments: story.comments.map((comment, index) => identified(comment, `${original.id}:opening:${index}`)),
      choicePosts: Object.fromEntries(choices.map(choice => [choice.id, story.choices[choice.id].post])),
    },
    choiceReplies: Object.fromEntries(choices.map(choice => [choice.id, story.choices[choice.id].replies.map((reply, index) => identified(reply, `${original.id}:${choice.id}:reply:${index}`))])),
    branches: (followups ?? []).map(followup => {
      const text = story.continuations![followup.fromChoiceId];
      return { fromScenarioId: followup.fromScenarioId, fromChoiceId: followup.fromChoiceId,
        message: identified(text.comment, `${original.id}:after:${followup.fromChoiceId}`), ...(text.caption ? { caption: text.caption } : {}) };
    }),
  };
}
