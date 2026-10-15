export type PioneerPackState = {
  eligible: boolean;
  claimed: boolean;
  available: boolean;
  grantedAt: string | null;
  cashCents: number;
  packCount: number;
  goldCard: { code: string; name: string; imageUrl: string | null; rarity?: "gold" | "epic" } | null;
};
export type PioneerPackClaim = PioneerPackState & { replayed: boolean };
export const PIONEER_CARD_IMAGE = "/contest/rewards/pioneers-2026-v1.png";

/** The gift is available before the Arena opens, at midnight in Paris. */
export const PIONEER_PACK_OPENING_AT = "2026-10-30T00:00:00+01:00";
export const PIONEER_PACK_OPENING_MESSAGE = "Rendez-vous le 30 octobre";

export function isPioneerPackPrelaunch(now = Date.now()): boolean {
  return process.env.NODE_ENV === "production" && now < Date.parse(PIONEER_PACK_OPENING_AT);
}
