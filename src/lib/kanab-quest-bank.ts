import { KQ_GAME_DAY_MS } from "./kanab-quest-business";

/** Virtual euros only. Rates cover all seven instalments, never an annual rate. */
export const KQ_BANK_INSTALLMENT_COUNT = 7;
export const KQ_BANK_INSTALLMENT_GAME_DAYS = 30;
export const KQ_BANK_INSTALLMENT_MS = KQ_BANK_INSTALLMENT_GAME_DAYS * KQ_GAME_DAY_MS;
/** The API expresses the full loan term in real days. */
export const KQ_BANK_TERM_DAYS = KQ_BANK_INSTALLMENT_COUNT * KQ_BANK_INSTALLMENT_MS / 86_400_000;
export const KQ_BANK_MIN_CENTS = 10_000;
export const KQ_BANK_TIERS = [
  { reputation: 200, maxCents: 500_000, discountBps: 0 },
  { reputation: 600, maxCents: 2_500_000, discountBps: 50 },
  { reputation: 1500, maxCents: 10_000_000, discountBps: 100 },
  { reputation: 3000, maxCents: 25_000_000, discountBps: 150 },
] as const;
export const KQ_BANK_MAX_CENTS = KQ_BANK_TIERS[KQ_BANK_TIERS.length - 1].maxCents;
export const KQ_BANK_MAX_RATE_BPS = 1400;
export const KQ_BANK_MAX_REPAYMENT_CENTS = KQ_BANK_MAX_CENTS + Math.ceil(KQ_BANK_MAX_CENTS * KQ_BANK_MAX_RATE_BPS / 10_000);
export const KQ_BANK_SCENARIOS: Record<string, { title: string; description: string }> = {
  confidence: { title: "Vent de confiance", description: "Les banques ouvrent les vannes. Le coût des nouveaux crédits baisse." },
  competition: { title: "Guerre des guichets", description: "Les établissements se disputent les bons dossiers : les taux reculent." },
  steady: { title: "Calme au guichet", description: "Le marché reprend son souffle. Les conditions restent stables." },
  inflation: { title: "Prix sous pression", description: "La hausse des prix refroidit les prêteurs. Les nouveaux crédits coûtent plus cher." },
  tension: { title: "Coup de frein", description: "Les liquidités se raréfient. Le banquier relève ses taux." },
};
export type KqBankCommand =
  | { action: "borrow"; requestKey: string; quoteId: string; amountCents: number; expectedRateBps: number }
  | { action: "repay"; requestKey: string; loanId: string; amountCents: number };
