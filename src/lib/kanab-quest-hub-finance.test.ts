import { describe, expect, it, vi } from "vitest";
import { getKqHubFinanceAttention } from "./kanab-quest-hub-finance";

const now = "2026-10-29T12:00:00.000Z";
const at = (hours: number) => new Date(Date.parse(now) + hours * 3_600_000).toISOString();
const invoice = (id: string, hours: number, remainingCents = 4_500) => ({ id, dueAt: at(hours), remainingCents, amountCents: 4_500 });
function category(...invoices: ReturnType<typeof invoice>[]) {
  return { invoices, outstandingCents: invoices.reduce((sum, row) => sum + row.remainingCents, 0), overdueCents: invoices.filter(row => Date.parse(row.dueAt) <= Date.parse(now)).reduce((sum, row) => sum + row.remainingCents, 0) };
}
const snapshot = (lab = category(), suppliers = category()) => ({ cashCents: 1_000_000, business: { serverNow: now, lab, suppliers } });

describe("Quartier financial attention", () => {
  it("keeps absent or invalid readings unknown, including the server clock", () => {
    for (const payload of [null, undefined, [], {}, { business: null }, { business: { ...snapshot().business, serverNow: "unknown" } }, { business: { ...snapshot().business, serverNow: "2026-10-29T12:00:00" } }]) {
      expect(getKqHubFinanceAttention(payload)).toEqual({ notice: null, complete: false });
    }
  });
  it("returns a confirmed quiet state only when both invoice categories are complete", () => {
    expect(getKqHubFinanceAttention(snapshot())).toEqual({ notice: null, complete: true });
    expect(getKqHubFinanceAttention({ business: { serverNow: now, lab: category() } })).toEqual({ notice: null, complete: false });
  });
  it("puts the oldest unpaid due invoice before an upcoming invoice in the other category", () => {
    const data = snapshot(category(invoice("analysis", 1)), category(invoice("oldest", -3, 7_580), invoice("newer", -1, 2_000)));
    const result = getKqHubFinanceAttention(data);
    expect(result).toMatchObject({ complete: true, notice: { id: "invoice-overdue", severity: "urgent", buttonLabel: "Voir mes factures", destination: "treasury", options: { treasuryPole: "accounting" } } });
    expect(result.notice?.description).toContain("Fournisseur : 75,80");
    expect(result.notice?.description).toContain("10:00");
    expect(result.notice?.description).not.toContain("95,80");
  });
  it("uses the remaining amount of a partially paid invoice, not its initial face value", () => {
    const result = getKqHubFinanceAttention(snapshot(category(invoice("partial", -1, 1_275))));
    expect(result.notice?.description).toContain("Laboratoire : 12,75");
    expect(result.notice?.description).not.toContain("45");
  });
  it("treats the exact server due instant as reached", () => {
    expect(getKqHubFinanceAttention(snapshot(category(invoice("now", 0)))).notice?.id).toBe("invoice-overdue");
  });
  it("includes an invoice exactly 24 real hours away but excludes the following millisecond", () => {
    expect(getKqHubFinanceAttention(snapshot(category(invoice("in-24h", 24)))).notice).toMatchObject({ id: "invoice-upcoming", severity: "upcoming" });
    expect(getKqHubFinanceAttention(snapshot(category(invoice("later", 24 + 1 / 3_600_000))))).toEqual({ notice: null, complete: true });
  });
  it("selects the nearest dated upcoming invoice across both categories", () => {
    const result = getKqHubFinanceAttention(snapshot(category(invoice("lab", 18)), category(invoice("supplier", 2, 3_700))));
    expect(result.notice?.description).toContain("Fournisseur : 37");
    expect(result.notice?.description).toContain("15:00");
  });
  it("ignores paid invoices even when their old due date is earlier", () => {
    const result = getKqHubFinanceAttention(snapshot(category(invoice("paid", -48, 0), invoice("open", 8, 2_300))));
    expect(result.notice?.id).toBe("invoice-upcoming");
    expect(result.notice?.description).toContain("23");
  });
  it("retains a known laboratory alert with an absent supplier category and never claims a global total", () => {
    const result = getKqHubFinanceAttention({ business: { serverNow: now, lab: category(invoice("lab", -1, 1_900)) } });
    expect(result).toMatchObject({ complete: false, notice: { id: "invoice-overdue" } });
    expect(result.notice?.description).toContain("Laboratoire : 19");
    expect(result.notice?.description).not.toMatch(/total|tout régler|trésorerie|couvert/i);
  });
  it("isolates an inconsistent category while retaining the other category's proven invoice", () => {
    const data = snapshot(category(invoice("broken", -2)), category(invoice("valid", -1, 2_900)));
    data.business.lab.overdueCents = 0;
    expect(getKqHubFinanceAttention(data)).toMatchObject({ complete: false, notice: { id: "invoice-overdue", summary: expect.stringContaining("fournisseur : 29") } });
  });
  it("does not turn malformed amounts, duplicate IDs or a truncated category into zero debt", () => {
    for (const malformed of [
      { ...category(invoice("negative", -1)), invoices: [{ ...invoice("negative", -1), remainingCents: -1 }] },
      { ...category(invoice("nan", -1)), invoices: [{ ...invoice("nan", -1), remainingCents: NaN }] },
      category(invoice("duplicate", -1), invoice("duplicate", -2)),
      { ...category(invoice("truncated", -1)), invoices: [] },
      { ...category(invoice("bad-date", -1)), invoices: [{ ...invoice("bad-date", -1), dueAt: "not a date" }] },
    ]) expect(getKqHubFinanceAttention({ business: { serverNow: now, lab: malformed, suppliers: category() } })).toEqual({ notice: null, complete: false });
  });
  it("does not invent invoice due dates from energy, climate accruals, VAT or subscription events", () => {
    const data = { ...snapshot(), electricityOutstandingCents: 9_000, business: { ...snapshot().business, storageClimate: { outstandingCents: 7_000, nextBillingAt: at(1) }, vat: { reservedCents: 100_000, nextSettlementAt: at(1) }, nextEventAt: at(1) } };
    expect(getKqHubFinanceAttention(data)).toEqual({ notice: null, complete: true });
  });
  it("does not use the device clock or wallet to infer urgency or promise coverage, and never mutates data", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2040-01-01T00:00:00Z"));
      const data = snapshot(category(invoice("future", 25)));
      const original = structuredClone(data);
      expect(getKqHubFinanceAttention(data)).toEqual({ notice: null, complete: true });
      expect(data).toEqual(original);
      const unpaid = snapshot(category(invoice("due", -1)));
      expect(getKqHubFinanceAttention({ ...unpaid, cashCents: 0 })).toEqual(getKqHubFinanceAttention({ ...unpaid, cashCents: 99_000_000 }));
    } finally { vi.useRealTimers(); }
  });
});
