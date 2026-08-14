import { describe, expect, it } from "vitest";
import { splitShopEntitlements } from "@/components/placard/KqSupportBoosterShop";

describe("KqSupportBoosterShop", () => {
  it("reserves the left counter item for PvP duel rewards", () => {
    const entitlements = [
      { id: "duel-1", source: "pvp_win", cardCount: 3, createdAt: "2026-08-14T10:00:00Z" },
      { id: "welcome-1", source: "welcome_pack", cardCount: 10, createdAt: "2026-08-14T09:00:00Z" },
      { id: "purchase-1", source: "points_purchase", cardCount: 10, createdAt: "2026-08-14T11:00:00Z" },
      { id: "duel-2", source: "pvp_win", cardCount: 3, createdAt: "2026-08-14T12:00:00Z" },
    ];

    const result = splitShopEntitlements(entitlements);

    expect(result.duelRewards.map((item) => item.id)).toEqual(["duel-1", "duel-2"]);
    expect(result.duelRewards.every((item) => item.cardCount === 3)).toBe(true);
    expect(result.shopPacks.map((item) => item.id)).toEqual(["welcome-1", "purchase-1"]);
  });
});
