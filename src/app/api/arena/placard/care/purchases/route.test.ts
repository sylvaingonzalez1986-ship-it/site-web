import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), enabled: vi.fn(), register: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/kanab-quest-player-request-access", () => ({ isKqPlayerRequestEnabled: mocks.enabled }));
vi.mock("@/lib/supabase/kanab-quest-care-backend", () => ({ getKqCarePurchaseRegister: mocks.register }));
import { GET } from "./route";

describe("private care purchase register", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.enabled.mockResolvedValue(true); mocks.session.mockResolvedValue({ customerId: "owner" }); mocks.register.mockResolvedValue({ items: [], totalPaidCents: 0, totalCount: 0, nextCursor: null }); });
  it("requires player access and session before loading any receipt", async () => {
    mocks.enabled.mockResolvedValue(false);
    expect((await GET(new Request("http://localhost/api/arena/placard/care/purchases"))).status).toBe(404);
    expect(mocks.session).not.toHaveBeenCalled();
    mocks.enabled.mockResolvedValue(true); mocks.session.mockResolvedValue(null);
    expect((await GET(new Request("http://localhost/api/arena/placard/care/purchases"))).status).toBe(401);
    expect(mocks.register).not.toHaveBeenCalled();
  });
  it("uses session owner, passes cursor and disables shared caching", async () => {
    const response = await GET(new Request("http://localhost/api/arena/placard/care/purchases?userId=forged&before=cursor"));
    expect(mocks.register).toHaveBeenCalledWith("owner", "cursor");
    expect(response.headers.get("cache-control")).toContain("private, no-store");
  });
  it("does not expose database errors or replace unavailable history with zeros", async () => {
    mocks.register.mockRejectedValue(new Error("[supabase:register] sensitive"));
    const response = await GET(new Request("http://localhost/api/arena/placard/care/purchases"));
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ error: "Registre momentanément indisponible." });
  });
});
