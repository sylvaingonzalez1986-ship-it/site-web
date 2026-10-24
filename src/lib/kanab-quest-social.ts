import { KQ_SOCIAL_LEGACY_SCENARIOS, KQ_SOCIAL_ORIGINAL_SCENARIOS, KQ_SOCIAL_SCENARIOS, KQ_SOCIAL_SPONSORS, KQ_SOCIAL_V2_SCENARIOS } from "./kanab-quest-social-stories";
import { getKqSocialAdventure } from "./kanab-quest-social-adventure";
import { isKqSocialSubject } from "./kanab-quest-social-producer";
import { isKqSocialCultureContext } from "./kanab-quest-social-culture";
import { isKqSocialSnapshot as isV1, getKqSocialVisits, isKqSocialUuid, type KqSocialSnapshot as V1Snapshot } from "./kanab-quest-social-v1";
import type { KqSocialAccount, KqSocialChoice, KqSocialChoicePreview, KqSocialCommand, KqSocialHistoryEntry, KqSocialPlatform, KqSocialScenario, KqSocialSnapshot, KqSocialSponsorOffer, KqSocialTag } from "./kanab-quest-social-types";
export type * from "./kanab-quest-social-types";
export { KQ_SOCIAL_SCENARIOS, KQ_SOCIAL_SPONSORS };
export { getKqSocialAdventure };
export { getKqSocialFame, getKqSocialVisits, isKqSocialUuid, KQ_SOCIAL_PLATFORMS } from "./kanab-quest-social-v1";
export const KQ_SOCIAL_POST_MS = 5 * 60_000;
export const KQ_SOCIAL_RECOVER_MS = 4 * 60 * 60_000;
export const KQ_SOCIAL_ENERGY_TICK_MS = 5 * 60_000;
export const KQ_SOCIAL_TAG_LABELS: Record<KqSocialTag, string> = { visual: "Mise en scène", craft: "Essai à l’atelier", dialogue: "Questions-réponses", community: "Rencontre avec la communauté" };
const platforms = ["instagram", "x"] as const;
const intents = ["reach", "craft", "care"] as const;
const tags = ["visual", "craft", "dialogue", "community"] as const;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const integer = (v: unknown, max = 2147483647): v is number => Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= max;
const time = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v));
const nullableTime = (v: unknown) => v === null || time(v);
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(s => typeof s === "string");

export function parseKqSocialCommand(v: unknown): KqSocialCommand | null {
  if (!object(v) || v.modelVersion !== 2 || !isKqSocialUuid(v.requestKey) || !integer(v.expectedRevision, 2147483646)) return null;
  const base = { modelVersion: 2 as const, requestKey: v.requestKey, expectedRevision: v.expectedRevision };
  const allowed = ["modelVersion", "action", "requestKey", "expectedRevision"];
  if (v.action === "choose") allowed.push("platform", "scenarioId", "choiceId", "narrativeVersion", "subjectId", "contextKey");
  if (v.action === "sponsor-accept" || v.action === "sponsor-decline") allowed.push("sponsorId");
  if (v.action === "sponsor-post") allowed.push("tag");
  if (Object.keys(v).some(key => !allowed.includes(key))) return null;
  if (v.action === "recover" || v.action === "sponsor-claim" || v.action === "sponsor-cancel") return { ...base, action: v.action };
  if (v.action === "sponsor-accept" || v.action === "sponsor-decline") {
    if (typeof v.sponsorId !== "string" || !KQ_SOCIAL_SPONSORS.some(s => s.id === v.sponsorId)) return null;
    return { ...base, action: v.action, sponsorId: v.sponsorId };
  }
  if (v.action === "sponsor-post") return tags.includes(v.tag as KqSocialTag) ? { ...base, action: "sponsor-post", tag: v.tag as KqSocialTag } : null;
  if (v.action !== "choose" || !platforms.includes(v.platform as KqSocialPlatform) || typeof v.scenarioId !== "string" || typeof v.choiceId !== "string") return null;
  const scene = KQ_SOCIAL_SCENARIOS.find(s => s.id === v.scenarioId && s.platform === v.platform);
  if (!scene?.choices.some(c => c.id === v.choiceId)) return null;
  if (v.narrativeVersion === undefined) {
    if (v.subjectId !== undefined || v.contextKey !== undefined) return null;
  } else if (v.narrativeVersion !== 3 || typeof v.subjectId !== "string" || !v.subjectId.length || v.subjectId.length > 180
    || typeof v.contextKey !== "string" || !/^v3-[a-z0-9]{1,8}$/.test(v.contextKey)) return null;
  return { ...base, action: "choose", platform: v.platform as KqSocialPlatform, scenarioId: v.scenarioId, choiceId: v.choiceId,
    ...(v.narrativeVersion === 3 ? { narrativeVersion: 3 as const, subjectId: v.subjectId as string, contextKey: v.contextKey as string } : {}) };
}

