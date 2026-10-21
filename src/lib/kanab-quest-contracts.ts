export const KQ_LIGHT_HAND_CONTRACT = {
  code: "light-hand", title: "Main légère", minimumQuality: 8, maxCardsUsed: 2, rewardCents: 3000,
} as const;

export type KqContractAction = "accept" | "cancel" | "claim";
export type KqContractStatus = "available" | "accepted" | "active" | "succeeded" | "failed" | "claimed";
export type KqContractSnapshot = {
  code: typeof KQ_LIGHT_HAND_CONTRACT.code;
  status: KqContractStatus;
  runId: string | null;
  quality: number | null;
  cardsUsed: number | null;
  rewardCents: typeof KQ_LIGHT_HAND_CONTRACT.rewardCents;
  canAccept: boolean;
  reason: string | null;
  /** Balance immediately after the one-time reward, never a current balance. */
  cashAfterCents?: number;
  replayed?: boolean;
};
export type KqContractProgress = Pick<KqContractSnapshot, "quality" | "cardsUsed">;

const statuses: readonly KqContractStatus[] = ["available", "accepted", "active", "succeeded", "failed", "claimed"];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const record = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const integer = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value);
const qualityInteger = (value: unknown): value is number => integer(value) && value >= -2147483648 && value <= 2147483647;

/** Actual saved culture data only. Missing metrics stay unknown, including an
 * absent usedCards array; a deck is not evidence that a card was played. */
export function readKqContractProgress(value: unknown, memberStates: readonly unknown[] = []): KqContractProgress {
  const state = record(value);
  const states = [state, ...memberStates.map(record)];
  const qualities = states.flatMap(item => item && qualityInteger(item.quality) ? [item.quality] : []);
  const cards = state?.usedCards;
  return {
    quality: qualities.length ? Math.max(...qualities) : null,
    cardsUsed: Array.isArray(cards) && cards.every(code => typeof code === "string" && /^BOTTE-\d{3}$/.test(code)) ? cards.length : null,
  };
}

/** Fail closed at the API boundary. These metrics do not let the browser infer
 * a win: only the server's status can make the reward claimable. */
export function parseKqContractSnapshot(value: unknown): KqContractSnapshot | null {
  const item = record(value);
  if (!item || item.code !== KQ_LIGHT_HAND_CONTRACT.code || !statuses.includes(item.status as KqContractStatus)
    || item.rewardCents !== KQ_LIGHT_HAND_CONTRACT.rewardCents || typeof item.canAccept !== "boolean"
    || !(item.runId === null || typeof item.runId === "string" && uuid.test(item.runId))
    || !(item.quality === null || qualityInteger(item.quality))
    || !(item.cardsUsed === null || integer(item.cardsUsed) && item.cardsUsed >= 0)
    || !(item.reason === null || typeof item.reason === "string")
    || (item.cashAfterCents !== undefined && (!integer(item.cashAfterCents) || item.cashAfterCents < 0))
    || (item.replayed !== undefined && typeof item.replayed !== "boolean")) return null;
  const status = item.status as KqContractStatus;
  if ((status === "available" || status === "accepted") && (item.runId !== null || item.quality !== null || item.cardsUsed !== null)) return null;
  if (!["available", "accepted"].includes(status) && item.runId === null) return null;
  if (item.canAccept && status !== "available" && status !== "failed") return null;
  if ((status === "succeeded" || status === "claimed") && (item.quality === null || item.cardsUsed === null
    || (item.quality as number) < KQ_LIGHT_HAND_CONTRACT.minimumQuality || (item.cardsUsed as number) > KQ_LIGHT_HAND_CONTRACT.maxCardsUsed)) return null;
  if (item.cashAfterCents !== undefined && status !== "claimed") return null;
  return {
    code: KQ_LIGHT_HAND_CONTRACT.code, status, runId: item.runId as string | null,
    quality: item.quality as number | null, cardsUsed: item.cardsUsed as number | null,
    rewardCents: KQ_LIGHT_HAND_CONTRACT.rewardCents, canAccept: item.canAccept, reason: item.reason as string | null,
    ...(item.cashAfterCents !== undefined ? { cashAfterCents: item.cashAfterCents as number } : {}),
    ...(item.replayed !== undefined ? { replayed: item.replayed as boolean } : {}),
  };
}

export function parseKqContractCommand(value: unknown): { action: KqContractAction; code: typeof KQ_LIGHT_HAND_CONTRACT.code } | null {
  const item = record(value);
  if (!item || item.code !== KQ_LIGHT_HAND_CONTRACT.code || !["accept", "cancel", "claim"].includes(item.action as string)
    || Object.keys(item).some(key => key !== "action" && key !== "code")) return null;
  return { action: item.action as KqContractAction, code: KQ_LIGHT_HAND_CONTRACT.code };
}
