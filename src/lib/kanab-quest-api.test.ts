import { describe, expect, it, vi } from "vitest";
import { createKqScopedRequest, finalizeKqRemoteBattle, getKqRemoteActiveRun, getKqRemoteBattles, getKqRemoteFlowerRivals, getKqRemoteFlowers, lockKqRemoteBattle, playKqRemoteCard, startKqRemoteRun, swapKqRemoteHeritageCard } from "@/lib/kanab-quest-api";

describe("Kanab Quest browser API", () => {
  it("routes the same gameplay client to customer-scoped endpoints", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ activeRun: null }), {
      status: 200, headers: { "content-type": "application/json" },
    }));
    await getKqRemoteActiveRun(createKqScopedRequest("player", request));
    expect(request).toHaveBeenCalledWith("/api/arena/placard/runs", { cache: "no-store" });
  });

  it("keeps admin routing as the explicit prototype default", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ flowers: [] }), {
      status: 200, headers: { "content-type": "application/json" },
    }));
    await getKqRemoteFlowers(createKqScopedRequest("admin", request));
    expect(request).toHaveBeenCalledWith("/api/admin/placard/flowers", { cache: "no-store" });
  });

  it("starts a remote run with the selected deck", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      runId: "run-1", state: { seed: 4 }, burnReceipt: { id: "burn-1" },
    }), { status: 201, headers: { "content-type": "application/json" } }));
    const result = await startKqRemoteRun({ buddieCode: "HH2026-003", deckCodes: ["BOTTE-001", "BOTTE-017"] }, request);
    expect(result.runId).toBe("run-1");
    expect(request).toHaveBeenCalledWith("/api/admin/placard/runs", expect.objectContaining({ method: "POST" }));
  });

  it("surfaces a server burn refusal", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: "Aucune copie physique disponible.",
    }), { status: 409, headers: { "content-type": "application/json" } }));
    await expect(playKqRemoteCard("run-1", "BOTTE-017", request)).rejects.toThrow("Aucune copie");
  });

  it("loads the active run without allowing browser caching", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ activeRun: null }), {
      status: 200, headers: { "content-type": "application/json" },
    }));
    expect((await getKqRemoteActiveRun(request)).activeRun).toBeNull();
    expect(request).toHaveBeenCalledWith("/api/admin/placard/runs", { cache: "no-store" });
  });

  it("sends Main prévoyante exchange positions to the server", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      state: { heritageCode: "HERITAGE-003" }, persistedFlower: null,
    }), { status: 200, headers: { "content-type": "application/json" } }));
    await swapKqRemoteHeritageCard("run-1", 2, 1, request);
    expect(request).toHaveBeenCalledWith(
      "/api/admin/placard/runs/run-1/actions",
      expect.objectContaining({ body: JSON.stringify({ action: "heritage-swap", handIndex: 2, reserveIndex: 1 }) }),
    );
  });

  it("loads the official flower reserve without caching", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ flowers: [] }), {
      status: 200, headers: { "content-type": "application/json" },
    }));
    expect((await getKqRemoteFlowers(request)).flowers).toEqual([]);
    expect(request).toHaveBeenCalledWith("/api/admin/placard/flowers", { cache: "no-store" });
  });

  it("loads rivals and only locks a battle through an explicit POST", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ rivals: [] }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ battleId: "battle-1", seed: 4, status: "locked" }), { status: 201, headers: { "content-type": "application/json" } }));
    await getKqRemoteFlowerRivals("flower-1", request);
    await lockKqRemoteBattle("flower-1", "flower-2", request);
    expect(request.mock.calls[0][0]).toContain("/rivals");
    expect(request.mock.calls[1]).toEqual(["/api/admin/placard/battles", expect.objectContaining({ method: "POST" })]);
  });

  it("loads battles and requires a separate POST for the irreversible verdict", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ battles: [] }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ battleId: "battle-1", status: "verdict", rounds: [], winner: "player", burnedAt: "2026-07-25T10:00:00Z", rankProfile: null, replayed: true }), { status: 200, headers: { "content-type": "application/json" } }));
    await getKqRemoteBattles(request);
    const verdict = await finalizeKqRemoteBattle("battle-1", request);
    expect(request.mock.calls[0]).toEqual(["/api/admin/placard/battles", { cache: "no-store" }]);
    expect(request.mock.calls[1]).toEqual(["/api/admin/placard/battles/battle-1/verdict", { method: "POST" }]);
    expect(verdict.replayed).toBe(true);
  });
});
