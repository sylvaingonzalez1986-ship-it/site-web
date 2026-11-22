import { describe, expect, it } from "vitest";
import { readKqEarlierVisit } from "./kanab-quest-last-visit";
import { getKqHubFinanceAttention } from "./kanab-quest-hub-finance";

const start = { at: "2026-11-22T10:00:00Z", cashCents: 21326, readyLotCount: 0 };
const dueAt = "2026-11-27T10:00:00Z";
const clean = { invoices: [], outstandingCents: 0, overdueCents: 0 };
describe("retour de partie", () => {
  it.each([["2026-11-23T10:00:00Z", 0, null], ["2026-11-29T10:00:00Z", 2360, "invoice-overdue"]])(
    "uses the same stored visit and the due amount settled by the server at %s", (at, overdueCents, expected) => {
      expect(readKqEarlierVisit(JSON.stringify(start), { ...start, at: String(at) })).toEqual(start);
      const finance = getKqHubFinanceAttention({ business: { serverNow: at, lab: clean,
        suppliers: { invoices: [{ id: "first-supplies", remainingCents: 2360, dueAt }], outstandingCents: 2360, overdueCents } } });
      expect(finance.complete).toBe(true);
      expect(finance.notice?.id ?? null).toBe(expected);
      if (expected) expect(finance.notice?.options).toEqual({ staffSection: "accounting" });
    });
  it("leaves an absent, malformed, future or same-visit checkpoint unknown", () => {
    for (const raw of [null, "{}", "invalid", JSON.stringify(start), JSON.stringify({ ...start, at: "2027-01-01T10:00:00Z" })])
      expect(readKqEarlierVisit(raw, start)).toBeNull();
  });
});
