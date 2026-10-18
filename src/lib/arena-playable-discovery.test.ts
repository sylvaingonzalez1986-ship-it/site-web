import { describe, expect, it, vi } from "vitest";
import { CONTEST_SCORE_CRITERIA } from "@/types/contest";
import { createDiscoveryPack, createDiscoveryTransport, DISCOVERY_NOTEBOOK_ENTRY } from "./arena-playable-discovery";
import { KQ_BUDDIES } from "./kanab-quest-game";

const post = (body: unknown) => ({ method: "POST", body: JSON.stringify(body) });
describe("isolated visual discovery lessons", () => {
  it("serves the real collections with the full Buddie catalogue and the borrowed pack only", async () => {
    const api = createDiscoveryTransport("collection"), progress = vi.fn();
    const before = await (await api.request("/api/account/collection")).json();
    expect(before.pages[0].slots).toHaveLength(KQ_BUDDIES.length);
    expect(before.pages[0].slots.every((slot: { ownedCount: number }) => slot.ownedCount === 0)).toBe(true);
    const guided = createDiscoveryTransport("collection", progress);
    await guided.request("/api/releve/collection/open", post({}));
    expect(progress).not.toHaveBeenCalled();
    const after = await (await guided.request("/api/account/collection")).json();
    expect(after.pages[0].slots.filter((slot: { ownedCount: number }) => slot.ownedCount === 1)).toHaveLength(3);
    await guided.request("/api/releve/collection/continue", post({}));
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ complete: true }));
    expect((await (await guided.request("/api/arena/placard/collection")).json()).collection.cards).toEqual([]);
    expect((await (await api.request("/api/account/collection")).json()).pages[0].slots.every((slot: { ownedCount: number }) => slot.ownedCount === 0)).toBe(true);
  });
  it("supplies three prepared Buddies without generating a real pack", () => {
    const pack = createDiscoveryPack();
    expect(pack.cards).toHaveLength(3);
    expect(new Set(pack.cards.map(card => card.code)).size).toBe(3);
    expect(pack.cards.every(card => card.id.startsWith("tutorial-") && card.imageUrl.startsWith("/"))).toBe(true);
  });
  it("requires claiming the actual mission before opening its local reward, exactly once", async () => {
    const progress = vi.fn();
    const api = createDiscoveryTransport("missions", progress);
    const snapshot = await (await api.request("/api/arena/placard/missions")).json();
    expect(snapshot.missions).toHaveLength(30);
    expect(snapshot.missions.every((mission: { target: number; reward: unknown }) => Number.isFinite(mission.target) && mission.target > 0 && mission.reward)).toBe(true);
    expect(snapshot.missions.filter((mission: { claimable: boolean }) => mission.claimable)).toEqual([expect.objectContaining({ code: "fifteen-varieties", reward: { kind: "pack", cardCount: 3 } })]);
    const open = () => api.request("/api/arena/placard/boosters", { method: "PATCH", body: JSON.stringify({ entitlementId: "tutorial-mission-pack" }) });
    expect((await open()).ok).toBe(false);
    expect(api.progress().complete).toBe(false);
    await api.request("/api/arena/placard/missions", post({ code: "fifteen-varieties" }));
    expect(api.progress().complete).toBe(false);
    const repeated = await api.request("/api/arena/placard/missions", post({ code: "fifteen-varieties" }));
    expect((await repeated.json()).replayed).toBe(true);
    expect((await (await open()).json()).cards).toHaveLength(3);
    expect(api.progress().complete).toBe(true);
    expect((await open()).ok).toBe(false);
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ complete: true }));
  });
  it("keeps the shop debit and ten-card purchased pack separate from the mission reward", async () => {
    const api = createDiscoveryTransport("missions");
    expect((await api.request("/api/arena/placard/boosters", post({ packCount: 1 }))).ok).toBe(true);
    expect((await api.request("/api/arena/placard/boosters", post({ packCount: 1 }))).ok).toBe(false);
    const shop = await (await api.request("/api/arena/placard/boosters")).json();
    expect(shop.spendablePoints).toBe(0);
    const result = await (await api.request("/api/arena/placard/boosters", { method: "PATCH", body: JSON.stringify({ entitlementId: "tutorial-purchased-pack" }) })).json();
    expect(result.cards).toHaveLength(10);
    expect(api.progress().complete).toBe(false);
  });
  it("accepts only a complete notebook form and returns an unpublished local review", async () => {
    const api = createDiscoveryTransport("notebook");
    expect((await api.request("/api/contest/reviews", post({ entryId: DISCOVERY_NOTEBOOK_ENTRY.id, scores: {} }))).ok).toBe(false);
    const response = await api.request("/api/contest/reviews", post({ entryId: DISCOVERY_NOTEBOOK_ENTRY.id, scores: Object.fromEntries(CONTEST_SCORE_CRITERIA.map(key => [key, 65])), consumptionMethod: "vaporizer", comment: "Notes fictives.", aromaTags: [] }));
    expect((await response.json()).review).toMatchObject({ id: "tutorial-review", status: "pending", comment: "Notes fictives." });
    expect(api.progress().complete).toBe(true);
  });
  it("rejects unknown or unrelated operations without ever falling back to fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network forbidden"));
    try {
      for (const lesson of ["missions", "notebook", "specialties", "collection"] as const) {
        const api = createDiscoveryTransport(lesson);
        expect((await api.request("https://example.com/api/contest/reviews", post({}))).ok).toBe(false);
        expect((await api.request("/api/arena/placard/crypto", post({}))).ok).toBe(false);
      }
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally { fetchSpy.mockRestore(); }
  });
  it("does not complete character practice until a valid profile is saved locally", async () => {
    const api = createDiscoveryTransport("specialties");
    expect((await api.request("/api/arena/chanvrier", post({ nickname: "!" }))).ok).toBe(false);
    expect(api.progress().complete).toBe(false);
    expect((await api.request("/api/arena/chanvrier", post({ nickname: "Apprenti", gender: "male", skin: "ivory", clothing: "ochre", strength: "treasurer" }))).ok).toBe(true);
    expect(api.progress().complete).toBe(true);
  });
});
