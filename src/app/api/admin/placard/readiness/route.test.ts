import { beforeEach, describe, expect, it, vi } from "vitest";

const { getValidatedAdminContext, getKqAdminLaunchReadiness } = vi.hoisted(() => ({
  getValidatedAdminContext: vi.fn(),
  getKqAdminLaunchReadiness: vi.fn(),
}));

vi.mock("@/lib/admin-guard", () => ({ getValidatedAdminContext }));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({ getKqAdminLaunchReadiness }));

import { GET } from "@/app/api/admin/placard/readiness/route";

describe("GET /api/admin/placard/readiness", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses unauthenticated access", async () => {
    getValidatedAdminContext.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it("returns a private read-only launch report", async () => {
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    getKqAdminLaunchReadiness.mockResolvedValue({ readyForActivation: false, safelyDormant: true, checks: [] });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
