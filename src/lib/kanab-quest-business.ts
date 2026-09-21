/** Virtual game economy. One game day always lasts four real hours. */
export const KQ_GAME_DAY_MS = 4 * 60 * 60 * 1000;
export const KQ_GAME_MONTH_MS = 30 * KQ_GAME_DAY_MS;
export const KQ_SHOP_CREATION_CENTS = 100_000;
export const KQ_SHOP_MONTHLY_CENTS = 10_000;
export const KQ_LAB_ANALYSIS_CENTS = 4_500;
export const KQ_DOMICILIATION_MONTHLY_CENTS = 5_000;
export type KqDomiciliation = "home" | "external";
export const KQ_VAT_PERCENT = 20;
export const KQ_ADVERTISING = {
  flyers: { name: "Prospectus chez les commerçants", costCents: 6_000, durationDays: 10, boostPercent: 20 },
  instagram: { name: "Instagram", costCents: 15_000, durationDays: 7, boostPercent: 50 },
  radio: { name: "Radio locale", costCents: 40_000, durationDays: 5, boostPercent: 100 },
} as const;
export type KqAdvertisingKind = keyof typeof KQ_ADVERTISING;
export type KqLabInvoice = {
  id: string; runId: string; issuedAt: string; dueAt: string; amountCents: number; remainingCents: number;
};
export type KqBusinessState = {
  version: 1;
  serverNow: string;
  startedAt: string;
  domiciliation: { mode: KqDomiciliation; paidUntil: string | null; renew: boolean; active: boolean };
  shop: { name: string | null; createdAt: string | null; paidUntil: string | null; renew: boolean; active: boolean };
  advertising: null | { id: string; kind: KqAdvertisingKind; startedAt: string; endsAt: string; boostPercent: number };
  vat: { ratePercent: number; reservedCents: number; paidCents: number; salesTtcCents: number; nextSettlementAt: string };
  lab: { outstandingCents: number; overdueCents: number; invoices: KqLabInvoice[] };
  nextEventAt: string | null;
  ledger: Array<{ id: string; kind: string; amountCents: number; occurredAt: string }>;
};

export function isKqAdvertisingKind(value: unknown): value is KqAdvertisingKind {
  return typeof value === "string" && Object.hasOwn(KQ_ADVERTISING, value);
}

export function normalizeKqShopName(value: unknown): string {
  if (typeof value !== "string" || /[\p{Cc}\p{Cf}<>]/u.test(value)) throw new Error("Nom du shop invalide.");
  const name = value.normalize("NFC").trim().replace(/\s+/gu, " ");
  const length = [...name].length;
  if (length < 3 || length > 40) throw new Error("Le nom du shop doit contenir entre 3 et 40 caractères.");
  return name;
}

export function getKqBusinessClock(startedAt: string, nowMs: number) {
  const origin = Date.parse(startedAt);
  if (!Number.isFinite(origin) || !Number.isFinite(nowMs)) throw new Error("Horloge de jeu invalide.");
  const elapsedDays = Math.floor(Math.max(0, nowMs - origin) / KQ_GAME_DAY_MS);
  return {
    day: elapsedDays + 1,
    month: Math.floor(elapsedDays / 30) + 1,
    dayOfMonth: elapsedDays % 30 + 1,
    nextDayAt: new Date(origin + (elapsedDays + 1) * KQ_GAME_DAY_MS).toISOString(),
  };
}

export function isKqShopActive(business: KqBusinessState, nowMs = Date.parse(business.serverNow)) {
  return Boolean(business.shop.createdAt && business.shop.paidUntil && business.shop.active
    && Date.parse(business.shop.createdAt) <= nowMs && nowMs < Date.parse(business.shop.paidUntil));
}

export function getKqAdvertisingMultiplier(business: KqBusinessState | undefined, nowMs?: number) {
  if (!business?.advertising) return 1;
  const now = nowMs ?? Date.parse(business.serverNow);
  const ad = business.advertising;
  return isKqShopActive(business, now) && Date.parse(ad.startedAt) <= now && now < Date.parse(ad.endsAt)
    ? 1 + KQ_ADVERTISING[ad.kind].boostPercent / 100 : 1;
}

function cents(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Montant de gestion invalide.");
  return value;
}

/** Cumulative TTC / 6, including across monthly remittances and sales channels. */
export function getKqSaleVatCents(payoutCents: number, previousSalesTtcCents: number) {
  cents(payoutCents); cents(previousSalesTtcCents);
  cents(payoutCents + previousSalesTtcCents);
  return Math.round((previousSalesTtcCents + payoutCents) / 6) - Math.round(previousSalesTtcCents / 6);
}

export function previewKqBusinessPayment(payoutCents: number, business: KqBusinessState, electricityOutstandingCents: number) {
  const vatCents = getKqSaleVatCents(payoutCents, business.vat.salesTtcCents);
  const afterVat = payoutCents - vatCents;
  const collectionBudget = Math.floor(afterVat / 2);
  const labPaidCents = Math.min(cents(business.lab.overdueCents), collectionBudget);
  const electricityPaidCents = Math.min(cents(electricityOutstandingCents), collectionBudget - labPaidCents);
  return { vatCents, labPaidCents, electricityPaidCents,
    netPayoutCents: afterVat - labPaidCents - electricityPaidCents,
    electricityRemainingCents: electricityOutstandingCents - electricityPaidCents };
}

/** Synthetic data for the isolated guided trial; never a player account. */
export function createKqBusinessPreview(nowMs: number): KqBusinessState {
  const now = new Date(nowMs).toISOString();
  return {
    version: 1, serverNow: now, startedAt: now,
    domiciliation: { mode: "home", paidUntil: null, renew: false, active: false },
    shop: { name: null, createdAt: null, paidUntil: null, renew: false, active: false },
    advertising: null,
    vat: { ratePercent: KQ_VAT_PERCENT, reservedCents: 0, paidCents: 0, salesTtcCents: 0,
      nextSettlementAt: new Date(nowMs + KQ_GAME_MONTH_MS).toISOString() },
    lab: { outstandingCents: 0, overdueCents: 0, invoices: [] },
    nextEventAt: new Date(nowMs + KQ_GAME_MONTH_MS).toISOString(), ledger: [],
  };
}