export function isKqSocialSnapshot(v: unknown): v is KqSocialSnapshot {
  if (!object(v) || v.version !== 2 || !integer(v.revision) || !time(v.serverNow) || !integer(v.energy, 100) || !time(v.energyUpdatedAt) || !nullableTime(v.recoverReadyAt)
    || !integer(v.audienceFollowers, 100000) || !integer(v.socialFollowers, 100000) || typeof v.siteActive !== "boolean" || typeof v.additionalVisitsPerDay !== "number" || !Number.isFinite(v.additionalVisitsPerDay) || v.additionalVisitsPerDay < 0 || !object(v.platforms)) return false;
  if (v.storyCatalogVersion !== undefined && v.storyCatalogVersion !== 2) return false;
  if (v.narrativeVersion !== undefined && v.narrativeVersion !== 2 && v.narrativeVersion !== 3) return false;
  if (v.culture !== undefined && !isKqSocialCultureContext(v.culture)) return false;
  for (const platform of platforms) {
    const p = v.platforms[platform];
    if (!object(p) || !integer(p.followers, 50000) || !integer(p.haters, 100) || !integer(p.moderation, 5) || !integer(p.chapter) || !nullableTime(p.nextPostAt)
      || !integer(p.trust, 100) || (p.lastIntent !== null && !intents.includes(p.lastIntent as typeof intents[number])) || !integer(p.intentStreak) || !time(p.pressureUpdatedAt)
      || !object(p.memory) || Object.keys(p.memory).length > 100 || !Object.entries(p.memory).every(([k, val]) => k.length <= 100 && typeof val === "string" && val.length <= 100)) return false;
    if (p.story !== undefined) {
      const story = p.story;
      if (!object(story) || typeof story.startId !== "string" || !KQ_SOCIAL_SCENARIOS.some(scene => scene.id === story.startId && scene.platform === platform && scene.episode === 1) || !isKqSocialSubject(story.subject)) return false;
    }
  }
  const accounts = v.platforms as Record<KqSocialPlatform, KqSocialAccount>;
  if (v.socialFollowers !== accounts.instagram.followers + accounts.x.followers) return false;
  if (!Array.isArray(v.history) || v.history.length > 20 || !v.history.every(h => object(h) && typeof h.id === "string" && (h.platform === null || platforms.includes(h.platform as KqSocialPlatform))
    && typeof h.scenarioId === "string" && typeof h.choiceId === "string" && time(h.createdAt) && typeof h.outcome === "string" && [h.followersDelta, h.hatersDelta, h.moderationDelta, h.energyDelta].every(Number.isSafeInteger)
    && (h.narrativeVersion === undefined || h.narrativeVersion === 2 || h.narrativeVersion === 3)
    && (h.subject === undefined || isKqSocialSubject(h.subject)) && (h.previousChoice === undefined || typeof h.previousChoice === "string" && h.previousChoice.length <= 100)
    && (h.trustDelta === undefined || Number.isSafeInteger(h.trustDelta)) && (h.rewardCents === undefined || integer(h.rewardCents)) && (h.reasons === undefined || strings(h.reasons)))) return false;
  const s = v.sponsors;
  if (!object(s) || !strings(s.completedIds) || !strings(s.declinedIds) || !integer(s.earnedCents) || new Set(s.completedIds).size !== s.completedIds.length || new Set(s.declinedIds).size !== s.declinedIds.length
    || [...s.completedIds, ...s.declinedIds].some(id => !KQ_SOCIAL_SPONSORS.some(def => def.id === id))) return false;
  const declined = s.declinedIds;
  if (s.completedIds.some(id => declined.includes(id))) return false;
  if (s.active !== null) {
    const a = s.active;
    if (!object(a) || typeof a.sponsorId !== "string" || !time(a.startedAt) || !integer(a.publicationsLeft, 4) || !integer(a.rewardCents) || !strings(a.progressTags) || new Set(a.progressTags).size !== a.progressTags.length) return false;
    const def = KQ_SOCIAL_SPONSORS.find(d => d.id === a.sponsorId);
    if (!def || a.platform !== def.platform || a.rewardCents !== def.rewardCents || a.progressTags.some(tag => !def.requiredTags.includes(tag as KqSocialTag)) || s.completedIds.includes(def.id) || declined.includes(def.id)) return false;
  }
  return true;
}

