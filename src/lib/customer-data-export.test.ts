import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetCustomerByIdFullByBackend,
  mockGetLotteryTicketsForCustomerByBackend,
  mockGetReferralPendingRewardsByBackend,
  mockGetCustomerMissionsByBackend,
  mockGetCustomerOrdersForLoyaltyByBackend,
  mockMaybeSingle,
  mockEq,
  mockMailingEq,
  mockMailingRange,
  mockCreateSupabaseServiceClient,
} = vi.hoisted(() => {
  const hoistedMaybeSingle = vi.fn();
  const hoistedEq = vi.fn(() => ({ maybeSingle: hoistedMaybeSingle }));
  const hoistedSelect = vi.fn(() => ({ eq: hoistedEq }));
  const hoistedMailingRange = vi.fn();
  const hoistedMailingEq = vi.fn(() => ({ order: vi.fn(() => ({ range: hoistedMailingRange })) }));
  const hoistedFrom = vi.fn((table: string) => ({
    select: table === "mailing_recipients" ? vi.fn(() => ({ eq: hoistedMailingEq })) : hoistedSelect,
  }));

  return {
    mockGetCustomerByIdFullByBackend: vi.fn(),
    mockGetLotteryTicketsForCustomerByBackend: vi.fn(),
    mockGetReferralPendingRewardsByBackend: vi.fn(),
    mockGetCustomerMissionsByBackend: vi.fn(),
    mockGetCustomerOrdersForLoyaltyByBackend: vi.fn(),
    mockMaybeSingle: hoistedMaybeSingle,
    mockEq: hoistedEq,
    mockMailingEq: hoistedMailingEq,
    mockMailingRange: hoistedMailingRange,
    mockSelect: hoistedSelect,
    mockFrom: hoistedFrom,
    mockCreateSupabaseServiceClient: vi.fn(() => ({ from: hoistedFrom })),
  };
});

vi.mock("@/lib/customer-backend", () => ({
  getCustomerByIdFullByBackend: mockGetCustomerByIdFullByBackend,
}));

vi.mock("@/lib/lottery-backend", () => ({
  getLotteryTicketsForCustomerByBackend: mockGetLotteryTicketsForCustomerByBackend,
}));

vi.mock("@/lib/missions-backend", () => ({
  getReferralPendingRewardsByBackend: mockGetReferralPendingRewardsByBackend,
  getCustomerMissionsByBackend: mockGetCustomerMissionsByBackend,
}));

vi.mock("@/lib/order-backend", () => ({
  getCustomerOrdersForLoyaltyByBackend: mockGetCustomerOrdersForLoyaltyByBackend,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseServiceClient: mockCreateSupabaseServiceClient,
}));

import { exportCustomerData } from "@/lib/customer-data-export";

