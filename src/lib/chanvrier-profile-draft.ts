import { getChanvrierAppearance, parseChanvrierProfile, type ChanvrierProfile } from "./arena-chanvrier";

export const NEW_CHANVRIER_PROFILE: ChanvrierProfile = {
  nickname: "", gender: "male", clothing: "teal", skin: "honey", strength: "green-thumb",
  appearance: {
    ...getChanvrierAppearance({ gender: "male" }), face: "round", nose: "round", top: "mariniere", shoes: "work",
    dyes: { top: "#eee3c8", accent: "#305d63", bottom: "#30525a" },
  },
};

const STEPS = ["inheritance", "look", "strength", "review"] as const;
export type ChanvrierProfileStep = typeof STEPS[number];
export type ChanvrierDraft = { profile: ChanvrierProfile; step: ChanvrierProfileStep };
export type ChanvrierDraftScope = { storage: "localStorage" | "sessionStorage"; key: string };

// Keep edits and explicit discards effective for this tab if browser storage is blocked.
const fallback = new Map<string, { value: string | null; pending: boolean }>();

function read({ storage, key }: ChanvrierDraftScope) {
  const cached = fallback.get(key);
  if (cached?.pending) return cached.value;
  try { return window[storage].getItem(key); }
  catch { return cached?.value ?? null; }
}

function write({ storage, key }: ChanvrierDraftScope, value: string | null) {
  try {
    if (value === null) window[storage].removeItem(key);
    else window[storage].setItem(key, value);
    if (value === null) fallback.delete(key);
    else fallback.set(key, { value, pending: false });
  } catch {
    fallback.set(key, { value, pending: true });
  }
}

function parse(value: string | null): unknown {
  if (value === null) return null;
  try { return JSON.parse(value); }
  catch { return null; }
}

/** Observe the server profile before opening the editor. A completed adventure retires its creation draft. */
export function observeChanvrierAdventure(ownerId: string, createdAt: string | null): ChanvrierDraftScope {
  const prefix = `chanvrier-editor:v1:account:${encodeURIComponent(ownerId)}`;
  const marker: ChanvrierDraftScope = { storage: "localStorage", key: `${prefix}:last-character` };
  const lastCharacter = read(marker);
  const creation: ChanvrierDraftScope = { storage: "localStorage", key: `${prefix}:create:${encodeURIComponent(lastCharacter ?? "initial")}` };
  if (createdAt === null) return creation;
  if (createdAt !== lastCharacter) {
    write(creation, null);
    write(marker, createdAt);
  }
  return { storage: "localStorage", key: `${prefix}:edit:${encodeURIComponent(createdAt)}` };
}

export function getChanvrierPreviewScope(ownerId: string, slot: "create" | "edit" | "profile"): ChanvrierDraftScope {
  return { storage: "sessionStorage", key: `chanvrier-editor:v1:preview:${encodeURIComponent(ownerId)}:${slot}` };
}

export function readChanvrierPreviewProfile(scope: ChanvrierDraftScope) {
  return parseChanvrierProfile(parse(read(scope)));
}

export function writeChanvrierPreviewProfile(scope: ChanvrierDraftScope, profile: ChanvrierProfile) {
  write(scope, JSON.stringify(profile));
}

export function readChanvrierDraft(scope: ChanvrierDraftScope, profile: ChanvrierProfile | null): ChanvrierDraft | null {
  const saved = parse(read(scope));
  if (!saved || typeof saved !== "object") return null;
  const record = saved as { profile?: Record<string, unknown>; step?: unknown };
  const nickname = record.profile?.nickname;
  const step = STEPS.find(item => item === record.step);
  if (typeof nickname !== "string" || nickname.length > 24 || !step) return null;
  // An unfinished nickname is valid for a draft. Every other field uses the same catalog checks as a saved profile.
  const restored = parseChanvrierProfile({ ...record.profile, nickname: "Brouillon", strength: profile?.strength ?? record.profile?.strength });
  return restored ? { profile: { ...restored, nickname }, step } : null;
}

export function writeChanvrierDraft(scope: ChanvrierDraftScope, draft: ChanvrierDraft) {
  write(scope, JSON.stringify(draft));
}

export function clearChanvrierDraft(scope: ChanvrierDraftScope) {
  write(scope, null);
}
