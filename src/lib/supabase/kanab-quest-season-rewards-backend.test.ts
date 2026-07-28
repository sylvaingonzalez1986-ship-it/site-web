import { describe, expect, it, vi } from "vitest";
const { createSupabaseServiceClient } = vi.hoisted(() => ({ createSupabaseServiceClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient }));
import { distributeKqSeasonRewards } from "@/lib/supabase/kanab-quest-season-rewards-backend";

describe("dormant Kanab Quest season distribution", () => {
  it("returns before touching Supabase", async () => {
    await expect(distributeKqSeasonRewards("KQ-2026-S1")).resolves.toEqual({
      live: false, eligiblePlayers: 0, granted: 0, alreadyGranted: 0,
    });
    expect(createSupabaseServiceClient).not.toHaveBeenCalled();
  });
});
