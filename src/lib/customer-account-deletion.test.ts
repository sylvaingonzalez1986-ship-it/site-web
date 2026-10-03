import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), deleteUser: vi.fn(), from: vi.fn(), proofPaths: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseServiceClient: () => ({ from: mocks.from, rpc: mocks.rpc, auth: { admin: { deleteUser: mocks.deleteUser } } }),
}));
vi.mock("@/lib/mission-proof-storage", () => ({ listMissionProofPathsForUser: mocks.proofPaths, deleteMissionProof: vi.fn() }));
import {
  buildDeletedAccountEmail,
  deleteCustomerAccount,
  normalizeDeletionConfirmationEmail,
} from "@/lib/customer-account-deletion";

describe("customer-account-deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.proofPaths.mockResolvedValue([]);
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    mocks.deleteUser.mockResolvedValue({ error: null });
    const query = {
      update: vi.fn(() => query), delete: vi.fn(() => query), eq: vi.fn(() => query),
      is: vi.fn(() => query), ilike: vi.fn(() => query), select: vi.fn(async () => ({ data: [], error: null })),
    };
    mocks.from.mockReturnValue(query);
  });
  it("normalizes the confirmation email", () => {
    expect(normalizeDeletionConfirmationEmail("  USER@Example.com ")).toBe("user@example.com");
    expect(normalizeDeletionConfirmationEmail(null)).toBe("");
  });

  it("builds a deterministic anonymized email marker", () => {
    expect(buildDeletedAccountEmail("12345678-abcd-ef00-1234-abcdefabcdef")).toBe(
      "deleted+12345678@privacy.invalid",
    );
  });

  it("removes mailing snapshots and recipient data before deleting the authentication account", async () => {
    await deleteCustomerAccount({ customerId: "customer-1", customerEmail: " USER@Example.com " });

    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_delete_mailing_contact", { p_email: "user@example.com" });
    expect(mocks.deleteUser).toHaveBeenCalledExactlyOnceWith("customer-1");
    expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(mocks.deleteUser.mock.invocationCallOrder[0]);
  });

  it("keeps the account available for retry if queued mailing data cannot be removed", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "mailing unavailable" } });

    await expect(deleteCustomerAccount({ customerId: "customer-1", customerEmail: "user@example.com" }))
      .rejects.toThrow("delete mailing contact");
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });
});
