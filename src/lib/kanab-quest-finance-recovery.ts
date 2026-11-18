import { parseKqBankCommand } from "./kanab-quest-bank";
import { getKqStaffReconnectHref } from "./kanab-quest-staff-reauth";

export type KqFinanceScope = "bank" | "crypto" | "stocks";
export type KqFinanceRecovery = { version: 1; ownerId: string; scope: KqFinanceScope; sentAt: string; summary: string; command: Record<string, unknown> };
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const financeRecoveryKey = (owner: string, scope: KqFinanceScope) => `kq:finance-confirmation:v1:${scope}:${encodeURIComponent(owner)}`;
export const getKqFinanceReconnectHref = getKqStaffReconnectHref;
export const sameFinanceCommand = (a: Record<string, unknown>, b: Record<string, unknown>) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
export function readFinanceRecovery(store: Store, ownerId: string, scope: KqFinanceScope): KqFinanceRecovery | null {
  const text = store.getItem(financeRecoveryKey(ownerId, scope));
  if (text === null) return null;
  try {
    if (text.length > 16_000) throw new Error();
    const value = JSON.parse(text) as KqFinanceRecovery;
    if (!value || value.version !== 1 || value.ownerId !== ownerId || value.scope !== scope || typeof value.sentAt !== "string" || !Number.isFinite(Date.parse(value.sentAt))
      || typeof value.summary !== "string" || !value.summary.trim() || value.summary.length > 2000 || !value.command || typeof value.command !== "object") throw new Error();
    if (scope === "bank") {
      const command = parseKqBankCommand(value.command);
      if (!command) throw new Error();
      return { ...value, command };
    }
    if (value.command.action !== "confirm" || typeof value.command.orderId !== "string" || !uuid.test(value.command.orderId)) throw new Error();
    return { ...value, command: { action: "confirm", orderId: value.command.orderId, ...(value.command.executionPolicy === "next-publication" ? { executionPolicy: "next-publication" } : {}) } };
  } catch { throw new Error("Le dossier financier conservé est illisible. Aucune nouvelle opération ne sera envoyée."); }
}
export function saveFinanceRecovery(store: Store, value: KqFinanceRecovery) {
  const existing = readFinanceRecovery(store, value.ownerId, value.scope);
  if (existing) return existing;
  const key = financeRecoveryKey(value.ownerId, value.scope), text = JSON.stringify(value);
  store.setItem(key, text);
  if (store.getItem(key) !== text) throw new Error("La confirmation n’a pas pu être conservée sur cet appareil. Aucune demande envoyée.");
  return readFinanceRecovery(store, value.ownerId, value.scope)!;
}
export function clearFinanceRecovery(store: Store, value: KqFinanceRecovery) {
  const current = readFinanceRecovery(store, value.ownerId, value.scope);
  if (current && sameFinanceCommand(current.command, value.command)) store.removeItem(financeRecoveryKey(value.ownerId, value.scope));
}
/** Bounds headers AND decoding, even when the transport ignores AbortSignal. */
export async function readFinanceResponse(request: typeof fetch, scope: KqFinanceScope, command: unknown, signal: AbortSignal, timeout = 20_000) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort = () => {};
  const interrupted = new Promise<never>((_, reject) => {
    abort = () => { controller.abort(); reject(new Error("La confirmation reste à vérifier.")); };
    signal.addEventListener("abort", abort, { once: true });
    timer = setTimeout(() => { controller.abort(); reject(new Error("Délai dépassé. La demande peut avoir été enregistrée. Vérifie la même confirmation.")); }, timeout);
    if (signal.aborted) abort();
  });
  try {
    return await Promise.race([interrupted, (async () => {
      if (signal.aborted) throw new Error("La confirmation reste à vérifier.");
      const response = await request(`/api/arena/placard/${scope}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(command), signal: controller.signal });
      if (response.status === 401) return { response, body: null };
      const body: unknown = await response.json();
      return { response, body };
    })()]);
  } finally { clearTimeout(timer); signal.removeEventListener("abort", abort); }
}

/** Optional for older clients; persisted confirmations always send this binding. */
export function financeOwnerProblem(value: unknown, ownerId: string): "invalid" | "changed" | null {
  if (!value || typeof value !== "object" || !("expectedOwnerId" in value)) return null;
  if (typeof value.expectedOwnerId !== "string" || !uuid.test(value.expectedOwnerId)) return "invalid";
  return value.expectedOwnerId.toLowerCase() === ownerId.toLowerCase() ? null : "changed";
}
