import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetCustomerByIdFullByBackend,
  mockGetLotteryTicketsForCustomerByBackend,
  mockGetReferralPendingRewardsByBackend,
  mockGetCustomerMissionsByBackend,
  mockGetCustomerOrdersForLoyaltyByBackend,
  mockMaybeSingle,
  mockEq,
  mockSelect,
  mockFrom,
  mockCreateSupabaseServiceClient,
} = vi.hoisted(() => {
  const hoistedMaybeSingle = vi.fn();
  const hoistedEq = vi.fn(() => ({ maybeSingle: hoistedMaybeSingle }));
  const hoistedSelect = vi.fn(() => ({ eq: hoistedEq }));
  const hoistedFrom = vi.fn(() => ({ select: hoistedSelect }));

  return {
    mockGetCustomerByIdFullByBackend: vi.fn(),
    mockGetLotteryTicketsForCustomerByBackend: vi.fn(),
    mockGetReferralPendingRewardsByBackend: vi.fn(),
    mockGetCustomerMissionsByBackend: vi.fn(),
    mockGetCustomerOrdersForLoyaltyByBackend: vi.fn(),
    mockMaybeSingle: hoistedMaybeSingle,
    mockEq: hoistedEq,
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

  it("aggregates account, order, mission, lottery, and newsletter data", async () => {
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
    });

    expect(mockGetCustomerOrdersForLoyaltyByBackend).toHaveBeenCalledWith({
      customerId: "customer-1",
      customerEmail: "USER@example.com",
    });
    expect(mockEq).toHaveBeenCalledWith("email_normalized", "user@example.com");
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
    expect(mockCreateSupabaseServiceClient).not.toHaveBeenCalled();
  });
});