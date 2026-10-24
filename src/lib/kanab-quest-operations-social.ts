import type { KqOperationsLessonState } from './kanab-quest-operations-lesson';
import { createKqOnlinePreview } from './kanab-quest-online';
import { applyKqSocialCommand, createKqSocialSnapshot, getKqSocialLocalRoll, normalizeKqSocialSnapshot, parseKqSocialCommand, refreshKqSocialSnapshot } from './kanab-quest-social';
import { applyKqSocialCommand as applyV1Command, createKqSocialSnapshot as createV1Snapshot, parseKqSocialCommand as parseV1Command, refreshKqSocialSnapshot as refreshV1Snapshot } from './kanab-quest-social-v1';
import { projectKqSocialCultureContext, type KqSocialCultureContext } from './kanab-quest-social-culture';

/** Operations exercises lend their harvest. It is never the player's own past. */
export function getKqOperationsSocialCulture(state: KqOperationsLessonState): KqSocialCultureContext {
  const { game, clock, commerce } = state.trial;
  const lot = state.storage.lot;
  const remaining = state.prepared ? Math.ceil(commerce.stocks.filter(stock => stock.flowerId === lot.flowerId)
    .reduce((sum, stock) => sum + stock.remainingUnits * stock.equivalentUnits / stock.initialUnits, 0)) / 10
    : lot.capacity ? lot.capacity.totalUnits / 10 : null;
  return projectKqSocialCultureContext({
    runs: game ? [{ id: 'operations-lesson-culture', state: game, updatedAt: game.completedAt ?? game.startedAt ?? new Date(clock).toISOString() }] : [],
    lots: game ? [{ id: lot.flowerId, runId: 'operations-lesson-culture', varietyCode: game.varietyCode, varietyName: game.varietyName,
      cultivation: game.warehouse ? 'indoor' : 'unknown', storage: lot, harvestGrams: game.harvestGrams ?? null,
      harvestedAt: lot.harvestedAt, remainingGrams: remaining }] : [],
  }, clock, 'loan');
}

/** Reads older exercise saves without creating state or spending their energy. */
export function getKqOperationsSocial(state: KqOperationsLessonState, culture = getKqOperationsSocialCulture(state), narrativeVersion: 2 | 3 = 3) {
  const now = state.trial.clock;
  const online = state.trial.commerce.online;
  const audienceFollowers = online?.followers ?? 0;
  const siteActive = online?.site.active ?? false;
  const stored = state.social ? normalizeKqSocialSnapshot(state.social, now, narrativeVersion) : createKqSocialSnapshot(now, audienceFollowers, siteActive, narrativeVersion);
  return refreshKqSocialSnapshot({ ...stored, audienceFollowers, siteActive, culture }, now, state.trial.commerce.reputation, narrativeVersion);
}

/** The exercise advances and settles shop time in a single synchronous action.
 * A post therefore changes future demand, never already settled visits or sales. */
export function applyKqOperationsSocial(state: KqOperationsLessonState, body: unknown, replayOriginalCatalog = false, replayLegacyNarrative = false, culture?: KqSocialCultureContext, replayV2Narrative = false) {
  const command = parseKqSocialCommand(body);
  if (!command) throw new Error('Choix de réseau social invalide.');
  const previous = getKqOperationsSocial(state, culture, replayOriginalCatalog || replayLegacyNarrative || replayV2Narrative ? 2 : 3);
  const social = applyKqSocialCommand(previous, command, state.trial.clock, state.trial.commerce.reputation, getKqSocialLocalRoll(command.requestKey), replayOriginalCatalog, replayLegacyNarrative, replayV2Narrative);
  const commerce = state.trial.commerce;
  const rewardCents = social.sponsors.earnedCents - previous.sponsors.earnedCents;
  if (!Number.isSafeInteger(rewardCents) || rewardCents < 0) throw new Error('Récompense de partenariat invalide.');
  if (rewardCents > 0) {
    const nextCash = commerce.cashCents + rewardCents;
    if (!Number.isSafeInteger(nextCash) || nextCash > 2_147_483_647) throw new Error('Ta trésorerie ne peut pas encore recevoir cette récompense.');
    commerce.cashCents = nextCash;
    commerce.business?.ledger.unshift({ id: `social-sponsor-${command.requestKey}`, kind: 'social-sponsor-reward', amountCents: rewardCents, occurredAt: social.serverNow });
  }
  if (!commerce.online) {
    commerce.online = createKqOnlinePreview(state.trial.clock);
    commerce.online.site.active = previous.siteActive;
    commerce.online.site.createdAt = commerce.business?.shop.createdAt ?? null;
  }
  const online = commerce.online;
  // Apply only the audience earned or lost here: marketing keeps its followers.
  online.followers += social.audienceFollowers - previous.audienceFollowers;
  const stored = { ...social };
  delete stored.culture;
  state.social = stored;
  commerce.revision++;
  state.events.push(command.action === 'choose' ? 'social-post' : `social-${command.action}`);
  return social;
}

/** Only the saved exercise journal can invoke the historical rules. A new
 * request always goes through the current parser, even after a v1 restore. */
export function replayKqOperationsSocialV1(state: KqOperationsLessonState, body: unknown) {
  const command = parseV1Command(body);
  if (!command || state.social?.version === 2) throw new Error('Ancienne publication d’essai invalide.');
  const commerce = state.trial.commerce;
  const online = commerce.online ??= createKqOnlinePreview(state.trial.clock);
  const previous = refreshV1Snapshot({ ...(state.social ?? createV1Snapshot(state.trial.clock)),
    audienceFollowers: online.followers, siteActive: online.site.active }, state.trial.clock, commerce.reputation);
  const social = applyV1Command(previous, command, state.trial.clock, commerce.reputation);
  online.followers += social.audienceFollowers - previous.audienceFollowers;
  state.social = social;
  commerce.revision++;
  state.events.push(command.action === 'choose' ? 'social-post' : 'social-recover');
  return social;
}
