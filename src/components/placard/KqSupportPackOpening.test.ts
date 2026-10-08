import { describe, expect, it, vi } from "vitest";
import { createDiscoveryTransport } from "@/lib/arena-playable-discovery";
import { requestKqSupportPackOpening } from "./KqSupportPackOpening";

const cards = [{ code: "SUP-001", name: "Carte reçue", rarity: "common", imageUrl: null }];

describe("direct mission pack opening", () => {
  it("uses only the injected authenticated opening endpoint and entitlement identifier", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ cards }));
    const globalFetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Real network forbidden"));
    try {
      expect(await requestKqSupportPackOpening(request, "earned-pack")).toEqual([{ code: "SUP-001", name: "Carte reçue", rarity: "common" }]);
      expect(request).toHaveBeenCalledExactlyOnceWith("/api/arena/placard/boosters", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entitlementId: "earned-pack" }), signal: expect.any(AbortSignal),
      });
      expect(globalFetch).not.toHaveBeenCalled();
    } finally { globalFetch.mockRestore(); }
  });

  it("keeps server refusals as failures and never draws replacement cards or retries automatically", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ error: "Ce booster n’est plus disponible." }, { status: 400 }));
    await expect(requestKqSupportPackOpening(request, "already-opened-or-unowned-pack")).rejects.toThrow("Ce booster n’est plus disponible.");
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("does not report an unconfirmed or empty draw as a successful reward", async () => {
    for (const payload of [null, {}, { cards: [] }, { cards: [{ code: "missing-name" }] }]) {
      const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(payload));
      await expect(requestKqSupportPackOpening(request, "earned-pack")).rejects.toThrow("L’ouverture n’a pas pu être confirmée");
      expect(request).toHaveBeenCalledTimes(1);
    }
  });

  it("opens the locally claimed tutorial mission directly once, without the shop or any live request", async () => {
    const sandbox = createDiscoveryTransport("missions");
    const request = vi.fn(sandbox.request);
    const globalFetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Real network forbidden"));
    try {
      const receipt = await (await request("/api/arena/placard/missions", { method: "POST", body: JSON.stringify({ code: "first-harvest" }) })).json();
      const opened = await requestKqSupportPackOpening(request, receipt.entitlementId);
      expect(opened).toHaveLength(3);
      expect(sandbox.progress().complete).toBe(true);
      const snapshot = await (await request("/api/arena/placard/missions")).json();
      expect(snapshot.missions[0]).toMatchObject({ claimed: true, packAvailable: false });
      await expect(requestKqSupportPackOpening(request, receipt.entitlementId)).rejects.toThrow();
      expect(request.mock.calls.filter(([url, init]) => url === "/api/arena/placard/boosters" && init?.method === "GET")).toHaveLength(0);
      expect(globalFetch).not.toHaveBeenCalled();
    } finally { globalFetch.mockRestore(); }
  });
});