export type KqBankLoan = {
  id: string; principalCents: number; interestCents: number; totalCents: number; paidCents: number;
  remainingCents: number; rateBps: number; acceptedAt: string; dueAt: string; paidAt: string | null;
  overdueCents: number; schedule: { at: string; amountCents: number; paidCents: number }[];
};
export type KqBankSnapshot = {
  version: 1; serverNow: string; cashCents: number; reputation: number; eligibleAt: string | null;
  market: { id: string; scenario: string; rateBps: number; changeBps: number; startsAt: string; expiresAt: string };
  offer: { quoteId: string; minCents: number; maxCents: number; rateBps: number; termDays: typeof KQ_BANK_TERM_DAYS; expiresAt: string } | null;
  blockedReason: "reputation" | "experience" | "active" | "arrears" | null;
  loan: KqBankLoan | null; history: KqBankLoan[]; autoPaidCents: number; replayed: boolean;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isKqBankUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value);
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const integer = (value: unknown, min = 0, max = 2_147_483_647): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
const date = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
export function parseKqBankCommand(value: unknown): KqBankCommand | null {
  if (!object(value) || !isKqBankUuid(value.requestKey)) return null;
  if (value.action === "borrow" && isKqBankUuid(value.quoteId) && integer(value.amountCents, KQ_BANK_MIN_CENTS, KQ_BANK_MAX_CENTS) && integer(value.expectedRateBps, 100, KQ_BANK_MAX_RATE_BPS)) {
    return { action: value.action, requestKey: value.requestKey, quoteId: value.quoteId, amountCents: value.amountCents, expectedRateBps: value.expectedRateBps };
  }
  if (value.action === "repay" && isKqBankUuid(value.loanId) && integer(value.amountCents, 1, KQ_BANK_MAX_REPAYMENT_CENTS)) {
    return { action: value.action, requestKey: value.requestKey, loanId: value.loanId, amountCents: value.amountCents };
  }
  return null;
}
/** Exact euro input for larger equipment loans; monetary arithmetic stays in integer cents. */
export function parseKqBankEuros(input: string): number | null {
  const match = /^(0|[1-9]\d{0,6}|[1-9]\d{0,2}(?:[ \u00a0\u202f]\d{3}){1,2})(?:[.,](\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;
  const cents = Number(match[1].replace(/[ \u00a0\u202f]/g, "")) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return integer(cents, KQ_BANK_MIN_CENTS, KQ_BANK_MAX_CENTS) ? cents : null;
}
export function getKqBankTerms(principalCents: number, rateBps: number) {
  if (!integer(principalCents, KQ_BANK_MIN_CENTS, KQ_BANK_MAX_CENTS) || !integer(rateBps, 100, KQ_BANK_MAX_RATE_BPS)) throw new Error("Offre de prêt invalide.");
  const interestCents = Math.ceil(principalCents * rateBps / 10_000);
  const totalCents = principalCents + interestCents;
  const installments = Array.from({ length: KQ_BANK_INSTALLMENT_COUNT }, (_, index) => Math.floor(totalCents * (index + 1) / KQ_BANK_INSTALLMENT_COUNT) - Math.floor(totalCents * index / KQ_BANK_INSTALLMENT_COUNT));
  return { interestCents, totalCents, installments };
}
function isLoan(value: unknown): value is KqBankLoan {
  if (!object(value) || !isKqBankUuid(value.id) || !integer(value.principalCents, KQ_BANK_MIN_CENTS, KQ_BANK_MAX_CENTS)
    || !integer(value.rateBps, 100, KQ_BANK_MAX_RATE_BPS) || !date(value.acceptedAt) || !date(value.dueAt)
    || !(value.paidAt === null || date(value.paidAt)) || !integer(value.interestCents) || !integer(value.totalCents)
    || !integer(value.paidCents) || !integer(value.remainingCents) || !integer(value.overdueCents)
    || value.totalCents !== value.principalCents + value.interestCents || value.remainingCents !== value.totalCents - value.paidCents
    || value.overdueCents > value.remainingCents || !Array.isArray(value.schedule) || value.schedule.length !== KQ_BANK_INSTALLMENT_COUNT) return false;
  const expected = getKqBankTerms(value.principalCents, value.rateBps);
  const acceptedAt = Date.parse(value.acceptedAt);
  // Loans already closed before the calendar migration keep their daily history.
  const first = value.schedule[0];
  const intervalMs = value.paidAt !== null && object(first) && date(first.at) && Date.parse(first.at) - acceptedAt === 86_400_000
    ? 86_400_000 : KQ_BANK_INSTALLMENT_MS;
  return value.interestCents === expected.interestCents && value.schedule.every((item, i) => object(item)
    && date(item.at) && Date.parse(item.at) === acceptedAt + (i + 1) * intervalMs
    && item.amountCents === expected.installments[i] && integer(item.paidCents, 0, expected.installments[i]))
    && Date.parse(value.dueAt) === acceptedAt + KQ_BANK_INSTALLMENT_COUNT * intervalMs
    && value.schedule.reduce((sum, item) => sum + (item as { paidCents: number }).paidCents, 0) === value.paidCents;
}
export function isKqBankSnapshot(value: unknown): value is KqBankSnapshot {
  if (!object(value) || value.version !== 1 || !date(value.serverNow) || !integer(value.cashCents) || !integer(value.reputation)
    || !(value.eligibleAt === null || date(value.eligibleAt)) || !object(value.market) || !isKqBankUuid(value.market.id)
    || typeof value.market.scenario !== "string" || !Object.hasOwn(KQ_BANK_SCENARIOS, value.market.scenario)
    || !integer(value.market.rateBps, 150, KQ_BANK_MAX_RATE_BPS) || !integer(value.market.changeBps, -1250, 1250)
    || !date(value.market.startsAt) || !date(value.market.expiresAt) || !integer(value.autoPaidCents)
    || typeof value.replayed !== "boolean" || !(value.loan === null || isLoan(value.loan))
    || !Array.isArray(value.history) || value.history.length > 3 || !value.history.every(isLoan)
    || ![null, "reputation", "experience", "active", "arrears"].includes(value.blockedReason as null)) return false;
  if (value.offer === null) return value.blockedReason !== null;
  return value.blockedReason === null && value.loan === null && object(value.offer) && value.offer.quoteId === value.market.id
    && value.offer.minCents === KQ_BANK_MIN_CENTS && integer(value.offer.maxCents, KQ_BANK_MIN_CENTS, KQ_BANK_MAX_CENTS)
    && integer(value.offer.rateBps, 100, KQ_BANK_MAX_RATE_BPS) && value.offer.termDays === KQ_BANK_TERM_DAYS && date(value.offer.expiresAt);
}
export function getKqBankerDialogue(data: KqBankSnapshot) {
  if (data.blockedReason === "arrears") return `« ${data.reputation} points de réputation, mais une échéance en retard. Régularisons ton dossier avant de parler d’un autre prêt. »`;
  if (data.blockedReason === "active") return `« Ton prêt est en cours. On garde le taux signé, quoi qu’il arrive au marché. Tu peux aussi tout rembourser maintenant. »`;
  if (data.blockedReason === "reputation") return `« ${data.reputation} points ? Fais-toi un nom, reviens à 200 et on discutera affaires. Je ne prête pas sur une poignée de main. »`;
  if (data.blockedReason === "experience") return "« La réputation est là. J’attends aussi une première culture terminée depuis au moins 24 heures. Un peu de recul, ça compte. »";
  return `« ${data.reputation} points de réputation… Voilà un dossier qui me plaît. Je peux te proposer jusqu’à ${((data.offer?.maxCents ?? 0) / 100).toLocaleString("fr-FR")} € de jeu. À toi de voir. »`;
}
