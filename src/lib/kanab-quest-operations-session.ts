import { applyKqOperationsRequest, createKqOperationsLesson, type KqOperationsLessonAction, type KqOperationsLessonId } from './kanab-quest-operations-lesson';
import { normalizeKqSocialSnapshot } from './kanab-quest-social';

export function resetKqPlayableOperationsLesson(lesson: KqOperationsLessonId, scope = 'discovery') {
  try { sessionStorage.removeItem(`kq-playable-operations-v1:${scope}:${lesson}`); } catch { /* Optional storage. */ }
}

export function restoreKqOperationsLesson(lesson: KqOperationsLessonId, value: unknown) {
  const initial = { state: createKqOperationsLesson(lesson), actions: [] as KqOperationsLessonAction[] };
  if (!value || typeof value !== 'object') return initial;
  const row = value as { version?: unknown; lesson?: unknown; actions?: unknown };
  if (row.version !== 1 || row.lesson !== lesson || !Array.isArray(row.actions) || row.actions.length > 500) return initial;
  try {
    let state = initial.state;
    let catalog: 'original' | 'expanded' | null = null;
    let narrative: 1 | 2 | 3 | null = null;
    const upgradeCatalog = () => {
      if (state.social?.version === 2) {
        state.social = normalizeKqSocialSnapshot({ ...state.social, storyCatalogVersion: undefined }, state.trial.clock, 2);
      }
    };
    const upgradeNarrative = (version: 2 | 3 = 3) => {
      if (state.social?.version === 2) {
        state.social = normalizeKqSocialSnapshot({ ...state.social, narrativeVersion: undefined }, state.trial.clock, version);
      }
    };
    const actions: KqOperationsLessonAction[] = [];
    for (const action of row.actions) {
      if (!action || typeof action !== 'object' || typeof action.path !== 'string' || !['POST', 'PATCH'].includes(action.method) || !action.body || typeof action.body !== 'object' || Array.isArray(action.body)) return initial;
      const social = new URL(action.path, 'https://lesson.invalid').pathname === '/api/arena/placard/social';
      const legacySocial = social && action.body.modelVersion === undefined;
      const originalCatalog = social && action.body.modelVersion === 2 && action.socialCatalogVersion === undefined;
      const legacyNarrative = social && action.body.modelVersion === 2 && action.socialNarrativeVersion === undefined;
      const v2Narrative = social && action.body.modelVersion === 2 && action.socialNarrativeVersion === 2;
      if (social && action.body.modelVersion === 2) {
        if (action.socialCatalogVersion !== undefined && action.socialCatalogVersion !== 2) return initial;
        if (action.socialNarrativeVersion !== undefined && action.socialNarrativeVersion !== 2 && action.socialNarrativeVersion !== 3) return initial;
        const version = legacyNarrative ? 1 : v2Narrative ? 2 : 3;
        if (narrative !== null && version < narrative || originalCatalog && !legacyNarrative) return initial;
        if (narrative !== null && version > narrative) upgradeNarrative(version as 2 | 3);
        narrative = version;
        if (originalCatalog && catalog === 'expanded') return initial;
        if (!originalCatalog && catalog === 'original') upgradeCatalog();
        catalog = originalCatalog ? 'original' : 'expanded';
      }
      state = applyKqOperationsRequest(state, action, legacySocial ? { replaySocialV1: true }
        : { ...(originalCatalog ? { replaySocialOriginalCatalog: true as const } : {}), ...(legacyNarrative ? { replaySocialLegacyNarrative: true as const } : {}), ...(v2Narrative ? { replaySocialV2Narrative: true as const } : {}) }).state;
      actions.push(action);
    }
    if (catalog === 'original') upgradeCatalog();
    if (narrative !== null && narrative < 3) upgradeNarrative();
    if (state.social) state.social = normalizeKqSocialSnapshot(state.social, state.trial.clock);
    return { state, actions };
  } catch { return initial; }
}

/** A local request transport for the real interfaces; never delegates to fetch. */
export function createKqOperationsSession(lesson: KqOperationsLessonId, scope = 'discovery') {
  const initial = createKqOperationsLesson(lesson);
  let state = initial;
  let actions: KqOperationsLessonAction[] = [];
  let restored = false;
  const listeners = new Set<() => void>();
  const storageKey = `kq-playable-operations-v1:${scope}:${lesson}`;
  const changed = () => listeners.forEach(listener => listener());
  const restore = () => {
    if (restored || typeof window === 'undefined') return;
    restored = true;
    try {
      const result = restoreKqOperationsLesson(lesson, JSON.parse(sessionStorage.getItem(storageKey) ?? 'null'));
      state = result.state; actions = result.actions;
    } catch { /* Storage may be refused; this lesson still works in memory. */ }
    changed();
  };
  const request: typeof fetch = async (input, init) => {
    restore();
    try {
      const path = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
      const source = init?.body ?? (input instanceof Request && method !== 'GET' ? await input.text() : undefined);
      const body = typeof source === 'string' ? JSON.parse(source) : {};
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Action invalide.');
      const action: KqOperationsLessonAction = { path, method, body,
        ...(new URL(path, 'https://lesson.invalid').pathname === '/api/arena/placard/social' ? { socialCatalogVersion: 2 as const, socialNarrativeVersion: 3 as const } : {}) };
      const result = applyKqOperationsRequest(state, action);
      if (result.state !== state) {
        if (actions.length >= 500) throw new Error('Cet essai est rempli. Recommence-le pour poursuivre.');
        state = result.state; actions = [...actions, action];
        try { sessionStorage.setItem(storageKey, JSON.stringify({ version: 1, lesson, actions })); } catch { /* In-memory play remains available. */ }
        changed();
      }
      return Response.json(result.payload);
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : 'Action indisponible dans cet essai.' }, { status: 400 });
    }
  };
  return {
    request, storageKey,
    getSnapshot: () => state,
    getServerSnapshot: () => initial,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    restore,
    restart: () => {
      state = createKqOperationsLesson(lesson); actions = []; restored = true;
      resetKqPlayableOperationsLesson(lesson, scope);
      changed();
    },
  };
}
