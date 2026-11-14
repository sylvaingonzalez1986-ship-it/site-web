import { parseKqStaffCommand } from "./kanab-quest-staff";
import type { KqStaffCommand } from "./kanab-quest-staff-types";

export type KqStaffConfirmation = { title: string; description: string; rows: Array<[string, string]>; command: KqStaffCommand; requestKey: string; debitCents: number; confirmLabel: string };
export type KqStaffRecovery = { version: 1; ownerId: string; sentAt: string; confirmation: KqStaffConfirmation };
export type KqStaffRecoveryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export const KQ_STAFF_CONFIRMATION_TIMEOUT = 20_000;
export const kqStaffRecoveryKey = (ownerId: string) => `kq:staff-confirmation:v1:${encodeURIComponent(ownerId)}`;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max = 4000): value is string => typeof value === "string" && value.length > 0 && value.length <= max;

/** Only submitted commands are saved. An unreadable dossier must never be silently replaced. */
export function readKqStaffRecovery(storage: KqStaffRecoveryStorage, ownerId: string): KqStaffRecovery | null {
  const saved = storage.getItem(kqStaffRecoveryKey(ownerId));
  if (saved === null) return null;
  try {
    if (saved.length > 100_000) throw new Error();
    const value: unknown = JSON.parse(saved);
    if (!record(value) || value.version !== 1 || value.ownerId !== ownerId || !text(value.sentAt, 40) || !Number.isFinite(Date.parse(value.sentAt))) throw new Error();
    const draft = value.confirmation;
    if (!record(draft) || !text(draft.title, 240) || !text(draft.description) || !text(draft.confirmLabel, 240)
      || typeof draft.requestKey !== "string" || !uuid.test(draft.requestKey) || !Number.isSafeInteger(draft.debitCents) || Number(draft.debitCents) < 0
      || !Array.isArray(draft.rows) || draft.rows.length > 100 || !draft.rows.every(row => Array.isArray(row) && row.length === 2 && row.every(cell => text(cell)))) throw new Error();
    const command = parseKqStaffCommand(draft.command);
    if (command.action === "settle") throw new Error();
    return { version: 1, ownerId, sentAt: value.sentAt, confirmation: { ...draft, command } as KqStaffConfirmation };
  } catch { throw new Error("Le dossier de confirmation conservé sur cet appareil est illisible. Aucune nouvelle demande n’a été envoyée."); }
}

export function saveKqStaffRecovery(storage: KqStaffRecoveryStorage, value: KqStaffRecovery) {
  const current = readKqStaffRecovery(storage, value.ownerId);
  // The original review and send time remain intact, including on a replay.
  if (current) return current;
  const encoded = JSON.stringify(value);
  storage.setItem(kqStaffRecoveryKey(value.ownerId), encoded);
  if (storage.getItem(kqStaffRecoveryKey(value.ownerId)) !== encoded) throw new Error("La sauvegarde de la confirmation n’a pas pu être vérifiée.");
  return value;
}

export function clearKqStaffRecovery(storage: KqStaffRecoveryStorage, ownerId: string, requestKey: string) {
  const current = readKqStaffRecovery(storage, ownerId);
  if (current?.confirmation.requestKey === requestKey) storage.removeItem(kqStaffRecoveryKey(ownerId));
}

/** Includes response-body decoding; a transport that ignores abort cannot leave the UI busy forever. */
export async function readKqStaffConfirmation(request: typeof fetch, body: unknown, signal: AbortSignal, timeout = KQ_STAFF_CONFIRMATION_TIMEOUT) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: () => void = () => {};
  const interrupted = new Promise<never>((_, reject) => {
    onAbort = () => { controller.abort(); reject(new Error("La confirmation reste à vérifier.")); };
    signal.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(() => { controller.abort(); reject(new Error("Le délai de réponse est dépassé. La demande a peut-être été enregistrée. Réessaie cette même confirmation.")); }, timeout);
    if (signal.aborted) onAbort();
  });
  try {
    return await Promise.race([interrupted, (async () => {
      if (signal.aborted) throw new Error("La confirmation reste à vérifier.");
      try {
        const response = await request("/api/arena/placard/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: controller.signal });
        // Authentication status is sufficient even if a proxy supplied an empty/non-JSON body.
        if (response.status === 401) return { response, payload: null };
        const payload: unknown = await response.json();
        return { response, payload };
      } catch { throw new Error("La réponse n’a pas pu être lue. La demande a peut-être été enregistrée. Réessaie cette même confirmation."); }
    })()]);
  } finally { clearTimeout(timer); signal.removeEventListener("abort", onAbort); }
}
