import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const reconcile = vi.hoisted(() => vi.fn());
vi.mock("@/lib/swiss-bitcoin-pay-service", () => ({ reconcileSwissBitcoinPayments: reconcile }));

function request(authorization?: string) {
  return new Request("https://shop.example.test/api/cron/swiss-bitcoin-pay", {
    headers: authorization ? { authorization } : {},
  });
}

beforeEach(() => {
  reconcile.mockReset();
  vi.stubEnv("CRON_SECRET", "cron-secret");
  vi.stubEnv("SWISS_BITCOIN_PAY_ENABLED", "false");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Swiss Bitcoin Pay scheduled reconciliation", () => {
  it("requires the cron bearer secret before touching the queue", async () => {
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request("Bearer wrong"))).status).toBe(401);
    expect(reconcile).not.toHaveBeenCalled();
  });

  it("runs existing attempts after disabling issuance and reports individual outages", async () => {
    reconcile.mockResolvedValueOnce({ checked: 3, failed: 1, archived: 2 });
    const response = await GET(request("Bearer cron-secret"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ checked: 3, failed: 1, archived: 2 });
  });
});
