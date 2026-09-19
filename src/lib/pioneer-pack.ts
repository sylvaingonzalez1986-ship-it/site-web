export type PioneerPackState = {
  eligible: boolean;
  claimed: boolean;
  available: boolean;
  grantedAt: string | null;
  cashCents: number;
  packCount: number;
  goldCard: { code: string; name: string; imageUrl: string | null } | null;
};
export type PioneerPackClaim = PioneerPackState & { replayed: boolean };
export const PIONEER_CARD_IMAGE = "/contest/rewards/pioneers-2026-v1.png";
