import { describe, expect, it } from "vitest";
import { isKqCarePurchasesPage, type KqCarePurchasesPage } from "./kanab-quest-care-purchases";

const page: KqCarePurchasesPage = { serverNow: "2026-11-08T12:00:00Z", nextCursor: null, totalPaidCents: 1200, totalCount: 1,
  items: [{ id: "purchase:00000000-0000-4000-8000-000000000001", kind: "input", productCode: "CARE-SEAWEED", quantity: 1,
    amountCents: 1200, createdAt: "2026-10-01T12:00:00Z", runId: null, areaM2: null, stageIndex: null }] };

describe("care purchase register contract", () => {
  it("accepts an old paid receipt without inventing a culture or surface", () => {
    expect(isKqCarePurchasesPage(page)).toBe(true);
    expect(isKqCarePurchasesPage({ ...page, items: [], totalCount: 0, totalPaidCents: 0 })).toBe(true);
  });
  it.each([null, {}, { ...page, items: undefined }, { ...page, totalPaidCents: 0 }, { ...page, totalCount: 0 },
    { ...page, items: [page.items[0], page.items[0]], totalCount: 2, totalPaidCents: 2400 },
    { ...page, items: [{ ...page.items[0], areaM2: 0 }] }, { ...page, items: [{ ...page.items[0], kind: "pbi" }] }])("rejects incomplete or misleading history %#", value => {
    expect(isKqCarePurchasesPage(value)).toBe(false);
  });
});