export function createKqSocialSnapshot(now: number, audienceFollowers = 0, siteActive = true, narrativeVersion: 2 | 3 = 3): KqSocialSnapshot {
  const at = new Date(now).toISOString();
  const account = (): KqSocialAccount => ({ followers: 0, haters: 0, moderation: 0, chapter: 0, nextPostAt: null, trust: 55, lastIntent: null, intentStreak: 0, memory: {}, pressureUpdatedAt: at });
  return { version: 2, storyCatalogVersion: 2, narrativeVersion, serverNow: at, revision: 0, energy: 100, energyUpdatedAt: at, recoverReadyAt: null, audienceFollowers, socialFollowers: 0, additionalVisitsPerDay: 0, siteActive,
    platforms: { instagram: account(), x: account() }, history: [], sponsors: { active: null, completedIds: [], declinedIds: [], earnedCents: 0 } };
}

/** Retain followers, receipts, restrictions and mental energy. New arcs start at their first scene. */
export function normalizeKqSocialSnapshot(snapshot: KqSocialSnapshot | V1Snapshot, now: number, narrativeVersion: 2 | 3 = 3): KqSocialSnapshot {
  if (isKqSocialSnapshot(snapshot)) {
    const next = structuredClone(snapshot);
    if (next.storyCatalogVersion !== 2) {
      // The old cursor looped over nine stories. Preserve the next episode and its memory.
      for (const platform of platforms) {
        const originalCount = KQ_SOCIAL_ORIGINAL_SCENARIOS.filter(scene => scene.platform === platform).length;
        const account = next.platforms[platform];
        if (account.chapter >= originalCount) account.chapter = account.chapter % originalCount || originalCount;
      }
      next.storyCatalogVersion = 2;
    }
    if (next.narrativeVersion !== narrativeVersion) {
      // Old choice IDs now describe different publications. Keep the player's
      // progress and receipts, but never invent continuity with the new text.
      for (const platform of platforms) {
        next.platforms[platform].memory = {};
        delete next.platforms[platform].story;
        if (narrativeVersion === 3) next.platforms[platform].chapter = 0;
      }
      next.narrativeVersion = narrativeVersion;
    }
    return next;
  }
  if (!isV1(snapshot)) throw new Error("Les données de tes réseaux sont incomplètes. Actualise la page.");
  const next = createKqSocialSnapshot(now, snapshot.audienceFollowers, snapshot.siteActive, narrativeVersion);
  Object.assign(next, { revision: snapshot.revision, energy: snapshot.energy, energyUpdatedAt: snapshot.energyUpdatedAt, recoverReadyAt: snapshot.recoverReadyAt, history: structuredClone(snapshot.history), socialFollowers: snapshot.socialFollowers, additionalVisitsPerDay: snapshot.additionalVisitsPerDay });
  for (const platform of platforms) Object.assign(next.platforms[platform], { ...snapshot.platforms[platform], chapter: 0, pressureUpdatedAt: snapshot.serverNow });
  return next;
}

