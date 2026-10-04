import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({ page: vi.fn(), store: vi.fn(), session: vi.fn(), enabled: vi.fn(), storefront: vi.fn(), denied: vi.fn() }));
vi.mock("@/lib/contest-backend", () => ({ getContestEntryReviewsPage: mocks.page }));
vi.mock("@/lib/data-backend", () => ({ readPublicStoreByBackend: mocks.store }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/contest-feature", () => ({ isContestFeatureEnabledServer: mocks.enabled, getContestFeatureAccessDeniedResponse: mocks.denied }));
vi.mock("@/lib/product-tasting-feature", () => ({ isProductTastingStorefrontEnabled: mocks.storefront }));
import { GET as storefront } from "./route";
import { GET as notebook } from "@/app/api/contest/review-pages/[entryId]/route";

const context = { params: Promise.resolve({ entryId: "entry" }) };
const request = (query = "") => new Request(`https://example.test/reviews${query}`);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.enabled.mockReturnValue(true);
  mocks.storefront.mockReturnValue(true);
  mocks.denied.mockResolvedValue(null);
  mocks.session.mockResolvedValue(null);
  mocks.store.mockResolvedValue({ products: [{ id: "product" }] });
  mocks.page.mockResolvedValue({ productId: "product", nextReviewCursor: null, reviews: [{
    id: "review", pseudo: "PublicPseudo", comment: "Public comment", customerId: "secret-customer", adminNote: "Private note", reviewedBy: "admin@example.test",
  }] });
});

describe("review pages access and privacy", () => {
  it("returns only public review data without caching personalized or moderated content", async () => {
    for (const route of [storefront, notebook]) {
      const response = await route(request(), context);
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(await response.json()).toEqual({ nextReviewCursor: null, reviews: [{ id: "review", pseudo: "PublicPseudo", comment: "Public comment" }] });
    }
  });
  it("blocks disabled storefront reads and reviews for products outside the public catalogue", async () => {
    mocks.storefront.mockReturnValue(false);
    expect((await storefront(request(), context)).status).toBe(404);
    expect(mocks.page).not.toHaveBeenCalled();
    mocks.storefront.mockReturnValue(true);
    mocks.store.mockResolvedValue({ products: [] });
    expect((await storefront(request(), context)).status).toBe(404);
  });
  it("keeps notebook opening restrictions even when storefront notes are public", async () => {
    mocks.denied.mockResolvedValue(NextResponse.json({ error: "Closed" }, { status: 423 }));
    expect((await notebook(request(), context)).status).toBe(423);
    expect(mocks.page).not.toHaveBeenCalled();
  });
  it("rejects malformed cursors before querying data", async () => {
    for (const route of [storefront, notebook]) expect((await route(request("?cursor=bad"), context)).status).toBe(400);
    expect(mocks.page).not.toHaveBeenCalled();
  });
});
