import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultStore } from "@/data/default-store";

const mocks = vi.hoisted(() => ({ fetch: vi.fn<typeof fetch>(), resolve: vi.fn(), sync: vi.fn() }));
vi.mock("./admin", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient("https://store.test", "test-service-key", {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: mocks.fetch },
  });
  return { createSupabaseServiceClient: () => client };
});
vi.mock("./contest-backend", () => ({
  deleteContestEntry: vi.fn(), resolveContestSeason: mocks.resolve, syncContestEntriesForShopFlowers: mocks.sync,
}));
import { writeStoreToSupabase } from "./store-backend";

const season = { id: "season", isActive: true, isArchived: false };
let storedProducts: Record<string, unknown>[];
beforeEach(() => {
  vi.clearAllMocks();
  storedProducts = [];
  mocks.resolve.mockResolvedValue(season);
  mocks.sync.mockResolvedValue(undefined);
  mocks.fetch.mockImplementation(async (input, init) => {
    const table = new URL(String(input)).pathname.split("/").at(-1);
    if (init?.method === "POST" && table === "products") storedProducts = JSON.parse(String(init.body));
    return Response.json(init?.method === "GET" && table === "products" ? storedProducts : []);
  });
});

describe("shop save synchronizes Arena flowers", () => {
  const store = () => ({ ...structuredClone(defaultStore), producers: [], blog: [], products: [{
    id: "indoor-new", name: "Nouvelle Indoor", category: "fleurs" as const, cultureMode: "indoor" as const,
    price: 7, weightGrams: 1, description: "Une fleur", image: "/product_flower.jpg",
  }] });

  it("synchronizes the active catalogue after the new flower is persisted", async () => {
    mocks.sync.mockImplementation(async target => {
      expect(target).toEqual(season);
      expect(storedProducts).toEqual([expect.objectContaining({ id: "indoor-new", category: "fleurs", culture_type: "indoor" })]);
    });
    await writeStoreToSupabase(store());
    expect(mocks.sync).toHaveBeenCalledExactlyOnceWith(season);
  });

  it("reports a synchronization failure so a saved flower cannot be silently absent", async () => {
    mocks.sync.mockRejectedValue(new Error("catalogue sync unavailable"));
    await expect(writeStoreToSupabase(store())).rejects.toThrow("catalogue sync unavailable");
  });
});