export function refreshKqSocialSnapshot(snapshot: KqSocialSnapshot | V1Snapshot, now: number, reputation = 0, narrativeVersion: 2 | 3 = 3): KqSocialSnapshot {
  const next = normalizeKqSocialSnapshot(snapshot, now, narrativeVersion);
  const elapsed = Math.max(0, Math.floor((now - Date.parse(next.energyUpdatedAt)) / KQ_SOCIAL_ENERGY_TICK_MS));
  next.energy = Math.min(100, next.energy + elapsed);
  next.energyUpdatedAt = new Date(next.energy === 100 ? Math.max(now, Date.parse(next.energyUpdatedAt)) : Date.parse(next.energyUpdatedAt) + elapsed * KQ_SOCIAL_ENERGY_TICK_MS).toISOString();
  for (const platform of platforms) {
    const a = next.platforms[platform];
    const hours = Math.max(0, Math.floor((now - Date.parse(a.pressureUpdatedAt)) / 3600000));
    a.haters = Math.max(0, a.haters - hours * 2);
    a.pressureUpdatedAt = new Date(a.haters === 0 ? Math.max(now, Date.parse(a.pressureUpdatedAt)) : Date.parse(a.pressureUpdatedAt) + hours * 3600000).toISOString();
  }
  next.serverNow = new Date(now).toISOString();
  next.socialFollowers = next.platforms.instagram.followers + next.platforms.x.followers;
  next.additionalVisitsPerDay = getKqSocialVisits(next.audienceFollowers, next.socialFollowers, reputation);
  delete next.replayed;
  return next;
}

export function getKqSocialScenario(platform: KqSocialPlatform, chapter: number, memory: Record<string, string> = {}, catalog = KQ_SOCIAL_SCENARIOS): KqSocialScenario {
  const scenes = catalog.filter(s => s.platform === platform);
  const scene = structuredClone(scenes[(Number.isSafeInteger(chapter) && chapter >= 0 ? chapter : 0) % scenes.length]);
  const followup = scene.followups?.find(f => memory[f.fromScenarioId] === f.fromChoiceId);
  if (followup) {
    scene.body = followup.body;
    for (const choice of scene.choices) {
      const modifier = followup.choiceModifiers?.[choice.id];
      if (modifier) for (const key of Object.keys(modifier) as Array<keyof typeof modifier>) choice.effects[key] += modifier[key] ?? 0;
    }
  }
  return scene;
}

export function getKqSocialChoicePreview(snapshot: KqSocialSnapshot, platform: KqSocialPlatform, choice: KqSocialChoice): KqSocialChoicePreview {
  const a = snapshot.platforms[platform];
  const reasons: string[] = [];
  const reach = 1 + Math.min(3, Math.sqrt(a.followers) / 20), affinity = (65 + a.trust) / 120, pressure = 1 - a.haters / 200;
  const moderation = platform === "instagram" && a.moderation >= 3 ? .5 : 1;
  const repeat = a.lastIntent === choice.intent && a.intentStreak >= 2 ? .55 : 1;
  const churn = Math.floor(a.followers * Math.max(0, 45 - a.trust) / 2500) + (choice.effects.trust < 0 ? Math.floor(a.followers * -choice.effects.trust / 1500) : 0);
  if (a.followers >= 100) reasons.push("Ta communauté élargit la portée, avec une croissance progressive.");
  if (a.trust >= 70) reasons.push("La confiance aide les nouveaux visiteurs à rester.");
  if (a.trust < 45) reasons.push("La confiance fragilisée provoque aussi des désabonnements.");
  if (a.haters >= 25) reasons.push("La pression des haters réduit la conversion des lecteurs en abonnés.");
  if (moderation < 1) reasons.push("La restriction Instagram réduit de moitié les nouvelles adhésions.");
  if (repeat < 1) reasons.push("Troisième publication de même intention : ton public se lasse, la portée baisse de 45 %.");
  const delta = (base: number) => {
    const raw = base > 0 ? Math.floor(base * reach * affinity * pressure * moderation * repeat) - churn : Math.floor(base * reach) - churn;
    const limited = clamp(a.followers + raw, 0, 50000) - a.followers;
    return clamp(snapshot.audienceFollowers + limited, 0, 100000) - snapshot.audienceFollowers;
  };
  const cost = choice.effects.energy - (platform === "x" && choice.intent !== "care" ? Math.floor(a.haters / 25) : 0);
  const heat = choice.effects.haters > 0 ? choice.effects.haters + (choice.intent === "reach" ? Math.min(6, Math.floor(Math.sqrt(a.followers) / 10)) : 0) : choice.effects.haters;
  return { followersMin: delta(choice.effects.followersMin), followersMax: delta(choice.effects.followersMax),
    haters: clamp(a.haters + heat, 0, 100) - a.haters, trust: clamp(a.trust + choice.effects.trust, 0, 100) - a.trust,
    moderation: clamp(a.moderation + choice.effects.moderation, 0, 5) - a.moderation, energy: cost, reasons };
}

