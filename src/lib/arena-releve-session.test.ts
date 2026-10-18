import { describe, expect, it } from 'vitest';
import { ARENA_RELEVE_STORAGE_KEY, advanceArenaReleve, createArenaReleveSession, createArenaReleveState, getArenaReleveProgress, restartArenaReleveChapter, restoreArenaReleveState, type ArenaReleveSessionState } from './arena-releve-session';
import { applyKqReleveProductionAction, suggestKqRelevePlan, type KqReleveProductionAction } from './kanab-quest-releve-production';
import { isKqCultureDead } from './kanab-quest-game';

function production(state: ArenaReleveSessionState, action: KqReleveProductionAction) {
  return { ...state, production: applyKqReleveProductionAction(state.production, action) };
}
function planned() {
  let state = advanceArenaReleve({ ...createArenaReleveState(), renovation: 'renovated' });
  state = production(state, { type: 'draft', warehouse: suggestKqRelevePlan(state.production, 2) });
  state = production(state, { type: 'mark', milestone: 'quote-read' });
  state = production(state, { type: 'mark', milestone: 'charges-read' });
  return production(state, { type: 'save-plan' });
}

describe('La relève shared session', () => {
  it('blocks the plan before complete renovation without consuming the equipment budget', () => {
    const fresh = createArenaReleveState();
    for (const renovation of ['locked', 'opened', 'emptied'] as const) {
      const state = { ...fresh, renovation };
      expect(advanceArenaReleve(state)).toBe(state);
    }
    const next = advanceArenaReleve({ ...fresh, renovation: 'renovated' });
    expect(next.chapter).toBe(1);
    expect(next.production.cashCents).toBe(200_000);
    expect(next.production.warehouse.zones).toEqual([]);
  });

  it('rewinds just the current chapter including purchases and draft with no duplication', () => {
    const state = planned();
    expect(state.production.cashCents).toBe(92_257);
    const rewind = restartArenaReleveChapter(state);
    expect(rewind.chapter).toBe(1);
    expect(rewind.renovation).toBe('renovated');
    expect(rewind.production.cashCents).toBe(200_000);
    expect(rewind.production.warehouse.zones).toEqual([]);
    const buddies = advanceArenaReleve(state);
    const revealed = production(buddies, { type: 'reveal-buddie' });
    expect(restartArenaReleveChapter(revealed).production).toEqual(state.production);
  });

  it('transfers the actual two harvests, remaining budget and invoices through nine chapter gates', () => {
    let state = advanceArenaReleve(planned());
    for (let i=0;i<3;i++) state = production(state, { type: 'reveal-buddie' });
    state = production(state, { type: 'mark', milestone: 'profile-read' });
    state = production(state, { type: 'assign', zoneId: 'culture-1', buddieCode: 'HH2026-005' });
    state = production(state, { type: 'assign', zoneId: 'culture-2', buddieCode: 'HH2026-010' });
    state = production(state, { type: 'save-plan' });
    state = advanceArenaReleve(state);
    expect(state.chapter).toBe(3);
    expect(advanceArenaReleve(state)).toBe(state);
    state = production(state, { type: 'launch' });
    state = advanceArenaReleve(state);
    state = production(state, { type: 'mark', milestone: 'health-read' });
    while (state.production.game!.phase !== 'complete') {
      state = production(state, { type: 'assist' });
      state = production(state, { type: 'roll' });
      state = production(state, { type: 'resolve' });
      if (!isKqCultureDead(state.production.game!)) state = production(state, { type: 'advance' });
    }
    state = production(state, { type: 'mark', milestone: 'recap-read' });
    state = advanceArenaReleve(state);
    expect(state.chapter).toBe(5);
    for (const zoneId of ['culture-1', 'culture-2']) {
      state = production(state, { type: 'duel', zoneId });
      state = production(state, { type: 'verdict', zoneId });
      for (let i=0;i<3;i++) state = production(state, { type: 'round', zoneId });
    }
    state = advanceArenaReleve(state);
    expect(state.chapter).toBe(6);
    expect(state.commerce?.lots).toHaveLength(2);
    expect(state.commerce?.operations.trial.commerce.cashCents).toBe(state.production.cashCents);
    expect(state.commerce?.productionLedger).toEqual(state.production.ledger);
    expect(getArenaReleveProgress(state).complete).toBe(false);
    expect(JSON.stringify(restoreArenaReleveState(JSON.parse(JSON.stringify(state))))).toBe(JSON.stringify(state));
    const snapshot = JSON.stringify(state);
    expect(advanceArenaReleve(state)).toBe(state);
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it('resumes the same draft and cash using only its own key', () => {
    const rows = new Map([['real-player', 'untouched']]);
    const backing = { getItem: (key: string) => rows.get(key) ?? null, setItem: (key: string, value: string) => { rows.set(key,value); } };
    const session = createArenaReleveSession(backing);
    session.update(planned());
    expect(rows.get('real-player')).toBe('untouched');
    expect([...rows.keys()].sort()).toEqual([ARENA_RELEVE_STORAGE_KEY, 'real-player'].sort());
    const resumed = createArenaReleveSession(backing);
    expect(resumed.getSnapshot().state).toEqual(session.getSnapshot().state);
    resumed.restart();
    expect(rows.get('real-player')).toBe('untouched');
    expect(resumed.getSnapshot().state.chapter).toBe(0);
  });

  it('keeps playing in memory and announces unavailable persistence', () => {
    const session = createArenaReleveSession({ getItem: () => { throw Error('denied'); }, setItem: () => { throw Error('quota'); } });
    expect(session.getSnapshot().storageWarning).not.toBe('');
    session.update(planned());
    expect(session.getSnapshot().state.production.cashCents).toBe(92_257);
    expect(session.getSnapshot().storageWarning).toContain('ne peut pas');
  });

  it.each([null, { version: 0 }, { ...createArenaReleveState(), chapter: 99 }, { ...createArenaReleveState(), chapter: 2 }, { ...createArenaReleveState(), commerce: {} }, { ...createArenaReleveState(), production: { ...createArenaReleveState().production, game: {} } }])('rejects incompatible or damaged saves without touching another save', value => {
    expect(restoreArenaReleveState(value)).toBeNull();
  });
});
