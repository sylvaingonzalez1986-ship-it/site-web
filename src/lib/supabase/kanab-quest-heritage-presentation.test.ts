import { describe, expect, it, vi } from "vitest";
import { getKqPlayerHeritageSnapshot } from "@/lib/supabase/kanab-quest-backend";

const database = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: () => database }));

describe("Heritage presentation before the editorial migration", () => {
  it("reads the current hand description and stock art without changing identity, ownership or stored data", async () => {
    const row = {
      code: "HERITAGE-003", name: "Nom éditorial Terracanna", timing: "once-per-run",
      effect_code: "opening-hand-reserve", description: "Pioche 8 cartes, conserve 5 cartes.",
      image_url: "/app/kanab-quest/card-fronts/heritage-003-main-prevoyante-producer-front-v5.webp",
      is_active: true, producer_id: "producer-1773870509228-7130",
      producer_name: "Terracanna", producer_image: "/custom/producer.webp",
    };
    const rows = [
      row,
      { ...row, code: "HERITAGE-901", image_url: "/custom/heritage.webp", producer_id: "custom-producer" },
      { ...row, code: "HERITAGE-902", effect_code: "five-keep-three", description: "Texte éditorial conservé." },
    ];
    const stored = structuredClone(rows);
    const order = vi.fn().mockResolvedValue({ data: rows, error: null });
    const select = vi.fn().mockReturnValue({ order });
    database.from.mockReturnValue({ select });
    database.rpc.mockResolvedValue({ data: {
      totalPulls: 1, eligiblePurchaseUnits: 1, attributedPurchaseUnits: 1,
      ownedCounts: { "HERITAGE-003": 1 }, producerNamesByCard: {},
      fragmentBalance: 0, fragmentHistory: [], draws: [],
    }, error: null });

    const snapshot = await getKqPlayerHeritageSnapshot("11111111-1111-4111-8111-111111111111");

    expect(snapshot.cards[0]).toMatchObject({
      code: row.code, name: row.name, producerId: row.producer_id,
      producerName: row.producer_name, producerImage: row.producer_image,
      ownedCopies: 1, timing: row.timing, effectCode: row.effect_code,
      description: "+2 XP au départ. À la première étape, pioche 13 cartes et compose une main de 10.",
      imageUrl: "/app/kanab-quest/card-fronts/heritage-003-main-prevoyante-producer-front-v6.webp",
    });
    expect(snapshot.cards[1]).toMatchObject({
      description: snapshot.cards[0].description, imageUrl: "/custom/heritage.webp", ownedCopies: 0,
    });
    expect(snapshot.cards[2]).toMatchObject({
      description: "Texte éditorial conservé.", imageUrl: row.image_url,
    });
    expect(rows).toEqual(stored);
    expect(database.from).toHaveBeenCalledTimes(1);
    expect(database.from).toHaveBeenCalledWith("kq_heritage_card_definitions");
    expect(database.rpc).toHaveBeenCalledTimes(1);
    expect(database.rpc).toHaveBeenCalledWith("rpc_kq_heritage_snapshot", {
      p_user_id: "11111111-1111-4111-8111-111111111111", p_include_draws: true,
    });
  });
});
