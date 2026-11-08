import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), enabled: vi.fn(), offer: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/kanab-quest-player-request-access", () => ({ isKqPlayerRequestEnabled: mocks.enabled }));
vi.mock("@/lib/supabase/kanab-quest-staff-backend", () => ({ getKqStaffRehireOffer: mocks.offer }));
import { GET } from "./route";
const id = "33333333-3333-4333-8333-333333333333";
const request = (query = `?contractId=${id}`) => new Request(`http://localhost/api/arena/placard/staff/rehire${query}`);
beforeEach(() => {
  vi.clearAllMocks(); mocks.enabled.mockResolvedValue(true);
  mocks.session.mockResolvedValue({ customerId: "session-owner" });
  mocks.offer.mockResolvedValue({ employee: { id }, snapshot: { revision: 2 } });
});

describe("former employee contract offer", () => {
  it("requires game access and a session before reading a person", async () => {
    mocks.enabled.mockResolvedValue(false);
    expect((await GET(request())).status).toBe(404); expect(mocks.session).not.toHaveBeenCalled();
    mocks.enabled.mockResolvedValue(true); mocks.session.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(401); expect(mocks.offer).not.toHaveBeenCalled();
  });
  it("uses only the session owner and prevents shared caching", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("private, no-store");
    expect(mocks.offer).toHaveBeenCalledExactlyOnceWith("session-owner", id);
    expect(await response.json()).toEqual({ employee: { id }, snapshot: { revision: 2 } });
  });
  it.each(["", "?userId=forged", "?contractId=a&contractId=b", `?contractId=${id}&userId=other`])("rejects ambiguous or forged selectors %s", async query => {
    expect((await GET(request(query))).status).toBe(400); expect(mocks.offer).not.toHaveBeenCalled();
  });
  it("keeps storage errors private and offers a retry", async () => {
    mocks.offer.mockRejectedValue(new Error("[supabase:staff] private contract details"));
    const response = await GET(request());
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("private contract details");
    mocks.offer.mockRejectedValue(new Error("Ce contrat n’est plus disponible."));
    expect((await GET(request())).status).toBe(400);
  });
});
