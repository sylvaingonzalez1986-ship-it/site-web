export type ChanvrierSavings = {
  cashCents: number; balanceCents: number; interestCreditedCents: number;
  nextInterestAt: string | null; ratePercent: number; periodHours: number; maxBalanceCents: number; replayed: boolean;
};
export type ChanvrierSavingsCommand = { action: "deposit" | "withdraw"; amountCents: number; requestKey: string };
export function parseSavingsCommand(value: unknown): ChanvrierSavingsCommand | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if ((row.action !== "deposit" && row.action !== "withdraw") || typeof row.amountCents !== "number"
    || !Number.isSafeInteger(row.amountCents) || row.amountCents <= 0 || row.amountCents > 2_000_000_000
    || typeof row.requestKey !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.requestKey)) return null;
  return { action: row.action, amountCents: row.amountCents, requestKey: row.requestKey };
}
export function parseSavingsAmount(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return cents > 0 && cents <= 2_000_000_000 ? cents : null;
}
