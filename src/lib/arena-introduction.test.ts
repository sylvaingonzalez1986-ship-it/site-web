import { afterEach, describe, expect, it, vi } from 'vitest';
import { ARENA_RELEVE_VISITS_KEY, arenaIntroductionKey, arenaLearningAccountKey, createArenaLearningStorage, hasSeenArenaIntroduction, markArenaIntroductionCompleted, rememberArenaIntroduction } from './arena-introduction';
import { ARENA_RELEVE_STORAGE_KEY, createArenaReleveSession } from './arena-releve-session';

function backing() {
  const rows = new Map<string, string>();
  return { rows, getItem: (key: string) => rows.get(key) ?? null, setItem: (key: string, value: string) => { rows.set(key, value); } };
}
afterEach(() => vi.unstubAllGlobals());

describe('First game introduction', () => {
  it('remembers only the account that actually saw the introduction', () => {
    const storage = backing();
    vi.stubGlobal('localStorage', storage);
    expect(hasSeenArenaIntroduction('first')).toBe(false);
    rememberArenaIntroduction('first');
    expect(storage.getItem(arenaIntroductionKey('first'))).toBe('seen');
    expect(hasSeenArenaIntroduction('first')).toBe(true);
    expect(hasSeenArenaIntroduction('second')).toBe(false);
  });

  it('honors an existing browser marker after a new server snapshot', () => {
    const storage = backing();
    storage.setItem(arenaIntroductionKey('offline-reload'), 'seen');
    vi.stubGlobal('localStorage', storage);
    expect(hasSeenArenaIntroduction('offline-reload')).toBe(true);
  });

  it('does not reopen in the same tab when browser storage is blocked', () => {
    vi.stubGlobal('localStorage', { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } });
    expect(hasSeenArenaIntroduction('blocked')).toBe(false);
    rememberArenaIntroduction('blocked');
    expect(hasSeenArenaIntroduction('blocked')).toBe(true);
  });

  it('resumes the introduction without sharing progress with another account', () => {
    const storage = backing();
    storage.setItem('live-player-save', 'unchanged');
    const first = createArenaLearningStorage('first', false, () => storage);
    const session = createArenaReleveSession(first);
    session.update(state => ({ ...state, renovation: 'opened' }));
    expect(createArenaReleveSession(first).getSnapshot().state.renovation).toBe('opened');
    const second = createArenaLearningStorage('second', false, () => storage);
    expect(createArenaReleveSession(second).getSnapshot().state.renovation).toBe('locked');
    expect(storage.getItem('live-player-save')).toBe('unchanged');
    expect(storage.getItem(ARENA_RELEVE_STORAGE_KEY)).toBe(null);
  });

  it('recovers the legacy browser story once for a returning player, never for a newcomer', () => {
    const storage = backing();
    createArenaReleveSession(storage).update(state => ({ ...state, renovation: 'emptied' }));
    const newcomer = createArenaLearningStorage('newcomer', false, () => storage);
    expect(createArenaReleveSession(newcomer).getSnapshot().state.renovation).toBe('locked');
    const returning = createArenaLearningStorage('returning', true, () => storage);
    expect(createArenaReleveSession(returning).getSnapshot().state.renovation).toBe('emptied');
    expect(storage.getItem(arenaLearningAccountKey(ARENA_RELEVE_STORAGE_KEY, 'returning'))).not.toBe(null);
    const other = createArenaLearningStorage('other', true, () => storage);
    expect(createArenaReleveSession(other).getSnapshot().state.renovation).toBe('locked');
  });

  it('keeps completion visible in the Quartier without losing finished meetings', () => {
    const storage = backing();
    const scoped = createArenaLearningStorage('finisher', false, () => storage);
    scoped.setItem(ARENA_RELEVE_VISITS_KEY, JSON.stringify({ story: false, meetings: ['workshop'] }));
    markArenaIntroductionCompleted(scoped);
    expect(JSON.parse(scoped.getItem(ARENA_RELEVE_VISITS_KEY)!)).toEqual({ story: true, meetings: ['workshop'] });
    expect(createArenaLearningStorage('other', false, () => storage).getItem(ARENA_RELEVE_VISITS_KEY)).toBe(null);
  });

  it('preserves the story memory fallback if a scoped save cannot be persisted', () => {
    const scoped = createArenaLearningStorage('blocked-save', false, () => { throw Error('blocked'); });
    const session = createArenaReleveSession(scoped);
    session.update(state => ({ ...state, renovation: 'opened' }));
    expect(session.getSnapshot().state.renovation).toBe('opened');
    expect(session.getSnapshot().storageWarning).not.toBe('');
    expect(() => markArenaIntroductionCompleted(scoped)).not.toThrow();
  });
});
