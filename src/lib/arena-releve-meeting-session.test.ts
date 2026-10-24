import { describe, expect, it, vi } from 'vitest';
import { createReleveMeetingSession, releveMeetingStorageKey } from './arena-releve-meeting-session';
import { applyKqReleveProductionAction, suggestKqRelevePlan } from './kanab-quest-releve-production';
import { applyReleveCommerceRequest } from './kanab-quest-releve-commerce';
import { createArenaLearningStorage } from './arena-introduction';

function memory() {
  const rows = new Map<string, string>();
  return { rows, getItem: vi.fn((key: string) => rows.get(key) ?? null), setItem: vi.fn((key: string, value: string) => { rows.set(key, value); }) };
}

describe('La relève: pause des rencontres', () => {
  it.each(['social', 'merch'] as const)('keeps the new %s dossier and each account separate from existing commerce progress', meeting => {
    const backing = memory();
    const first = createArenaLearningStorage('first', false, () => backing);
    const second = createArenaLearningStorage('second', false, () => backing);
    const business = createReleveMeetingSession('business', first);
    business.update(current => ({ ...current, business: applyReleveCommerceRequest(current.business!, { path: '/api/releve/commerce', method: 'POST', body: { action: 'borrow-computer' } }).state }));
    const before = JSON.stringify(business.getSnapshot());
    const exercise = createReleveMeetingSession(meeting, first);
    exercise.update(current => ({ ...current, business: { ...current.business!, milestones: [...current.business!.milestones, 'test-marker'] } }));
    expect(createReleveMeetingSession(meeting, first).getSnapshot()).toEqual(exercise.getSnapshot());
    expect(createReleveMeetingSession(meeting, second).getSnapshot().state.business!.milestones).not.toContain('test-marker');
    exercise.restart();
    expect(JSON.stringify(createReleveMeetingSession('business', first).getSnapshot())).toBe(before);
    expect([...backing.rows.keys()].every(key => key.endsWith(':first'))).toBe(true);
  });

  it('resumes the expansion purchase and unfinished draft without charging twice', () => {
    const backing = memory(), session = createReleveMeetingSession('expansion', backing);
    let production = session.getSnapshot().state.production;
    production = applyKqReleveProductionAction(production, { type: 'draft', warehouse: suggestKqRelevePlan(production, 2) });
    production = applyKqReleveProductionAction(production, { type: 'save-plan' });
    const draftWarehouse = structuredClone(production.warehouse);
    draftWarehouse.zones[1].x = draftWarehouse.zones[0].x; // An unfinished overlap must stay editable.
    production = applyKqReleveProductionAction(production, { type: 'draft', warehouse: draftWarehouse });
    session.update(current => ({ ...current, production }));
    const resumed = createReleveMeetingSession('expansion', backing);
    expect(resumed.getSnapshot().state.production).toEqual(production);
    expect(resumed.getSnapshot().state.production.cashCents).toBeLessThan(500_000);
    expect(resumed.getSnapshot().storageWarning).toBe('');
  });

  it('retains the real business wallet, shop and its journal across a pause', () => {
    const backing = memory(), session = createReleveMeetingSession('business', backing);
    let business = session.getSnapshot().state.business!;
    business = applyReleveCommerceRequest(business, { path: '/api/releve/commerce', method: 'POST', body: { action: 'borrow-computer' } }).state;
    business = applyReleveCommerceRequest(business, { path: '/api/arena/placard/commerce', method: 'POST', body: { action: 'create-shop', name: 'Le comptoir de Sylvain' } }).state;
    session.update(current => ({ ...current, business }));
    expect(createReleveMeetingSession('business', backing).getSnapshot()).toEqual(session.getSnapshot());
    expect(business.operations.trial.commerce.business!.shop.name).toBe('Le comptoir de Sylvain');
  });

  it('remembers the first independent lesson and keeps each meeting and player save separate', () => {
    const backing = memory();
    backing.rows.set('real-player', 'unchanged');
    const bank = createReleveMeetingSession('bank', backing);
    bank.update(current => ({ ...current, completed: ['bank'] }));
    const notebook = createReleveMeetingSession('notebook', backing);
    notebook.update(current => ({ ...current, completed: ['notebook', 'collection'] }));
    const resumed = createReleveMeetingSession('bank', backing);
    expect(resumed.getSnapshot().state.completed).toEqual(['bank']);
    resumed.restart();
    expect(resumed.getSnapshot().state.completed).toEqual([]);
    // Older saves may include the tasting lesson, now accessed from the Carnet.
    // Keep their collected pack progress without retaining a removed objective.
    expect(createReleveMeetingSession('notebook', backing).getSnapshot().state.completed).toEqual(['collection']);
    expect(backing.rows.get('real-player')).toBe('unchanged');
    expect([...backing.rows.keys()].sort()).toEqual(['real-player', releveMeetingStorageKey('bank'), releveMeetingStorageKey('notebook')].sort());
  });

  it('rejects a damaged dossier and filters unrelated or duplicated completed lessons', () => {
    const backing = memory(), key = releveMeetingStorageKey('bank');
    const session = createReleveMeetingSession('bank', backing);
    session.update(current => ({ ...current, completed: ['bank', 'bank', 'missions'] }));
    expect(createReleveMeetingSession('bank', backing).getSnapshot().state.completed).toEqual(['bank']);
    const damaged = JSON.parse(backing.rows.get(key)!);
    damaged.state.production.draftWarehouse.zones = [null];
    backing.rows.set(key, JSON.stringify(damaged));
    const fresh = createReleveMeetingSession('bank', backing).getSnapshot();
    expect(fresh.storageWarning).toContain('incomplet');
    expect(fresh.state.completed).toEqual([]);
    expect(backing.rows.get(key)).toBe(JSON.stringify(damaged));
  });

  it('keeps updates and subscriptions working if the browser refuses persistence', () => {
    const session = createReleveMeetingSession('community', { getItem: () => { throw Error('denied'); }, setItem: () => { throw Error('quota'); } });
    const listener = vi.fn(), unsubscribe = session.subscribe(listener);
    expect(session.getSnapshot().storageWarning).not.toBe('');
    session.update(current => ({ ...current, completed: ['specialties'] }));
    expect(session.getSnapshot().state.completed).toEqual(['specialties']);
    expect(session.getSnapshot().storageWarning).toContain('ne peut pas');
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe(); session.restart();
    expect(listener).toHaveBeenCalledOnce();
    expect(session.getServerSnapshot().state.completed).toEqual([]);
  });

  it('leaves workshop persistence entirely to its own dossier store', () => {
    const backing = memory(), session = createReleveMeetingSession('workshop', backing);
    session.restart();
    expect(backing.getItem).not.toHaveBeenCalled();
    expect(backing.setItem).not.toHaveBeenCalled();
    expect(session.getSnapshot().storageWarning).toBe('');
  });
});
