import { describe, expect, it, vi } from "vitest";
const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("./server", () => ({ createSupabaseServerClient: async () => ({ auth: { getSession } }) }));
import { getArenaBetaConnectionKey } from "./arena-beta-connection";
const owner = "11111111-1111-4111-8111-111111111111";
const session = "22222222-2222-4222-8222-222222222222";
const token = (claims: unknown) => `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
function setSession(claims: unknown, user = owner) { getSession.mockResolvedValue({ data: { session: { user: { id: user }, access_token: token(claims) } }, error: null }); }
describe("beta connection presentation key", () => {
  it("survives token refresh, changes on sign-in, and reveals neither token nor raw session", async () => {
    setSession({ sub: owner, session_id: session, iat: 100 });
    const first = await getArenaBetaConnectionKey(owner);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toContain(session);
    setSession({ sub: owner, session_id: session, iat: 200 });
    expect(await getArenaBetaConnectionKey(owner)).toBe(first);
    setSession({ sub: owner, session_id: "33333333-3333-4333-8333-333333333333", iat: 200 });
    expect(await getArenaBetaConnectionKey(owner)).not.toBe(first);
  });
  it("does not use a different account's or malformed cached claims", async () => {
    setSession({ sub: owner, session_id: session }, "other"); expect(await getArenaBetaConnectionKey(owner)).toBeNull();
    setSession({ sub: "other", session_id: session }); expect(await getArenaBetaConnectionKey(owner)).toBeNull();
    setSession({ sub: owner }); expect(await getArenaBetaConnectionKey(owner)).toBeNull();
    getSession.mockRejectedValue(new Error("unavailable")); expect(await getArenaBetaConnectionKey(owner)).toBeNull();
  });
});
