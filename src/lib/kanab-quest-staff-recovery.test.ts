import { afterEach, describe, expect, it, vi } from "vitest";
import { clearKqStaffRecovery, kqStaffRecoveryKey, readKqStaffConfirmation, readKqStaffRecovery, saveKqStaffRecovery, type KqStaffRecovery, type KqStaffRecoveryStorage } from "./kanab-quest-staff-recovery";

const owner = "a0000000-0000-4000-8000-000000000001";
const other = "a0000000-0000-4000-8000-000000000002";
const key = "b0000000-0000-4000-8000-000000000001";
const attempt = (): KqStaffRecovery => ({ version: 1, ownerId: owner, sentAt: "2026-11-11T12:00:00.000Z", confirmation: {
  requestKey: key, command: { action: "trim", employeeId: null, mode: "manual", hours: 0.5, expectedCostCents: 0 },
  title: "Réserver le trim", description: "0,5 h de travail personnel.", rows: [["Temps", "0,5 h"], ["Débit immédiat", "0 €"]], debitCents: 0, confirmLabel: "Réserver",
} });
function memory() {
  const values = new Map<string, string>();
  const storage: KqStaffRecoveryStorage = { getItem: name => values.get(name) ?? null, setItem: (name, value) => { values.set(name, value); }, removeItem: name => { values.delete(name); } };
  return { values, storage };
}
afterEach(() => vi.useRealTimers());

describe("Staff submitted confirmation dossier", () => {
  it("round trips the original command, key and review, without inventing an attempt on reads", () => {
    const { storage, values } = memory();
    expect(readKqStaffRecovery(storage, owner)).toBeNull(); expect(values.size).toBe(0);
    const original = attempt(); saveKqStaffRecovery(storage, original);
    expect(readKqStaffRecovery(storage, owner)).toEqual(original);
    expect(readKqStaffRecovery(storage, owner)).not.toBe(original);
  });
  it("isolates accounts and refuses a foreign dossier stored under the current account key", () => {
    const { storage } = memory(); saveKqStaffRecovery(storage, attempt());
    expect(readKqStaffRecovery(storage, other)).toBeNull();
    storage.setItem(kqStaffRecoveryKey(other), JSON.stringify(attempt()));
    expect(() => readKqStaffRecovery(storage, other)).toThrow("illisible");
    expect(readKqStaffRecovery(storage, owner)?.confirmation.requestKey).toBe(key);
  });
  it("never overwrites an unresolved operation with a fresh key or a modified command", () => {
    const { storage } = memory(); const original = attempt(); saveKqStaffRecovery(storage, original);
    const fresh = attempt(); fresh.confirmation.requestKey = "b0000000-0000-4000-8000-000000000002";
    expect(saveKqStaffRecovery(storage, fresh)).toEqual(original);
    fresh.confirmation.requestKey = key; fresh.confirmation.command = { action: "payroll", expectedCents: 5000 };
    expect(saveKqStaffRecovery(storage, fresh)).toEqual(original);
    expect(readKqStaffRecovery(storage, owner)).toEqual(original);
  });
  it("keeps the original send date and review on a same-key replay", () => {
    const { storage } = memory(); const original = attempt(); saveKqStaffRecovery(storage, original);
    const replay = attempt(); replay.sentAt = "2026-11-12T13:00:00.000Z"; replay.confirmation.title = "Autre présentation";
    expect(saveKqStaffRecovery(storage, replay)).toEqual(original);
    expect(readKqStaffRecovery(storage, owner)).toEqual(original);
  });
  it("only clears the matching owner's request", () => {
    const { storage } = memory(); saveKqStaffRecovery(storage, attempt());
    clearKqStaffRecovery(storage, other, key); clearKqStaffRecovery(storage, owner, "another-key");
    expect(readKqStaffRecovery(storage, owner)).not.toBeNull();
    clearKqStaffRecovery(storage, owner, key); expect(readKqStaffRecovery(storage, owner)).toBeNull();
  });
  it.each(["{", "null", JSON.stringify({ ...attempt(), version: 2 }), JSON.stringify({ ...attempt(), sentAt: "unknown" }),
    JSON.stringify({ ...attempt(), confirmation: { ...attempt().confirmation, requestKey: "invalid" } }),
    JSON.stringify({ ...attempt(), confirmation: { ...attempt().confirmation, command: { action: "settle" } } }),
    JSON.stringify({ ...attempt(), confirmation: { ...attempt().confirmation, debitCents: -1 } }),
    JSON.stringify({ ...attempt(), confirmation: { ...attempt().confirmation, rows: [["missing value"]] } }),
  ])("preserves unreadable data and blocks replacement (%#)", saved => {
    const { storage } = memory(); storage.setItem(kqStaffRecoveryKey(owner), saved);
    expect(() => saveKqStaffRecovery(storage, attempt())).toThrow("illisible");
    expect(storage.getItem(kqStaffRecoveryKey(owner))).toBe(saved);
  });
  it("surfaces blocked or silently dropped storage writes before any request can use a new key", () => {
    const { storage } = memory(); storage.setItem = () => { throw new Error("QuotaExceededError"); };
    expect(() => saveKqStaffRecovery(storage, attempt())).toThrow("QuotaExceededError");
    storage.setItem = () => {};
    expect(() => saveKqStaffRecovery(storage, attempt())).toThrow("vérifiée");
  });
});

