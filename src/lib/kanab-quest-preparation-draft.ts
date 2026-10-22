import type { KqPreparationSelection } from "./kanab-quest-preparation-selection";

const key = (owner: string) => `lcb:culture-preparation:v1:${encodeURIComponent(owner)}`;
type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function kqPreparationStorage(): DraftStorage | null {
  try { return window.sessionStorage; } catch { return null; }
}

/** Preferences only: no run, stock reservation, price or authority is restored. */
export function readKqPreparationDraft(storage: Pick<DraftStorage, "getItem"> | null, owner?: string): KqPreparationSelection | null {
  if (!owner?.trim()) return null;
  try {
    const value: unknown = JSON.parse(storage?.getItem(key(owner)) ?? "null");
    if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1
      || !("deckCodes" in value) || !Array.isArray(value.deckCodes) || value.deckCodes.length > 250
      || !value.deckCodes.every(code => typeof code === "string" && code.length > 0 && code.length <= 128)
      || !("heritageCode" in value) || !(value.heritageCode === null || (typeof value.heritageCode === "string" && value.heritageCode.length > 0 && value.heritageCode.length <= 128))) return null;
    return { deckCodes: [...value.deckCodes], heritageCode: value.heritageCode };
  } catch { return null; }
}

export function writeKqPreparationDraft(storage: Pick<DraftStorage, "setItem" | "removeItem"> | null, owner: string | undefined, draft: KqPreparationSelection | null): boolean {
  if (!owner?.trim() || !storage) return false;
  try {
    if (draft) storage.setItem(key(owner), JSON.stringify({ version: 1, deckCodes: draft.deckCodes, heritageCode: draft.heritageCode }));
    else storage.removeItem(key(owner));
    return true;
  } catch { return false; }
}