export function getKqSponsorOffers(snapshot: KqSocialSnapshot): KqSocialSponsorOffer[] {
  return KQ_SOCIAL_SPONSORS.map(sponsor => {
    const a = snapshot.platforms[sponsor.platform], blockers: string[] = [];
    if (a.followers < sponsor.minimumFollowers) blockers.push(`${sponsor.minimumFollowers} abonnés sur ${sponsor.platform === "x" ? "X" : "Instagram"} requis (${a.followers} actuellement).`);
    if (a.trust < sponsor.minimumTrust) blockers.push(`Confiance : ${sponsor.minimumTrust}/100 requis (${a.trust}/100).`);
    if (a.haters > sponsor.maxHaters) blockers.push(`La pression doit redescendre à ${sponsor.maxHaters}/100 maximum.`);
    if (a.moderation > sponsor.maxModeration) blockers.push(`Au plus ${sponsor.maxModeration} alerte(s) de modération.`);
    if (snapshot.sponsors.active && snapshot.sponsors.active.sponsorId !== sponsor.id) blockers.push("Termine ton partenariat en cours avant d’en signer un autre.");
    const status = snapshot.sponsors.completedIds.includes(sponsor.id) ? "completed" : snapshot.sponsors.declinedIds.includes(sponsor.id) ? "declined"
      : snapshot.sponsors.active?.sponsorId === sponsor.id ? "active" : blockers.length ? "locked" : "available";
    return { sponsor, eligible: status === "available", blockers, status };
  });
}

function sponsorChoice(snapshot: KqSocialSnapshot, tag: KqSocialTag): KqSocialChoice {
  const active = snapshot.sponsors.active, def = KQ_SOCIAL_SPONSORS.find(d => d.id === active?.sponsorId);
  if (!active || !def || !def.requiredTags.includes(tag)) throw new Error("Ce format ne correspond pas au partenariat en cours.");
  return { id: tag, label: KQ_SOCIAL_TAG_LABELS[tag], description: def.brief, upside: "Une publication du brief réalisée.", downside: "Cette place dans ton fil est consacrée à un message sponsorisé.",
    outcome: `Partenariat rémunéré avec ${def.name}, annoncé clairement. ${KQ_SOCIAL_TAG_LABELS[tag]} : le public découvre ton travail avec la marque, certains lecteurs préfèrent les publications sans publicité.`, intent: "craft", tag,
    effects: { followersMin: active.platform === "instagram" ? 4 : 2, followersMax: active.platform === "instagram" ? 12 : 7, haters: 3, trust: -2, moderation: 0, energy: active.platform === "instagram" ? -14 : -18 } };
}
export function getKqSponsorPostPreview(snapshot: KqSocialSnapshot, tag: KqSocialTag): KqSocialChoicePreview {
  const choice = sponsorChoice(snapshot, tag);
  return getKqSocialChoicePreview(snapshot, snapshot.sponsors.active!.platform, choice);
}
/** Deterministic for exercises only; the authenticated server uses crypto.randomInt. */
export function getKqSocialLocalRoll(requestKey: string): number {
  let hash = 2166136261;
  for (const char of requestKey) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) % 101;
}