describe("Staff confirmation deadline", () => {
  it("reports session expiry even when its response body is missing, HTML or stalled", async () => {
    const json = vi.fn(() => new Promise(() => {}));
    const request = vi.fn<typeof fetch>().mockResolvedValue({ status: 401, json } as unknown as Response);
    const result = await readKqStaffConfirmation(request, { requestKey: key }, new AbortController().signal);
    expect(result.response.status).toBe(401); expect(result.payload).toBeNull(); expect(json).not.toHaveBeenCalled();
  });
  it("sends the exact keyed body and reads the response once", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ revision: 8 }));
    const body = { ...attempt().confirmation.command, requestKey: key, expectedOwnerId: owner };
    expect((await readKqStaffConfirmation(request, body, new AbortController().signal)).payload).toEqual({ revision: 8 });
    expect(request).toHaveBeenCalledTimes(1);
    expect(JSON.parse(request.mock.calls[0][1]!.body as string)).toEqual(body);
  });
  it("ends a stuck request, aborts its signal and ignores a late successful response", async () => {
    vi.useFakeTimers(); let resolve!: (response: Response) => void;
    const request = vi.fn<typeof fetch>().mockImplementation(() => new Promise(done => { resolve = done; }));
    const result = readKqStaffConfirmation(request, {}, new AbortController().signal, 20_000);
    const failed = expect(result).rejects.toThrow("délai de réponse");
    await vi.advanceTimersByTimeAsync(20_000); await failed;
    expect(request.mock.calls[0][1]!.signal!.aborted).toBe(true);
    resolve(Response.json({ revision: 9 })); await Promise.resolve();
    await expect(result).rejects.toThrow("délai de réponse"); expect(request).toHaveBeenCalledTimes(1);
  });
  it("includes a stuck response body in the deadline", async () => {
    vi.useFakeTimers(); const request = vi.fn<typeof fetch>().mockResolvedValue({ json: () => new Promise(() => {}) } as Response);
    const result = readKqStaffConfirmation(request, {}, new AbortController().signal, 20_000);
    const failed = expect(result).rejects.toThrow("délai de réponse");
    await vi.advanceTimersByTimeAsync(20_000); await failed;
  });
  it("aborts at unmount/owner change without making a second attempt", async () => {
    const controller = new AbortController(); const request = vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => {}));
    const result = readKqStaffConfirmation(request, {}, controller.signal);
    const failed = expect(result).rejects.toThrow("reste à vérifier"); controller.abort(); await failed;
    expect(request.mock.calls[0][1]!.signal!.aborted).toBe(true); expect(request).toHaveBeenCalledTimes(1);
  });
  it("does not send after an owner has already changed", async () => {
    const controller = new AbortController(); controller.abort(); const request = vi.fn<typeof fetch>();
    await expect(readKqStaffConfirmation(request, {}, controller.signal)).rejects.toThrow("reste à vérifier"); expect(request).not.toHaveBeenCalled();
  });
});
