import { afterEach, describe, expect, it, vi } from "vitest";
import { clearFinanceRecovery, financeOwnerProblem, financeRecoveryKey, readFinanceRecovery, readFinanceResponse, sameFinanceCommand, saveFinanceRecovery, type KqFinanceRecovery } from "./kanab-quest-finance-recovery";
const owner = "11111111-1111-4111-8111-111111111111", key = "22222222-2222-4222-8222-222222222222";
function storage() { const data = new Map<string, string>(); return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } }; }
const record: KqFinanceRecovery = { version: 1, scope: "bank", ownerId: owner, sentAt: "2026-11-15T12:00:00Z", summary: "Emprunt 1000 €", command: { action: "borrow", quoteId: key, amountCents: 100000, expectedRateBps: 700, requestKey: key } };
afterEach(() => vi.useRealTimers());
describe("financial confirmation continuity", () => {
 it("keeps the original command across reload, refuses replacement and isolates accounts", () => {
  const store = storage();
  const saved = saveFinanceRecovery(store, record);
  expect(sameFinanceCommand(saved.command, record.command)).toBe(true);
  expect(readFinanceRecovery(store, owner, "bank")).toEqual(saved);
  expect(saveFinanceRecovery(store, { ...record, command: { ...record.command, amountCents: 200000 } })).toEqual(saved);
  expect(readFinanceRecovery(store, key, "bank")).toBeNull();
  clearFinanceRecovery(store, { ...record, command: { ...record.command, requestKey: owner } });
  expect(readFinanceRecovery(store, owner, "bank")).not.toBeNull();
  clearFinanceRecovery(store, saved); expect(readFinanceRecovery(store, owner, "bank")).toBeNull();
 });
 it("preserves the next-publication acknowledgement and rejects corrupt recovery", () => {
  const store = storage(); const item = { ...record, scope: "crypto" as const, command: { action: "confirm", orderId: key, executionPolicy: "next-publication" } };
  expect(saveFinanceRecovery(store, item).command).toEqual(item.command);
  store.setItem(financeRecoveryKey(owner, "crypto"), "bad");
  expect(() => readFinanceRecovery(store, owner, "crypto")).toThrow(/illisible/);
  expect(() => saveFinanceRecovery(store, item)).toThrow(/illisible/);
 });
 it("stops before sending if storage is unavailable", () => {
  const store = storage(); store.setItem = () => { throw new Error("denied"); };
  expect(() => saveFinanceRecovery(store, record)).toThrow("denied");
 });
 it.each(["headers", "body"])("bounds a stuck %s even when abort is ignored", async stage => {
  vi.useFakeTimers();
  const request = vi.fn().mockImplementation(() => stage === "headers" ? new Promise(() => {}) : Promise.resolve({ status: 200, json: () => new Promise(() => {}) }));
  const pending = readFinanceResponse(request, "bank", record.command, new AbortController().signal, 25);
  const check = expect(pending).rejects.toThrow(/Délai dépassé/);
  await vi.advanceTimersByTimeAsync(25); await check;
  expect(request.mock.calls[0][1].signal.aborted).toBe(true);
 });
 it("reads 401 without waiting on an invalid or stalled body", async () => {
  const response = { status: 401, json: vi.fn(() => new Promise(() => {})) };
  expect((await readFinanceResponse(vi.fn().mockResolvedValue(response), "crypto", {}, new AbortController().signal)).body).toBeNull();
  expect(response.json).not.toHaveBeenCalled();
 });
 it("never sends an aborted attempt and identifies a changed account", async () => {
  const controller = new AbortController(); controller.abort(); const request = vi.fn();
  await expect(readFinanceResponse(request, "bank", {}, controller.signal)).rejects.toThrow(); expect(request).not.toHaveBeenCalled();
  expect(financeOwnerProblem({ expectedOwnerId: owner }, owner)).toBeNull();
  expect(financeOwnerProblem({ expectedOwnerId: key }, owner)).toBe("changed");
  expect(financeOwnerProblem({ expectedOwnerId: "other" }, owner)).toBe("invalid");
 });
});
