import { afterEach, describe, expect, it, vi } from 'vitest';
import { ARENA_LEARNING_ENTRY_KEY, ARENA_RELEVE_VISITS_KEY, arenaIntroductionKey, arenaLearningAccountKey, createArenaLearningStorage, getArenaLearningEntryScreen, hasSeenArenaIntroduction, markArenaIntroductionCompleted, readArenaLearningEntryChoice, rememberArenaIntroduction, rememberArenaLearningEntryChoice } from './arena-introduction';
import { ARENA_RELEVE_STORAGE_KEY, createArenaReleveSession, readArenaReleveResume } from './arena-releve-session';

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

  it('offers new and uncertain accounts a choice without forcing a lesson on returning players', () => {
    expect(getArenaLearningEntryScreen('new', false, null)).toBe('choice');
    expect(getArenaLearningEntryScreen('unavailable', false, null)).toBe('choice');
    expect(getArenaLearningEntryScreen('seen', false, null)).toBe('quarter');
    expect(getArenaLearningEntryScreen('unavailable', true, null)).toBe('quarter');
  });

  it('remembers an interrupted lesson as a choice to resume, then honors a direct quarter choice', () => {
    const store = backing();
    const scoped = createArenaLearningStorage('choosing-player', false, () => store);
    const session = createArenaReleveSession(scoped);
    session.update(state => ({ ...state, renovation: 'opened' }));
    const save = scoped.getItem(ARENA_RELEVE_STORAGE_KEY);
    rememberArenaLearningEntryChoice('choosing-player', scoped, 'story');
    const interrupted = readArenaLearningEntryChoice('choosing-player', scoped);
    expect(getArenaLearningEntryScreen('seen', true, interrupted.choice)).toBe('choice');
    expect(readArenaReleveResume(scoped)?.chapter).toBe(0);
    rememberArenaLearningEntryChoice('choosing-player', scoped, 'quarter');
    expect(getArenaLearningEntryScreen('new', false, readArenaLearningEntryChoice('choosing-player', scoped).choice)).toBe('quarter');
    expect(scoped.getItem(ARENA_RELEVE_STORAGE_KEY)).toBe(save);
  });

  it('separates entry choices by account and never consumes a partial story save', () => {
    const store = backing();
    const first = createArenaLearningStorage('partial-choice-player', false, () => store);
    const second = createArenaLearningStorage('new-choice-player', false, () => store);
    first.setItem(ARENA_RELEVE_STORAGE_KEY, '{"version":1,"chapter":4}');
    const original = first.getItem(ARENA_RELEVE_STORAGE_KEY);
    expect(readArenaReleveResume(first)).toBe(null);
    expect(readArenaLearningEntryChoice('partial-choice-player', first).choice).toBe(null);
    rememberArenaLearningEntryChoice('partial-choice-player', first, 'quick');
    expect(readArenaLearningEntryChoice('new-choice-player', second).choice).toBe(null);
    expect(second.getItem(ARENA_LEARNING_ENTRY_KEY)).toBe(null);
    expect(first.getItem(ARENA_RELEVE_STORAGE_KEY)).toBe(original);
    expect(store.getItem(ARENA_LEARNING_ENTRY_KEY)).toBe(null);
  });

  it('keeps a deliberate choice for this account in memory while reporting unavailable storage', () => {
    const inaccessible = createArenaLearningStorage('inaccessible-choice', false, () => { throw Error('blocked'); });
    expect(readArenaLearningEntryChoice('inaccessible-choice', inaccessible)).toEqual({ choice: null, storageUnavailable: true });
    expect(rememberArenaLearningEntryChoice('inaccessible-choice', inaccessible, 'quarter')).toBe(false);
    expect(readArenaLearningEntryChoice('inaccessible-choice', inaccessible)).toEqual({ choice: 'quarter', storageUnavailable: true });
    expect(readArenaLearningEntryChoice('other-inaccessible-choice', inaccessible).choice).toBe(null);
  });

  it('ignores an obsolete preference without rewriting it or starting an adventure', () => {
    const store = backing();
    const scoped = createArenaLearningStorage('obsolete-choice', false, () => store);
    scoped.setItem(ARENA_LEARNING_ENTRY_KEY, 'removed-lesson');
    expect(readArenaLearningEntryChoice('obsolete-choice', scoped)).toEqual({ choice: null, storageUnavailable: false });
    expect(scoped.getItem(ARENA_LEARNING_ENTRY_KEY)).toBe('removed-lesson');
    expect(scoped.getItem(ARENA_RELEVE_STORAGE_KEY)).toBe(null);
  });

  it('honors a quarter choice made by the learning launcher using the same scoped storage', () => {
    const store = backing();
    const scoped = createArenaLearningStorage('launcher-choice', false, () => store);
    rememberArenaLearningEntryChoice('launcher-choice', scoped, 'quick');
    scoped.setItem(ARENA_LEARNING_ENTRY_KEY, 'quarter');
    expect(readArenaLearningEntryChoice('launcher-choice', scoped).choice).toBe('quarter');
    expect(getArenaLearningEntryScreen('new', false, readArenaLearningEntryChoice('launcher-choice', scoped).choice)).toBe('quarter');
  });

  it('synchronizes launcher choices with a failed-write fallback and then recovered storage', () => {
    const store = backing();
    let writable = false;
    const scoped = createArenaLearningStorage('launcher-recovery', false, () => ({ ...store, setItem(key, value) {
      if (!writable) throw Error('quota');
      store.setItem(key, value);
    } }));
    expect(rememberArenaLearningEntryChoice('launcher-recovery', scoped, 'quick')).toBe(false);
    expect(() => scoped.setItem(ARENA_LEARNING_ENTRY_KEY, 'quarter')).toThrow('quota');
    expect(readArenaLearningEntryChoice('launcher-recovery', scoped).choice).toBe('quarter');
    expect(readArenaLearningEntryChoice('other-launcher-recovery', createArenaLearningStorage('other-launcher-recovery', false, () => store)).choice).toBe(null);
    writable = true;
    scoped.setItem(ARENA_LEARNING_ENTRY_KEY, 'story');
    expect(readArenaLearningEntryChoice('launcher-recovery', scoped).choice).toBe('story');
    scoped.setItem(ARENA_LEARNING_ENTRY_KEY, 'quarter');
    expect(readArenaLearningEntryChoice('launcher-recovery', scoped).choice).toBe('quarter');
    expect(scoped.getItem(ARENA_RELEVE_STORAGE_KEY)).toBe(null);
  });
});
