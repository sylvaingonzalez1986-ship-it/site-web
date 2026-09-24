import { describe, expect, it } from "vitest";
import { formatKqCryptoQuantity, getKqCryptoRefreshDelayMs, isKqCryptoQuoteFresh, isKqCryptoRefreshStatus, isKqCryptoSnapshot, parseKqCryptoAction, parseKqCryptoEuros, type KqCryptoSnapshot } from "./kanab-quest-crypto";
describe("virtual crypto orders", () => {
 it("parses euro input without floating point rounding", () => {
  expect(parseKqCryptoEuros("1,13")).toBe(113); expect(parseKqCryptoEuros("123.45")).toBe(12345);
  for (const amount of ["0.99", "1e3", "1.234", "NaN", "1000001", "-10", "1 000"]) expect(parseKqCryptoEuros(amount)).toBeNull();
 });
 it("keeps whole quantities ending with zero", () => {
  expect(formatKqCryptoQuantity("100")).toBe("100"); expect(formatKqCryptoQuantity("100.000000000000000000")).toBe("100");
  expect(formatKqCryptoQuantity("0.000000000000000001")).toBe("0,000000000000000001");
 });
 it("normalizes orders while discarding supplied owner, price and expiry", () => {
  expect(parseKqCryptoAction({ action:"preview", side:"buy", assetId:1, amountCents:113, userId:"victim", priceEur:"0.01" })).toEqual({ action:"preview", side:"buy", assetId:1, amountCents:113 });
  expect(parseKqCryptoAction({ action:"preview", side:"sell", assetId:2, quantity:"0.000000000000000001" })).toEqual({ action:"preview", side:"sell", assetId:2, quantity:"0.000000000000000001" });
 });
 it.each([0,-1,1.5,99,100000001,Number.MAX_SAFE_INTEGER])("rejects invalid buy cents %s", amountCents => expect(() => parseKqCryptoAction({action:"preview",side:"buy",assetId:1,amountCents})).toThrow());
 it.each(["-1","0","NaN","1e-18","1.0000000000000000001","100000000000000000000",1])("rejects unsafe quantities %s", quantity => expect(() => parseKqCryptoAction({action:"preview",side:"sell",assetId:1,quantity})).toThrow());
 it("rejects ten-minute-old or future quotes", () => {
  const now=Date.parse("2026-09-23T15:00:00Z");
  expect(isKqCryptoQuoteFresh("2026-09-23T14:50:01Z",now)).toBe(true);
  expect(isKqCryptoQuoteFresh("2026-09-23T14:50:00Z",now)).toBe(false);
  expect(isKqCryptoQuoteFresh("2026-09-23T15:02:00Z",now)).toBe(false);
 });
});

describe("crypto refresh recovery", () => {
 const now = Date.parse("2026-09-24T12:00:00Z");
 const snapshot: KqCryptoSnapshot = { version: 1, serverNow: new Date(now).toISOString(), marketStatus: "stale", updatedAt: null, cashCents: 10000, assets: [], positions: [], recentTrades: [] };
 const refresh = { refreshing: false, nextAttemptAt: "2026-09-24T12:00:30Z", lastFailureCode: "rate_limited" as const };

 it("accepts snapshots from before and after refresh metadata was introduced", () => {
  expect(isKqCryptoSnapshot(snapshot)).toBe(true);
  expect(isKqCryptoSnapshot({ ...snapshot, refresh })).toBe(true);
  expect(isKqCryptoSnapshot({ ...snapshot, marketStatus: "live", refresh: { refreshing: false, nextAttemptAt: null, lastFailureCode: null } })).toBe(true);
 });
 it.each([null, {}, { ...refresh, refreshing: "false" }, { ...refresh, nextAttemptAt: "tomorrow" }, { ...refresh, lastFailureCode: "unexpected" }])("rejects malformed refresh metadata %j", invalid => {
  expect(isKqCryptoRefreshStatus(invalid)).toBe(false);
  expect(isKqCryptoSnapshot({ ...snapshot, refresh: invalid })).toBe(false);
 });
 it.each(["rate_limited", "provider_unavailable", "invalid_quotes", "publish_failed", null])("accepts the refresh result %s", lastFailureCode => {
  expect(isKqCryptoRefreshStatus({ ...refresh, lastFailureCode })).toBe(true);
 });
 it.each(["stale", "unavailable"] as const)("retries %s quotes at the server deadline", marketStatus => {
  expect(getKqCryptoRefreshDelayMs({ marketStatus, refresh }, now)).toBe(30_000);
 });
 it("rechecks an active refresh after five seconds", () => {
  expect(getKqCryptoRefreshDelayMs({ ...snapshot, refresh: { ...refresh, refreshing: true } }, now)).toBe(5_000);
 });
 it("bounds overdue and distant deadlines to avoid rapid retries or a stuck market", () => {
  expect(getKqCryptoRefreshDelayMs({ ...snapshot, refresh }, now + 31_000)).toBe(5_000);
  expect(getKqCryptoRefreshDelayMs({ ...snapshot, refresh }, now - 120_000)).toBe(60_000);
 });
 it("keeps the usual one-minute polling after recovery and without refresh metadata", () => {
  expect(getKqCryptoRefreshDelayMs({ ...snapshot, marketStatus: "live", refresh }, now)).toBe(60_000);
  expect(getKqCryptoRefreshDelayMs(snapshot, now)).toBe(60_000);
  expect(getKqCryptoRefreshDelayMs(null, now)).toBe(60_000);
 });
});
