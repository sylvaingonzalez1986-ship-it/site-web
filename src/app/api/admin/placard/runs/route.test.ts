import { beforeEach, describe, expect, it, vi } from "vitest";

const { getValidatedAdminContext, getKqAdminActiveRun, startKqAdminRun } = vi.hoisted(() => ({
  getValidatedAdminContext: vi.fn(),
  getKqAdminActiveRun: vi.fn(),
  startKqAdminRun: vi.fn(),
}));

vi.mock("@/lib/admin-guard", () => ({ getValidatedAdminContext }));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({ getKqAdminActiveRun, startKqAdminRun }));

import { GET, POST } from "@/app/api/admin/placard/runs/route";

const request = (body: unknown) => new Request("http://localhost/api/admin/placard/runs", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe("POST /api/admin/placard/runs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses unauthenticated creation", async () => {
    getValidatedAdminContext.mockResolvedValue(null);
    expect((await POST(request({}))).status).toBe(401);
    expect(startKqAdminRun).not.toHaveBeenCalled();
  });

  it("creates an admin test run through the server validator", async () => {
    getValidatedAdminContext.mockResolvedValue({ customerId: "admin", email: "admin@example.test" });
    startKqAdminRun.mockResolvedValue({ runId: "run-1", state: { seed: 42 } });
    const response = await POST(request({
      buddieCode: "HH2026-003",
      deckCodes: ["BOTTE-001", "BOTTE-003"],
      cultureTokens: 2,
      heritageCode: "HERITAGE-005",
    }));
    expect(response.status).toBe(201);
    expect(startKqAdminRun).toHaveBeenCalledWith("admin@example.test", {
      buddieCode: "HH2026-003",
      deckCodes: ["BOTTE-001", "BOTTE-003"],
      cultureTokens: 2,
      heritageCode: "HERITAGE-005",
    });
  });

  it("returns the active admin run without caching", async () => {
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    getKqAdminActiveRun.mockResolvedValue({ runId: "run-1", state: { seed: 42 }, burnReceipts: [] });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(getKqAdminActiveRun).toHaveBeenCalledWith("admin@example.test");
  });
});
