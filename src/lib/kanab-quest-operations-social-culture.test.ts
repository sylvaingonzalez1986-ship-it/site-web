import { describe, expect, it } from 'vitest';
import { createKqOperationsLesson, applyKqOperationsRequest, type KqOperationsLessonAction } from './kanab-quest-operations-lesson';
import { getKqOperationsSocial, getKqOperationsSocialCulture } from './kanab-quest-operations-social';
import { applyReleveCommerceRequest, createReleveCommerce, createReleveCommerceBusiness, getKqReleveSocialCulture } from './kanab-quest-releve-commerce';
import { createKqWorkshop } from './kanab-quest-workshops';
import { getKqWarehouseQuote, getKqWarehouseRunSnapshot } from './kanab-quest-warehouse';
import { createKqReleveProduction, suggestKqRelevePlan } from './kanab-quest-releve-production';
import { getKqSocialAdventure, getKqSocialSubjects } from './kanab-quest-social-adventure';
import type { KqSocialSnapshot } from './kanab-quest-social';
import { KQ_SOCIAL_SCENARIOS } from './kanab-quest-social-stories';
import { getKqSocialProducerNarrative } from './kanab-quest-social-producer';

const SOCIAL = '/api/arena/placard/social';
function owned() {
  const trial = createKqWorkshop('market');
  const room = getKqWarehouseQuote(suggestKqRelevePlan(createKqReleveProduction(), 2)).nextState;
  return createReleveCommerce({ cashCents: 90_000, clock: trial.clock, harvests: [0, 1].map(index => ({
    zoneId: `zone-${index}`, game: { ...trial.game!, varietyName: `Ma variété ${index + 1}`, harvestGrams: 200 + index * 100,
      warehouse: getKqWarehouseRunSnapshot(room) }, battle: trial.battle,
  })) });
}
function action(snapshot: KqSocialSnapshot): KqOperationsLessonAction {
  const first = getKqSocialAdventure(snapshot, 'instagram');
  const adventure = first.subject ? first : getKqSocialAdventure(snapshot, 'instagram', first.subjects[0].id);
  return { path: SOCIAL, method: 'POST', socialCatalogVersion: 2, socialNarrativeVersion: 3, body: {
    modelVersion: 2, narrativeVersion: 3, action: 'choose', platform: 'instagram', scenarioId: adventure.scene.id,
    choiceId: adventure.scene.choices[0].id, subjectId: adventure.subject!.id, contextKey: adventure.contextKey,
    requestKey: '10000000-0000-4000-8000-000000000001', expectedRevision: snapshot.revision,
  } };
}

describe('actual and borrowed local social culture', () => {
  it('identifies exercise stock as a loan and never offers it as the player’s harvest', () => {
    const state = createKqOperationsLesson('market'), before = structuredClone(state);
    const snapshot = getKqOperationsSocial(state);
    expect(snapshot.culture).toMatchObject({ source: 'loan', lots: [{ varietyName: state.trial.game!.varietyName, harvestGrams: state.trial.game!.harvestGrams, stage: 'ready' }] });
    expect(getKqSocialSubjects(snapshot, 'harvest')).toEqual([]);
    expect(getKqSocialSubjects(snapshot, 'ready')).toEqual([]);
    expect(state).toEqual(before);
  });
  it('projects actual lots separately and distinguishes original yield from remaining product', () => {
    const state = owned(), before = structuredClone(state), context = getKqReleveSocialCulture(state);
    expect(context.source).toBe('own');
    expect(context.lots.map(lot => [lot.id, lot.varietyName, lot.harvestGrams, lot.remainingGrams, lot.stage])).toEqual([
      ['releve-zone-0', 'Ma variété 1', 200, 200, 'curing'], ['releve-zone-1', 'Ma variété 2', 300, 300, 'curing'],
    ]);
    expect(state).toEqual(before);
    state.operations.trial.clock = Math.max(...state.lots.map(lot => Date.parse(lot.storage.readyAt)));
    expect(getKqReleveSocialCulture(state).lots.every(lot => lot.stage === 'ready')).toBe(true);
    state.lots[0].prepared = true;
    expect(getKqReleveSocialCulture(state).lots[0]).toMatchObject({ harvestGrams: 200, remainingGrams: 0 });
  });
  it('does not attribute a borrowed business dossier or assistance sample to the player', () => {
    expect(getKqReleveSocialCulture(createReleveCommerceBusiness()).source).toBe('loan');
    const state = owned();
    state.lots.push({ ...structuredClone(state.lots[0]), id: 'releve-sylvain-sample', assistance: true });
    const context = getKqReleveSocialCulture(state);
    expect(context.source).toBe('own');
    expect(context.lots).toHaveLength(2); expect(context.runs).toHaveLength(2);
    expect(context.lots.some(lot => lot.id === 'releve-sylvain-sample')).toBe(false);
  });
  it('keeps the original exercise yield when stock is sold rather than replacing it with zero', () => {
    const state = createKqOperationsLesson('market');
    state.prepared = true;
    expect(getKqOperationsSocialCulture(state).lots[0]).toMatchObject({ harvestGrams: state.trial.game!.harvestGrams, remainingGrams: 0 });
  });
  it('returns fresh context without copying it into exercise state or receipts', () => {
    const state = createKqOperationsLesson('market'), post = action(getKqOperationsSocial(state));
    const result = applyKqOperationsRequest(state, post), snapshot = result.payload as KqSocialSnapshot;
    expect(snapshot.culture?.source).toBe('loan');
    expect(result.state.social).not.toHaveProperty('culture');
    expect(result.state.receipts[`${SOCIAL}:${post.body.requestKey}`]).not.toHaveProperty('culture');
    result.state.trial.clock += 60_000;
    const replay = applyKqOperationsRequest(result.state, post);
    expect(replay.state).toBe(result.state);
    expect((replay.payload as KqSocialSnapshot).culture?.observedAt).toBe(new Date(result.state.trial.clock).toISOString());
    expect((replay.payload as KqSocialSnapshot).history).toEqual(snapshot.history);
  });
  it('keeps only the immutable chosen subject in Relève receipts and refreshes presentation on retry', () => {
    const state = owned(), snapshot = getKqOperationsSocial(state.operations, getKqReleveSocialCulture(state));
    snapshot.platforms.instagram.chapter = KQ_SOCIAL_SCENARIOS.filter(scene => scene.platform === 'instagram')
      .findIndex(scene => scene.episode === 1 && getKqSocialProducerNarrative(scene.id).requirement === 'harvest');
    state.operations.social = { ...snapshot }; delete state.operations.social.culture;
    const post = action(snapshot);
    const result = applyReleveCommerceRequest(state, post), response = result.payload as KqSocialSnapshot;
    expect(response.culture?.source).toBe('own');
    expect(response.history[0].subject?.variety).toBe('Ma variété 1');
    expect(result.state.operations.social).not.toHaveProperty('culture');
    expect(result.state.responses[`${SOCIAL}:${post.body.requestKey}`]).not.toHaveProperty('culture');
    result.state.operations.trial.clock += 60_000;
    const replay = applyReleveCommerceRequest(result.state, post);
    expect(replay.state).toBe(result.state);
    expect((replay.payload as KqSocialSnapshot).culture?.observedAt).toBe(new Date(result.state.operations.trial.clock).toISOString());
    expect((replay.payload as KqSocialSnapshot).history).toEqual(response.history);
  });
});
