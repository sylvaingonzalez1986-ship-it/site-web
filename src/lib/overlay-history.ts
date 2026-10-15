/** Same-URL history entries for transient UI. Preserve Next's own history state. */
const KEY = "lcbOverlays";
type Entry = { id: string; url: string; close: () => void; disposed: boolean; closing: boolean };
const entries = new Map<string, Entry>();
let listening = false;
let afterBack: (() => void) | null = null;

function ids(): string[] {
  const value = window.history.state?.[KEY];
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
}

function stateWith(stack: string[]) {
  const state = { ...window.history.state };
  if (stack.length) state[KEY] = stack;
  else delete state[KEY];
  return state;
}

function onPopState() {
  const current = ids();
  for (const entry of [...entries.values()].reverse()) {
    if (entry.url === window.location.href && current.includes(entry.id)) continue;
    entries.delete(entry.id);
    if (!entry.disposed && !entry.closing) entry.close();
  }
  const known = current.filter(id => entries.has(id));
  if (known.length !== current.length) window.history.replaceState(stateWith(known), "");
  const next = afterBack;
  afterBack = null;
  next?.();
}

export function registerOverlayHistory(id: string, close: () => void) {
  if (!listening) {
    window.addEventListener("popstate", onPopState);
    listening = true;
  }
  const previous = entries.get(id);
  if (previous && previous.url === window.location.href && !previous.closing) {
    previous.disposed = false;
    previous.close = close;
  } else {
    const entry = { id, url: window.location.href, close, disposed: false, closing: false };
    const current = ids();
    const replaced = current.at(-1);
    const replacedEntry = replaced ? entries.get(replaced) : undefined;
    const replacing = replacedEntry?.disposed && !replacedEntry.closing && replacedEntry.url === window.location.href;
    if (replacing && replaced) entries.delete(replaced);
    entries.set(id, entry);
    const stack = current.filter(value => value !== id && entries.has(value));
    if (replacing) window.history.replaceState(stateWith([...stack, id]), "");
    else window.history.pushState(stateWith([...stack, id]), "");
  }
  return () => {
    const entry = entries.get(id);
    if (!entry) return;
    entry.disposed = true;
    // React StrictMode remounts effects immediately. Reuse the entry in that case.
    queueMicrotask(() => {
      if (entries.get(id) !== entry || !entry.disposed || entry.closing) return;
      if (entry.url === window.location.href && ids().includes(id)) closeOverlayHistory(id);
      else entries.delete(id);
    });
  };
}

export function closeOverlayHistory(id: string, navigate?: () => void) {
  if (afterBack) return; // A history traversal already owns the next navigation.
  const stack = ids();
  const index = navigate ? 0 : stack.indexOf(id);
  const entry = entries.get(id);
  if (!entry || entry.url !== window.location.href || index < 0) {
    if (entry && !entry.disposed) entry.close();
    entries.delete(id);
    navigate?.();
    return;
  }
  const closing = stack.slice(index);
  for (const key of closing.reverse()) {
    const item = entries.get(key);
    if (!item) continue;
    item.closing = true;
    if (!item.disposed) item.close();
  }
  afterBack = navigate ?? (() => undefined);
  window.history.go(-(stack.length - index));
}

export function hasOverlayHistory() {
  return ids().some(id => entries.has(id));
}

export function navigateAfterOverlays(action: () => void) {
  const top = ids().findLast(id => entries.has(id));
  if (top) closeOverlayHistory(top, action);
  else action();
}
