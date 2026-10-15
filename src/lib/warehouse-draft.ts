import { isKqWarehouseState, type KqWarehouseState } from "./kanab-quest-warehouse";

export type WarehouseDraft = { revision: number; state: KqWarehouseState };
const key = (owner: string) => `lcb:warehouse-draft:v1:${owner}`;
// A same-document Back must preserve edits even when browser storage is denied.
const volatileDrafts = new Map<string, WarehouseDraft>();

export function warehouseDraftStorage(): Storage | null {
  try { return window.sessionStorage; } catch { return null; }
}

export function readWarehouseDraft(storage: Pick<Storage, "getItem"> | null, owner: string): WarehouseDraft | null {
  const volatile = volatileDrafts.get(owner);
  if (volatile) return volatile;
  try {
    const value: unknown = JSON.parse(storage?.getItem(key(owner)) ?? "null");
    if (!value || typeof value !== "object" || !("revision" in value) || !("state" in value)
      || !Number.isSafeInteger(value.revision) || !isKqWarehouseState(value.state)) return null;
    return { revision: value.revision as number, state: value.state };
  } catch { return null; }
}

export function writeWarehouseDraft(storage: Pick<Storage, "setItem" | "removeItem"> | null, owner: string, draft: WarehouseDraft | null): boolean {
  if (draft) volatileDrafts.set(owner, draft);
  else volatileDrafts.delete(owner);
  if (!storage) return false;
  try {
    if (draft) storage.setItem(key(owner), JSON.stringify(draft));
    else storage.removeItem(key(owner));
    return true;
  } catch { return false; }
}
