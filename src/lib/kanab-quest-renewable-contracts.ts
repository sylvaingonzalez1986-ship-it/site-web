/** Wording lives in the client; thresholds and prizes always come from the server. */
export const KQ_RENEWABLE_CONTRACTS = {
  "steady-hand": { title: "Le juste geste", approach: "Économise tes cartes", hint: "Choisis les étapes où une carte peut vraiment faire la différence." },
  "pure-grower": { title: "Au naturel", approach: "Fais confiance à ta culture", hint: "Joue sans carte Botte. Le sol vivant et l’Héritage restent autorisés." },
  "fine-flower": { title: "La belle signature", approach: "Vise la Qualité", hint: "Ton deck reste libre : prépare une récolte qui se distingue." },
} as const;

export type KqRenewableCode = keyof typeof KQ_RENEWABLE_CONTRACTS;
export type KqRenewableOffer = {
  code: KqRenewableCode;
  minimumQuality: number;
  maxCardsUsed: number | null;
  rewardCents: number;
};
export type KqRenewableStatus = "accepted" | "active" | "succeeded" | "failed" | "claimed" | "cancelled";
export type KqRenewableAttempt = KqRenewableOffer & {
  id: string;
  status: KqRenewableStatus;
  runId: string | null;
  quality: number | null;
  cardsUsed: number | null;
  reason: string | null;
  /** Historical balance immediately after this prize, never a live balance. */
  cashAfterCents?: number;
};
export type KqContractBoard = {
  version: 2;
  unlocked: boolean;
  canAccept: boolean;
  reason: string | null;
  offers: KqRenewableOffer[];
  current: KqRenewableAttempt | null;
  completedCount: number;
};
export type KqRenewableCommand =
  | { action: "accept"; code: KqRenewableCode; attemptId: string }
  | { action: "claim" | "cancel"; attemptId: string };
export type KqContractBoardResult = { board: KqContractBoard; receipt: KqRenewableAttempt | null; replayed: boolean };

const record = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const int32 = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= -2147483648 && value <= 2147483647;
const nonnegative = (value: unknown): value is number => int32(value) && value >= 0;
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const code = (value: unknown): value is KqRenewableCode => typeof value === "string" && Object.hasOwn(KQ_RENEWABLE_CONTRACTS, value);
const nullableText = (value: unknown) => value === null || typeof value === "string";

function parseOffer(value: unknown): KqRenewableOffer | null {
  const item = record(value);
  if (!item || !code(item.code) || !nonnegative(item.minimumQuality) || !nonnegative(item.rewardCents) || item.rewardCents === 0
    || !(item.maxCardsUsed === null || nonnegative(item.maxCardsUsed))) return null;
  return { code: item.code, minimumQuality: item.minimumQuality, maxCardsUsed: item.maxCardsUsed as number | null, rewardCents: item.rewardCents };
}

export function parseKqRenewableAttempt(value: unknown): KqRenewableAttempt | null {
  const item = record(value), offer = parseOffer(value);
  if (!item || !offer || !uuid(item.id) || !["accepted", "active", "succeeded", "failed", "claimed", "cancelled"].includes(item.status as string)
    || !(item.runId === null || uuid(item.runId)) || !(item.quality === null || int32(item.quality))
    || !(item.cardsUsed === null || nonnegative(item.cardsUsed)) || !nullableText(item.reason)
    || (item.cashAfterCents !== undefined && (!nonnegative(item.cashAfterCents) || item.status !== "claimed"))) return null;
  if (item.status === "accepted" || item.status === "cancelled") {
    if (item.runId !== null || item.quality !== null || item.cardsUsed !== null) return null;
  } else if (item.runId === null) return null;
  if ((item.status === "succeeded" || item.status === "claimed")
    && (!int32(item.quality) || item.quality < offer.minimumQuality || !nonnegative(item.cardsUsed)
      || (offer.maxCardsUsed !== null && item.cardsUsed > offer.maxCardsUsed))) return null;
  return {
    ...offer, id: item.id, status: item.status as KqRenewableStatus, runId: item.runId as string | null,
    quality: item.quality as number | null, cardsUsed: item.cardsUsed as number | null, reason: item.reason as string | null,
    ...(item.cashAfterCents !== undefined ? { cashAfterCents: item.cashAfterCents as number } : {}),
  };
}

export function parseKqContractBoard(value: unknown): KqContractBoard | null {
  const item = record(value);
  if (!item || item.version !== 2 || typeof item.unlocked !== "boolean" || typeof item.canAccept !== "boolean"
    || !nullableText(item.reason) || !nonnegative(item.completedCount) || !Array.isArray(item.offers)) return null;
  const offers = item.offers.map(parseOffer);
  if (offers.length !== 3 || offers.some(offer => !offer) || new Set(offers.map(offer => offer?.code)).size !== 3) return null;
  const current = item.current === null ? null : parseKqRenewableAttempt(item.current);
  if (item.current !== null && !current) return null;
  if (!item.unlocked && (item.canAccept || current !== null || item.completedCount > 0)) return null;
  if (item.canAccept && current && !["claimed", "failed", "cancelled"].includes(current.status)) return null;
  if (current?.status === "claimed" && item.completedCount < 1) return null;
  return {
    version: 2, unlocked: item.unlocked, canAccept: item.canAccept, reason: item.reason as string | null,
    offers: offers as KqRenewableOffer[], current, completedCount: item.completedCount,
  };
}

export function parseKqRenewableCommand(value: unknown): KqRenewableCommand | null {
  const item = record(value);
  if (!item || !uuid(item.attemptId)) return null;
  if (item.action === "accept" && code(item.code) && Object.keys(item).every(key => ["action", "code", "attemptId"].includes(key))) {
    return { action: "accept", code: item.code, attemptId: item.attemptId };
  }
  if ((item.action === "claim" || item.action === "cancel") && Object.keys(item).every(key => ["action", "attemptId"].includes(key))) {
    return { action: item.action, attemptId: item.attemptId };
  }
  return null;
}

export function parseKqContractBoardResult(value: unknown): KqContractBoardResult | null {
  const item = record(value);
  if (!item || typeof item.replayed !== "boolean") return null;
  const board = parseKqContractBoard(item.board);
  const receipt = item.receipt === null ? null : parseKqRenewableAttempt(item.receipt);
  if (!board || (item.receipt !== null && (!receipt || receipt.status !== "claimed" || receipt.cashAfterCents === undefined))) return null;
  if (receipt && (!board.unlocked || board.completedCount < 1)) return null;
  return { board, receipt, replayed: item.replayed };
}
