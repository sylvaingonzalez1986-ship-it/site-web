export const KORRIGAN_ODDS = {
  loss: 8500, x5: 320, x10: 80, x50: 3, epic: 2, botte: 1000, buddie: 95,
} as const;
export const KORRIGAN_MIN_VALUE_CENTS = 10_000;

export type KorriganKind = keyof typeof KORRIGAN_ODDS;
export type KorriganReaction = "idle" | "invite" | "offer" | "loss" | "reward" | "rare";
export type KorriganDraw = {
  index: number;
  kind: KorriganKind;
  moneyCents: number;
  itemLabel?: string;
  pending?: boolean;
};
export type KorriganSession = {
  id: string;
  requestId: string;
  odds: Record<KorriganKind, number>;
  lotId: string;
  grams: number;
  valueCents: number;
  nextOfferAt: string;
  draws: KorriganDraw[];
};
export type KorriganState = {
  minimumValueCents: number;
  serverNow: string;
  isNight: boolean;
  nextOfferAt: string | null;
  lots: { id: string; label: string; availableGrams: number }[];
  quote?: { valueCents: number; eligible: boolean };
  session: KorriganSession | null;
};
