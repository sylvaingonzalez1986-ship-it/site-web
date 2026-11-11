// Audit evidence: real public handlers/serializers, fictional database and email adapters.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), limit: vi.fn(), send: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: () => ({ from: mocks.from, rpc: mocks.rpc }) }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: vi.fn() }));
vi.mock("@/lib/newsletter-email", () => ({ sendNewsletterConfirmationEmail: mocks.send }));
vi.mock("@/lib/security-rate-limit", () => ({ getRequestIp: () => "192.0.2.10", hitRateLimit: mocks.limit, logRateLimitRejection: vi.fn() }));
import { GET as comments } from "@/app/api/blog/comments/route";
import { POST as subscribe } from "@/app/api/newsletter/subscribe/route";
import { newsletterTokenHash } from "@/lib/newsletter-confirmation";
import * as confirm from "@/app/api/newsletter/confirm/route";

describe("security audit: public data and subscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", () => { throw new Error("Audit forbids network"); });
    mocks.limit.mockResolvedValue({ allowed: true });
    mocks.send.mockResolvedValue(undefined);
    mocks.rpc.mockResolvedValue({ data: null, error: null });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("never exposes moderation fields or customer ID in anonymous approved comments", async () => {
    mocks.from.mockImplementation((table: string) => {
      const query = {
        select: () => query, eq: () => query,
        order: async () => ({ data: [{ id: "comment-fixture", post_id: "post-fixture", customer_id: "customer-fixture", status: "approved", content: "Public comment", admin_note: "Private moderation fixture", reviewed_by: "moderator@example.invalid" }], error: null }),
        in: async () => ({ data: [{ id: "customer-fixture", first_name: "Fixture", last_name: "Customer" }], error: null }),
      };
      expect(["blog_comments", "profiles"]).toContain(table);
      return query;
    });
    const response = await comments(new Request("https://shop.example.invalid/api/blog/comments?postId=post-fixture"));
    expect(response.status).toBe(200);
    const comment = (await response.json()).comments[0];
    expect(comment).toMatchObject({ content: "Public comment", customerFirstName: "Fixture" });
    for (const field of ["adminNote", "reviewedBy", "reviewedAt", "customerId", "status"]) expect(comment).not.toHaveProperty(field);
  });

  it("only requests confirmation, stores a token hash and checks independent email/IP/global budgets", async () => {
    const response = await subscribe(new Request("https://shop.example.invalid/api/newsletter/subscribe", {
      method: "POST", body: JSON.stringify({ email: "third-party@example.invalid", source: "application" }),
    }));
    expect(response.status).toBe(200);
    expect(mocks.from).not.toHaveBeenCalled();
    const message = mocks.send.mock.calls[0][0];
    expect(message.token).toMatch(/^[a-f0-9]{64}$/);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_request_newsletter_confirmation", {
      p_email: "third-party@example.invalid", p_source: "application", p_token_hash: newsletterTokenHash(message.token),
    });
    expect(mocks.limit).toHaveBeenCalledTimes(3);
    expect((await response.json()).alreadySubscribed).toBeUndefined();
  });

  it("does not send mail or create a request when any budget is exhausted", async () => {
    mocks.limit.mockResolvedValueOnce({ allowed: true }).mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 30 });
    expect((await subscribe(new Request("https://shop.example.invalid", { method: "POST", body: JSON.stringify({ email: "fixture@example.invalid" }) }))).status).toBe(429);
    expect(mocks.send).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("requires POST and a valid one-use confirmation result", async () => {
    expect("GET" in confirm).toBe(false);
    const post = (token: string) => new Request("https://shop.example.invalid/api/newsletter/confirm", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `token=${token}`,
    });
    expect((await confirm.POST(post("invalid"))).headers.get("Location")).toContain("error=1");
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: false, error: null });
    expect((await confirm.POST(post("ab".repeat(32)))).headers.get("Location")).toContain("done=1");
    expect((await confirm.POST(post("ab".repeat(32)))).headers.get("Location")).toContain("error=1");
  });
});