export function applyKqSocialCommand(snapshot: KqSocialSnapshot | V1Snapshot, command: KqSocialCommand, now: number, reputation = 0, roll = 50, replayOriginalCatalog = false, replayLegacyNarrative = false, replayV2Narrative = false): KqSocialSnapshot {
  if (!parseKqSocialCommand(command)) throw new Error("Choix de réseau social invalide.");
  if (!integer(roll, 100)) throw new Error("Résolution de la publication invalide.");
  // Internal replay flags are never accepted in a player command. Preserve the
  // actual old text and rules instead of relabelling a saved choice as a new story.
  const catalog = replayOriginalCatalog ? KQ_SOCIAL_ORIGINAL_SCENARIOS : replayLegacyNarrative ? KQ_SOCIAL_LEGACY_SCENARIOS : replayV2Narrative ? KQ_SOCIAL_V2_SCENARIOS : KQ_SOCIAL_SCENARIOS;
  const replay = replayOriginalCatalog || replayLegacyNarrative || replayV2Narrative;
  const next = refreshKqSocialSnapshot(replay && snapshot.version === 2
    ? { ...snapshot, ...(replayOriginalCatalog ? { storyCatalogVersion: 2 as const } : {}), narrativeVersion: 2 } : snapshot, now, reputation, replay ? 2 : 3);
  if (next.revision !== command.expectedRevision) throw new Error("La situation a changé. Actualise les réseaux avant de choisir.");
  const entry: KqSocialHistoryEntry = { id: command.requestKey, platform: null, scenarioId: command.action, choiceId: command.action, createdAt: next.serverNow, outcome: "", followersDelta: 0, hatersDelta: 0, moderationDelta: 0, energyDelta: 0, trustDelta: 0, rewardCents: 0, reasons: [] };
  if (command.action === "recover") {
    if (next.recoverReadyAt && Date.parse(next.recoverReadyAt) > now) throw new Error("Ta prochaine pause sera disponible après le délai indiqué.");
    if (next.energy === 100) throw new Error("Ton énergie mentale est déjà au maximum.");
    entry.energyDelta = Math.min(30, 100 - next.energy); next.energy += entry.energyDelta;
    next.recoverReadyAt = new Date(now + KQ_SOCIAL_RECOVER_MS).toISOString();
    entry.outcome = "Tu poses le téléphone et prends du recul. L’atelier peut attendre une réponse ; ton attention revient.";
  } else if (command.action === "sponsor-accept" || command.action === "sponsor-decline") {
    const offer = getKqSponsorOffers(next).find(o => o.sponsor.id === command.sponsorId)!;
    if (!offer.eligible) throw new Error(offer.blockers[0] ?? "Cette proposition n’est plus disponible.");
    const def = offer.sponsor; entry.platform = def.platform; entry.scenarioId = def.id;
    if (command.action === "sponsor-decline") {
      next.sponsors.declinedIds.push(def.id);
      entry.outcome = `Tu déclines l’invitation de ${def.name}. Aucun coût ni perte de confiance ; cette proposition est close.`;
    } else {
      next.sponsors.active = { sponsorId: def.id, platform: def.platform, rewardCents: def.rewardCents, progressTags: [], publicationsLeft: def.publicationBudget, startedAt: next.serverNow };
      entry.outcome = `${def.contact} confirme le partenariat avec ${def.name}. Deux formats distincts, annoncés comme sponsorisés, parmi tes quatre prochaines publications sur ce réseau. La prime sera disponible après réalisation.`;
    }
  } else if (command.action === "sponsor-claim" || command.action === "sponsor-cancel") {
    const active = next.sponsors.active, def = KQ_SOCIAL_SPONSORS.find(d => d.id === active?.sponsorId);
    if (!active || !def) throw new Error("Aucun partenariat en cours.");
    entry.platform = active.platform; entry.scenarioId = def.id;
    if (command.action === "sponsor-claim") {
      if (!def.requiredTags.every(tag => active.progressTags.includes(tag))) throw new Error("Réalise les deux formats du brief avant de demander la prime.");
      next.sponsors.earnedCents += active.rewardCents; entry.rewardCents = active.rewardCents;
      next.sponsors.completedIds.push(def.id); entry.outcome = def.completionText;
    } else {
      next.sponsors.declinedIds.push(def.id);
      entry.outcome = `Tu préviens ${def.contact} et quittes le partenariat ${def.name}. La prime non acquise est abandonnée ; aucun débit ni dette.`;
    }
    next.sponsors.active = null;
  } else {
    const platform = command.action === "choose" ? command.platform : next.sponsors.active?.platform;
    if (!platform) throw new Error("Aucun partenariat en cours.");
    const account = next.platforms[platform];
    const adventure = !replay && command.action === "choose" ? getKqSocialAdventure(next, platform, command.subjectId) : null;
    const scene = adventure?.scene ?? getKqSocialScenario(platform, account.chapter, account.memory, catalog);
    if (adventure && (command.action !== "choose" || command.narrativeVersion !== 3 || !adventure.subject
      || command.subjectId !== adventure.subject.id || command.contextKey !== adventure.contextKey)) throw new Error("Ta culture ou cette publication a changé. Actualise avant de publier.");
    const selected = command.action === "choose" ? scene.choices.find(c => c.id === command.choiceId) : command.action === "sponsor-post" ? sponsorChoice(next, command.tag) : undefined;
    if (!selected || (command.action === "choose" && command.scenarioId !== scene.id)) throw new Error("Cette histoire a changé. Actualise avant de choisir.");
    if (account.nextPostAt && Date.parse(account.nextPostAt) > now) throw new Error("Laisse vivre ta publication avant de continuer sur ce réseau.");
    if (command.action === "sponsor-post" && next.sponsors.active?.progressTags.includes(command.tag)) throw new Error("Ce format est déjà réalisé. Choisis l’autre format du brief.");
    const effects = getKqSocialChoicePreview(next, platform, selected);
    if (next.energy + effects.energy < 0) throw new Error("Ton énergie mentale ne suffit pas. Fais une pause ou reviens plus tard.");
    const followers = effects.followersMin + Math.floor((effects.followersMax - effects.followersMin) * roll / 100);
    account.followers += followers; next.audienceFollowers += followers;
    account.haters += effects.haters; account.trust += effects.trust; account.moderation += effects.moderation; next.energy += effects.energy;
    account.intentStreak = account.lastIntent === selected.intent ? account.intentStreak + 1 : 1; account.lastIntent = selected.intent;
    account.nextPostAt = new Date(now + (command.action === "sponsor-post" || scene.episode === 3 ? KQ_SOCIAL_POST_MS : 0)).toISOString();
    if (command.action === "choose") {
      if (scene.episode === 1) for (const s of catalog.filter(s => s.platform === platform && s.arc === scene.arc)) delete account.memory[s.id];
      account.memory[scene.id] = selected.id;
      account.chapter = adventure ? adventure.chapter + 1 : account.chapter + 1;
      if (adventure?.subject) {
        entry.narrativeVersion = 3; entry.subject = structuredClone(adventure.subject);
        if (scene.previousChoice) entry.previousChoice = scene.previousChoice;
        if (scene.episode === 1) account.story = { startId: scene.id, subject: structuredClone(adventure.subject) };
        if (scene.episode === 3) delete account.story;
      } else if (replayV2Narrative) entry.narrativeVersion = 2;
    }
    Object.assign(entry, { platform, scenarioId: command.action === "choose" ? scene.id : next.sponsors.active!.sponsorId, choiceId: selected.id, outcome: selected.outcome,
      followersDelta: followers, hatersDelta: effects.haters, trustDelta: effects.trust, moderationDelta: effects.moderation, energyDelta: effects.energy,
      reasons: [...effects.reasons, followers > 0 ? "Des lecteurs ont choisi de rester ; les impressions ne comptent pas comme des abonnés." : followers < 0 ? "Les départs dépassent les nouvelles adhésions sur cette publication." : "Le solde de ta communauté reste stable sur cette publication."] });
    const active = next.sponsors.active;
    if (active?.platform === platform) {
      const def = KQ_SOCIAL_SPONSORS.find(s => s.id === active.sponsorId)!;
      if (!def.requiredTags.every(tag => active.progressTags.includes(tag))) {
        active.publicationsLeft = Math.max(0, active.publicationsLeft - 1);
        if (command.action === "sponsor-post") active.progressTags.push(command.tag);
        if (def.requiredTags.every(tag => active.progressTags.includes(tag))) entry.reasons!.push("Brief rempli : ta prime attend dans Partenariats.");
        else if (active.publicationsLeft === 0) {
          next.sponsors.declinedIds.push(active.sponsorId); next.sponsors.active = null;
          entry.reasons!.push(`Les quatre publications sont passées sans compléter le brief ${def.name}. Partenariat clos sans prime et sans dette.`);
        } else entry.reasons!.push(`${active.publicationsLeft} publication(s) restante(s) pour terminer le brief ${def.name}.`);
      }
    }
  }
  next.revision += 1; next.history = [entry, ...next.history].slice(0, 20);
  next.socialFollowers = next.platforms.instagram.followers + next.platforms.x.followers;
  return refreshKqSocialSnapshot(next, now, reputation, replay ? 2 : 3);
}
