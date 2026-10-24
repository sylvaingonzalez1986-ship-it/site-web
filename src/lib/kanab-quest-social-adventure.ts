import { KQ_STAGES } from "./kanab-quest-game";
import { isKqSocialCultureContext } from "./kanab-quest-social-culture";
import { KQ_SOCIAL_SCENARIOS } from "./kanab-quest-social-stories";
import { getKqSocialProducerNarrative, renderKqSocialSubject } from "./kanab-quest-social-producer";
import type { KqSocialRequirement, KqSocialSubject } from "./kanab-quest-social-producer-types";
import type { KqSocialPlatform, KqSocialSnapshot } from "./kanab-quest-social-types";

export function getKqSocialSubjects(snapshot: KqSocialSnapshot, requirement: KqSocialRequirement): KqSocialSubject[] {
  if (requirement === "general") return [{ id: "general", requirement }];
  const context = snapshot.culture;
  if (!isKqSocialCultureContext(context) || context.source !== "own") return [];
  if (["culture", "flowering", "problem"].includes(requirement)) {
    return context.runs.filter(run => !run.cultureDead && run.phase !== "complete" && run.cultivation === "indoor"
      && run.stageIndex < 5 && (requirement !== "flowering" || run.stageIndex >= 3)
      && (requirement !== "problem" || run.problem))
      .map(run => ({ id: `run:${run.id}`, requirement, variety: run.varietyName, stage: KQ_STAGES[run.stageIndex].toLowerCase(),
        ...(run.zoneName ? { zone: run.zoneName } : {}), ...(requirement === "problem" ? { problem: run.problem!.symptom } : {}) }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }
  return context.lots.filter(lot => lot.cultivation === "indoor" && lot.remainingGrams !== null && lot.remainingGrams > 0
    && (requirement === "harvest" ? lot.harvestedAt && lot.harvestGrams !== null && lot.harvestGrams > 0
      : lot.stage === (requirement === "curing" ? "curing" : "ready")))
    .map(lot => ({ id: `lot:${lot.id}`, requirement, variety: lot.varietyName,
      ...(lot.harvestedAt ? { harvestedAt: lot.harvestedAt } : {}),
      ...(requirement === "harvest" && lot.harvestGrams !== null ? { harvestGrams: lot.harvestGrams } : {}) }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** A short binding to the exact preview, not a client assertion about the farm. */
function contextKey(value: unknown): string {
  let hash = 2166136261;
  for (const char of JSON.stringify(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `v3-${(hash >>> 0).toString(36)}`;
}

// PostgreSQL JSONB reorders object keys. Identity depends on facts, not key order.
const subjectFacts = (subject?: KqSocialSubject) => subject ? [subject.id, subject.requirement, subject.variety ?? null,
  subject.stage ?? null, subject.problem ?? null, subject.harvestGrams ?? null, subject.zone ?? null, subject.harvestedAt ?? null] : null;

export function getKqSocialAdventure(snapshot: KqSocialSnapshot, platform: KqSocialPlatform, subjectId?: string) {
  const account = snapshot.platforms[platform], scenes = KQ_SOCIAL_SCENARIOS.filter(scene => scene.platform === platform);
  let index = account.chapter % scenes.length, subject: KqSocialSubject | undefined;
  let subjects: KqSocialSubject[] = [], continuing = false;
  const pending = scenes[index];
  if (pending.episode !== 1 && account.story) {
    const start = scenes[index - pending.episode + 1];
    const available = getKqSocialSubjects(snapshot, getKqSocialProducerNarrative(pending.id).requirement);
    if (start?.id === account.story.startId && available.some(candidate => JSON.stringify(subjectFacts(candidate)) === JSON.stringify(subjectFacts(account.story!.subject)))) {
      subject = account.story.subject; subjects = [subject]; continuing = true;
    }
  }
  if (!continuing) {
    if (pending.episode !== 1) index = (index + 4 - pending.episode) % scenes.length;
    for (let offset = 0; offset < scenes.length; offset += 3) {
      const candidateIndex = (index + offset) % scenes.length, candidate = scenes[candidateIndex];
      if (candidate.id === "ig-first-frame" && account.memory["ig-collab"]) continue;
      const available = getKqSocialSubjects(snapshot, getKqSocialProducerNarrative(candidate.id).requirement);
      if (!available.length) continue;
      index = candidateIndex; subjects = available;
      subject = subjectId ? available.find(candidate => candidate.id === subjectId) : available.length === 1 ? available[0] : undefined;
      break;
    }
  }
  const scene = structuredClone(scenes[index]);
  const followup = continuing ? scene.followups?.find(branch => account.memory[branch.fromScenarioId] === branch.fromChoiceId) : undefined;
  const story = getKqSocialProducerNarrative(scene.id, followup?.fromChoiceId);
  scene.body = renderKqSocialSubject(story.body, subject);
  scene.title = renderKqSocialSubject(story.title, subject);
  scene.subject = subject;
  scene.previousChoice = followup?.fromChoiceId;
  for (const choice of scene.choices) {
    const authored = story.choices[choice.id];
    for (const key of ["label", "description", "upside", "downside", "outcome"] as const) choice[key] = renderKqSocialSubject(authored[key], subject);
    const modifier = followup?.choiceModifiers?.[choice.id];
    if (modifier) for (const key of Object.keys(modifier) as Array<keyof typeof modifier>) choice.effects[key] += modifier[key] ?? 0;
  }
  return { scene, subject, subjects, chapter: index, continuing,
    contextKey: contextKey({ id: scene.id, subject: subjectFacts(subject), body: scene.body, choices: scene.choices, previousChoice: scene.previousChoice }) };
}
