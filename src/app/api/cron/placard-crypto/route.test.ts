import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("@/lib/supabase/kanab-quest-crypto-backend", () => ({ refreshKqCryptoQuotes: refresh }));
import { GET } from "./route";

const request = (authorization = "Bearer test-cron-secret") => new Request("https://example.test/api/cron/placard-crypto", { headers: { authorization } });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-05T17:00:00Z"));
  vi.stubEnv("CRON_SECRET", "test-cron-secret");
  refresh.mockReset().mockResolvedValue("updated");
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("daily crypto cron", () => {
  it.each(["", "Bearer incorrect-secret", "test-cron-secret"])("rejects unauthenticated requests (%s) before touching the cache", async authorization => {
    expect((await GET(request(authorization))).status).toBe(401);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("fails closed if the deployment secret is missing", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(request("Bearer "))).status).toBe(401);
    expect(refresh).not.toHaveBeenCalled();
  });

  it.each([
    "2026-07-05T17:00:00Z", "2026-12-05T18:00:00Z",
    "2026-03-29T17:00:00Z", "2026-10-25T18:00:00Z",
    "2026-10-05T17:59:59Z",
  ])("runs at 19h in Paris including DST and delayed invocations (%s)", async at => {
    vi.setSystemTime(new Date(at));
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "updated" });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it.each([
    "2026-07-05T18:00:00Z", "2026-07-05T19:00:00Z", "2026-07-05T20:00:00Z",
    "2026-12-05T19:00:00Z", "2026-12-05T20:00:00Z", "2026-12-05T21:00:00Z",
    "2026-07-05T20:59:59Z", "2026-12-05T21:59:59Z",
  ])("allows bounded recovery at 20h, 21h or 22h in Paris (%s)", async at => {
    vi.setSystemTime(new Date(at));
    expect(await (await GET(request())).json()).toEqual({ status: "updated" });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it.each([
    "2026-12-05T17:00:00Z", "2026-10-05T16:59:59Z",
    "2026-07-05T21:00:00Z", "2026-12-05T22:00:00Z", "2026-07-06T00:00:00Z",
  ])("skips invocations before 19h or after 22h Paris (%s)", async at => {
    vi.setSystemTime(new Date(at));
    expect(await (await GET(request())).json()).toEqual({ status: "skipped", reason: "outside_daily_window" });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("accepts a duplicate invocation without claiming another publication", async () => {
    refresh.mockResolvedValue("skipped");
    expect(await (await GET(request())).json()).toEqual({ status: "skipped" });
  });

  it("recovers after a failed daily attempt and skips the remaining successful-day invocations", async () => {
    refresh.mockReset()
      .mockResolvedValueOnce("failed")
      .mockResolvedValueOnce("updated")
      .mockResolvedValue("skipped");
    for (const [at, status, httpStatus] of [
      ["2026-07-05T17:00:00Z", "failed", 503],
      ["2026-07-05T18:00:00Z", "updated", 200],
      ["2026-07-05T19:00:00Z", "skipped", 200],
      ["2026-07-05T20:00:00Z", "skipped", 200],
    ] as const) {
      vi.setSystemTime(new Date(at));
      const response = await GET(request());
      expect(response.status).toBe(httpStatus);
      expect(await response.json()).toEqual({ status });
    }
    expect(refresh).toHaveBeenCalledTimes(4);
  });

  it("reports provider or publication failure to the scheduler", async () => {
    refresh.mockResolvedValue("failed");
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "failed" });
  });

  it("hides database details on a failed refresh", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    refresh.mockRejectedValue(new Error("private database detail"));
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "failed" });
    expect(console.warn).toHaveBeenCalledWith("[crypto:cron] refresh unavailable");
  });

  it("deploys daily UTC collection and recovery schedules for the authenticated route", () => {
    const config = JSON.parse(readFileSync("vercel.json", "utf8"));
    expect(config.crons).toEqual([
      { path: "/api/cron/placard-crypto", schedule: "0 17 * * *" },
      { path: "/api/cron/placard-crypto", schedule: "0 18 * * *" },
      { path: "/api/cron/placard-crypto", schedule: "0 19 * * *" },
      { path: "/api/cron/placard-crypto", schedule: "0 20 * * *" },
    ]);
  });
});
