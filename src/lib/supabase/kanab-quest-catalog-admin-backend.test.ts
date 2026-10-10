import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ single: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseServiceClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ like: () => ({ single: mocks.single }) }) }) }),
    rpc: mocks.rpc,
  }),
}));
import { updateKqBotteCard } from "./kanab-quest-catalog-admin-backend";

const input = {
  cardId: "88888888-8888-4888-8888-888888888888", name: "Texte corrigé", rarity: "epic",
  description: "Description corrigée", imageUrl: "/card.webp", isActive: true,
  advantage: "Avantage corrigé", drawback: "Limite conservée",
};

describe("Botte editorial rarity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.single.mockResolvedValue({ data: { id: input.cardId, code: "BOTTE-039" }, error: null });
    mocks.rpc.mockResolvedValue({ error: null });
  });

  it("rejects an epic downgraded to common before sending a mutation", async () => {
    await expect(updateKqBotteCard({ ...input, rarity: "common" })).rejects.toThrow("rareté officielle");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects a common promoted to epic before sending a mutation", async () => {
    mocks.single.mockResolvedValue({ data: { id: input.cardId, code: "BOTTE-037" }, error: null });
    await expect(updateKqBotteCard(input)).rejects.toThrow("rareté officielle");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("allows editorial changes at the official rarity", async () => {
    await expect(updateKqBotteCard(input)).resolves.toEqual({ saved: true });
    expect(mocks.rpc).toHaveBeenCalledWith("rpc_kq_update_botte_card_editorial", expect.objectContaining({
      p_card_id: input.cardId, p_rarity: "epic", p_name: input.name, p_description: input.description,
    }));
  });

  it("keeps uncommon-to-silver mapping and refuses archived PBI reactivation", async () => {
    mocks.single.mockResolvedValue({ data: { id: input.cardId, code: "BOTTE-002" }, error: null });
    await expect(updateKqBotteCard({ ...input, rarity: "silver", isActive: false })).resolves.toEqual({ saved: true });
    mocks.rpc.mockClear();
    await expect(updateKqBotteCard({ ...input, rarity: "silver" })).rejects.toThrow("archivée");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