describe("customer-data-export", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T10:30:00.000Z"));
    vi.clearAllMocks();
    mockMailingRange.mockResolvedValue({ data: [], error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null when the customer cannot be found", async () => {
    mockGetCustomerByIdFullByBackend.mockResolvedValue(null);

    await expect(exportCustomerData("missing-customer")).resolves.toBeNull();
    expect(mockGetCustomerOrdersForLoyaltyByBackend).not.toHaveBeenCalled();
    expect(mockCreateSupabaseServiceClient).not.toHaveBeenCalled();
  });

  it("aggregates account, order, mission, lottery, newsletter, and mailing data", async () => {
    mockGetCustomerByIdFullByBackend.mockResolvedValue({
      id: "customer-1",
      email: "USER@example.com",
      firstName: "Alice",
    });
    mockGetCustomerOrdersForLoyaltyByBackend.mockResolvedValue([{ id: "order-1" }]);
    mockGetLotteryTicketsForCustomerByBackend.mockResolvedValue([{ id: "ticket-1" }]);
    mockGetReferralPendingRewardsByBackend.mockResolvedValue([{ id: "reward-1" }]);
    mockGetCustomerMissionsByBackend.mockResolvedValue([{ id: "mission-1" }]);
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 42,
        email: "user@example.com",
        status: "active",
        source: "footer",
        created_at: "2025-01-01T00:00:00.000Z",
        updated_at: "2025-01-02T00:00:00.000Z",
        last_contacted_at: null,
      },
      error: null,
    });

    await expect(exportCustomerData("customer-1")).resolves.toEqual({
      exportedAt: "2026-01-15T10:30:00.000Z",
      customerId: "customer-1",
      customer: {
        id: "customer-1",
        email: "USER@example.com",
        firstName: "Alice",
      },
      orders: [{ id: "order-1" }],
      lotteryTickets: [{ id: "ticket-1" }],
      referralPendingRewards: [{ id: "reward-1" }],
      missions: [{ id: "mission-1" }],
      newsletterSubscription: {
        id: "42",
        email: "user@example.com",
        status: "active",
        source: "footer",
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-02T00:00:00.000Z",
        lastContactedAt: undefined,
      },
      mailingHistory: [],
    });

    expect(mockGetCustomerOrdersForLoyaltyByBackend).toHaveBeenCalledWith({
      customerId: "customer-1",
      customerEmail: "USER@example.com",
    });
    expect(mockEq).toHaveBeenCalledWith("email_normalized", "user@example.com");
    expect(mockMailingEq).toHaveBeenCalledWith("email", "user@example.com");
    expect(mockMailingRange).toHaveBeenCalledWith(0, 499);
  });

  it("returns no newsletter subscription when the customer email is blank", async () => {
    mockGetCustomerByIdFullByBackend.mockResolvedValue({
      id: "customer-2",
      email: "   ",
    });
    mockGetCustomerOrdersForLoyaltyByBackend.mockResolvedValue([]);
    mockGetLotteryTicketsForCustomerByBackend.mockResolvedValue([]);
    mockGetReferralPendingRewardsByBackend.mockResolvedValue([]);
    mockGetCustomerMissionsByBackend.mockResolvedValue([]);

    const result = await exportCustomerData("customer-2");

    expect(result?.newsletterSubscription).toBeNull();
    expect(result?.mailingHistory).toEqual([]);
    expect(mockCreateSupabaseServiceClient).not.toHaveBeenCalled();
  });

  it("exports every mailing history page without leaking extra database columns", async () => {
    mockGetCustomerByIdFullByBackend.mockResolvedValue({ id: "customer-1", email: "USER@example.com" });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const row = {
      id: "recipient-1", campaign_id: "campaign-1", email: "user@example.com", first_name: "Alice",
      status: "sent", error: null, sent_at: "2026-01-02T00:00:00Z", created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z", internal_value: "never-export-this",
    };
    mockMailingRange
      .mockResolvedValueOnce({ data: Array.from({ length: 500 }, (_, index) => ({ ...row, id: String(index) })), error: null })
      .mockResolvedValueOnce({ data: [{ ...row, id: "last-recipient" }], error: null });

    const result = await exportCustomerData("customer-1");

    expect(result?.mailingHistory).toHaveLength(501);
    expect(mockMailingRange.mock.calls).toEqual([[0, 499], [500, 999]]);
    expect(result?.mailingHistory.at(-1)).toEqual({
      id: "last-recipient", campaignId: "campaign-1", email: "user@example.com", firstName: "Alice",
      status: "sent", error: null, sentAt: row.sent_at, createdAt: row.created_at, updatedAt: row.updated_at,
    });
    expect(JSON.stringify(result?.mailingHistory)).not.toContain("never-export-this");
  });

  it("fails the export when mailing history cannot be read instead of returning incomplete data", async () => {
    mockGetCustomerByIdFullByBackend.mockResolvedValue({ id: "customer-1", email: "user@example.com" });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockMailingRange.mockResolvedValue({ data: null, error: { message: "database unavailable" } });

    await expect(exportCustomerData("customer-1")).rejects.toThrow("export mailing history");
  });
});
