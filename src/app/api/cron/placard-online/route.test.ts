import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, rpc } = vi.hoisted(() => ({ createClient: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: createClient }));
import { GET } from "./route";

const request = (authorization = "Bearer test-cron-secret") => new Request("https://example.test/api/cron/placard-online?limit=1000&userId=forged", { headers: { authorization } });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "test-cron-secret");
  createClient.mockReturnValue({ rpc });
  rpc.mockResolvedValue({ data: { processedUsers: 12, failedUsers: 0, deferredUsers: 2 }, error: null });
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("hourly online commerce cron", () => {
  it.each(["", "Bearer incorrect-secret", "test-cron-secret"])("rejects an unauthenticated request before creating a privileged client (%s)", async authorization => {
    const response = await GET(request(authorization));
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(createClient).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("fails closed without a configured secret", async () => {
    vi.stubEnv("CRON_SECRET", "  ");
    expect((await GET(request("Bearer "))).status).toBe(401);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("settles a server-bounded batch and returns only aggregate counts", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "settled", processedUsers: 12, failedUsers: 0, deferredUsers: 2 });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_online_settle_due", { p_limit: 100 });
  });

  it("accepts a duplicate with no newly due accounts", async () => {
    rpc.mockResolvedValue({ data: { processedUsers: 0, failedUsers: 0, deferredUsers: 0 }, error: null });
    expect(await (await GET(request())).json()).toEqual({ status: "settled", processedUsers: 0, failedUsers: 0, deferredUsers: 0 });
  });

  it("reports isolated account failures without discarding completed counts", async () => {
    rpc.mockResolvedValue({ data: { processedUsers: 95, failedUsers: 3, deferredUsers: 2 }, error: null });
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "partial-failure", processedUsers: 95, failedUsers: 3, deferredUsers: 2 });
  });

  it.each([null, [], {}, { processedUsers: -1, failedUsers: 0, deferredUsers: 0 },
    { processedUsers: "12", failedUsers: 0, deferredUsers: 0 }, { processedUsers: 100, failedUsers: 1, deferredUsers: 0 }])("rejects malformed worker counts (%j)", async data => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    rpc.mockResolvedValue({ data, error: null });
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "failed" });
  });

  it.each(["rpc-error", "network-error"])("hides internal details on %s", async failure => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    if (failure === "rpc-error") rpc.mockResolvedValue({ data: null, error: { message: "private account detail" } });
    else rpc.mockRejectedValue(new Error("private connection detail"));
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "failed" });
    expect(console.warn).toHaveBeenCalledWith("[online:cron] settlement unavailable");
  });

  it("schedules exactly one hourly invocation", () => {
    const config = JSON.parse(readFileSync("vercel.json", "utf8"));
    expect(config.crons.filter((entry: { path: string }) => entry.path === "/api/cron/placard-online")).toEqual([
      { path: "/api/cron/placard-online", schedule: "15 * * * *" },
    ]);
  });
});
