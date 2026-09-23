import { describe, expect, it } from "vitest";
import { formatKqCryptoQuantity, isKqCryptoQuoteFresh, parseKqCryptoAction, parseKqCryptoEuros } from "./kanab-quest-crypto";
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
