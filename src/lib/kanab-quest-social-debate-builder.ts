import type { KqSocialContentPerson } from "./kanab-quest-social-content";
import type { KqSocialProducerChoice, KqSocialProducerNarrative } from "./kanab-quest-social-producer-types";
import type { KqSocialChoice, KqSocialEffects, KqSocialPlatform, KqSocialScenario } from "./kanab-quest-social-types";

/** New IDs only: published receipts from the earlier catalogues keep their wording. */
type Voice = [KqSocialContentPerson, string];
export type DraftChoice = KqSocialProducerChoice & Pick<KqSocialChoice, "intent" | "tag" | "effects">;
export type DraftNarrative = Omit<KqSocialProducerNarrative, "choices"> & { choices: Record<string, DraftChoice> };
type Mood = "reach" | "craft" | "care";
const voiceNames: Record<KqSocialContentPerson, string> = { mila: "Mila", jade: "Jade", noe: "Noé", ines: "Inès", sam: "Sami", visitor: "Lou", skeptic: "Max" };

const effects: Record<Mood, KqSocialEffects> = {
  reach: { followersMin: 27, followersMax: 40, haters: 8, trust: -3, moderation: 0, energy: -14 },
  craft: { followersMin: 15, followersMax: 24, haters: 1, trust: 5, moderation: 0, energy: -19 },
  care: { followersMin: 2, followersMax: 5, haters: -4, trust: 2, moderation: 0, energy: -6 },
};
const tradeoffs: Record<Mood, [string, string]> = {
  reach: ["Une formule qui peut circuler au-delà des habitués.", "Plus de tension ; une partie des lecteurs se méfie du ton."],
  craft: ["Des repères utiles aux lecteurs qui veulent comprendre.", "Une réponse exigeante, sans garantie de convaincre."],
  care: ["Une prise de parole courte, plus facile à tenir.", "Le sujet voyage peu et certaines questions restent ouvertes."],
};

export function choice(label: string, description: string, mood: Mood, post: string, outcome: string, a: Voice, b: Voice): DraftChoice {
  return { label, description, intent: mood, tag: mood === "reach" ? "dialogue" : mood === "craft" ? "craft" : "community",
    action: "publish", post, outcome, upside: tradeoffs[mood][0], downside: tradeoffs[mood][1], effects: { ...effects[mood] },
    replies: [a, b].map(([person, text]) => ({ id: "", person, text })) };
}

export function reply(label: string, description: string, mood: "reach" | "craft", post: string, outcome: string, a: Voice, b: Voice): DraftChoice {
  const result = choice(label, description, mood, post, outcome, a, b);
  return { ...result, action: "reply", effects: { ...result.effects,
    ...(mood === "reach" ? { followersMin: 23, followersMax: 36, haters: 11, trust: -5, energy: -12 }
      : { followersMin: 11, followersMax: 20, haters: -2, trust: 5, energy: -21 }) } };
}

export function ignore(outcome: string): DraftChoice {
  return { label: "Ignorer le commentaire", description: "Tu ne réponds pas et tu laisses le commentaire visible. Aucune publication n’est envoyée.",
    intent: "care", tag: "community", action: "ignore", post: "", replies: [], outcome,
    upside: "Tu économises ton énergie et tu ne relances pas l’échange.", downside: "L’affirmation reste visible, sans réponse de ta part.",
    effects: { followersMin: 0, followersMax: 0, haters: -3, trust: 0, moderation: 0, energy: -2 } };
}

export function createDebateCatalog() {
  const scenarios: KqSocialScenario[] = [];
  const narratives: Record<string, KqSocialProducerNarrative> = {};

  function identifyReplies(id: string, choices: Record<string, KqSocialProducerChoice>): Record<string, KqSocialProducerChoice> {
    return Object.fromEntries(Object.entries(choices).map(([key, value]) => [key, { ...value,
      replies: value.replies.map((message, index) => ({ ...message, id: `${id}:${key}:reply:${index}` })) }]));
  }

  function add(id: string, platform: KqSocialPlatform, episode: 1 | 2 | 3, draft: DraftNarrative, previousId?: string) {
    const authored = Object.fromEntries(Object.entries(draft.choices).map(([key, value]) => {
      const { label, description, upside, downside, outcome, action, post, replies } = value;
      return [key, { label, description, upside, downside, outcome, action, post, replies }];
    }));
    const story: KqSocialProducerNarrative = { ...draft, choices: identifyReplies(id, authored) };
    for (const [previousChoice, branch] of Object.entries(story.continuations ?? {})) {
      for (const [key, patch] of Object.entries(branch.choices ?? {})) {
        if (patch.replies) patch.replies = patch.replies.map((message, index) => ({ ...message, id: `${id}:${previousChoice}:${key}:reply:${index}` }));
      }
    }
    narratives[id] = story;
    scenarios.push({ id, platform, episode, arc: story.arc, title: story.title, body: story.body, audience: story.audience, character: story.character,
      choices: Object.entries(draft.choices).map(([key, value]) => ({ id: key, label: value.label, description: value.description,
        upside: value.upside, downside: value.downside, outcome: value.outcome, intent: value.intent, tag: value.tag, effects: value.effects })),
    ...(previousId ? { followups: Object.entries(story.continuations ?? {}).map(([fromChoiceId, branch]): NonNullable<KqSocialScenario["followups"]>[number] => ({
        fromScenarioId: previousId, fromChoiceId, body: branch.body,
        choiceModifiers: episode === 2 ? (scenarios.find(scene => scene.id === previousId)?.choices.find(item => item.id === fromChoiceId)?.intent === "reach"
          ? { sharp: { haters: 3, trust: -1 }, explain: { energy: -2 } }
          : scenarios.find(scene => scene.id === previousId)?.choices.find(item => item.id === fromChoiceId)?.intent === "craft"
            ? { explain: { followersMin: 2, followersMax: 3 } } : { ignore: { energy: 1 } })
          : fromChoiceId === "sharp" ? { challenge: { haters: 3, trust: -2 }, document: { energy: -2 } }
            : fromChoiceId === "explain" ? { document: { followersMin: 2, followersMax: 3 } } : { refocus: { energy: 1 } },
      })) } : {}) });
  }

  /** The feed shows the exact post and comment; context adds only what this branch changes. */
  function replyBranches(previousId: string, contexts: Record<string, string>): NonNullable<KqSocialProducerNarrative["continuations"]> {
    const previous = narratives[previousId];
    return Object.fromEntries(Object.entries(previous.choices).map(([id, value]) => [id, {
      body: `${voiceNames[value.replies[0].person]} réagit sous ta publication. ${contexts[id]} Tu peux répondre dans la discussion ci-dessous ou laisser passer.`,
    }]));
  }

  return { add, replyBranches, scenarios, narratives };
}

export function finishBranches(contexts: Record<"sharp" | "explain" | "ignore", { body: string; lead: string }>, choices: Record<string, DraftChoice>): NonNullable<KqSocialProducerNarrative["continuations"]> {
  return Object.fromEntries(Object.entries(contexts).map(([previousChoice, context]) => [previousChoice, {
    body: context.body,
    choices: Object.fromEntries(Object.entries(choices).map(([id, value]) => [id, { post: `${context.lead}\n\n${value.post}` }])),
  }]));
}
