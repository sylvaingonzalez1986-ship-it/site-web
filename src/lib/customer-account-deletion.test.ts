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
    mocks.rpc.mockImplementation(async (name: string) => ({
      data: name === "rpc_anonymize_customer_orders" ? 0 : name === "rpc_delete_customer_newsletter_data" ? false : null,
      error: null,
    }));
    mocks.deleteUser.mockResolvedValue({ error: null });
    const query = {
      update: vi.fn(() => query), delete: vi.fn(() => query), eq: vi.fn(() => query),
      select: vi.fn(async () => ({ data: [], error: null })),
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

    expect(mocks.rpc).toHaveBeenCalledWith("rpc_anonymize_customer_orders", { p_customer_id: "customer-1", p_email: "user@example.com" });
    expect(mocks.rpc).toHaveBeenCalledWith("rpc_delete_customer_newsletter_data", { p_email: "user@example.com" });
    expect(mocks.rpc).toHaveBeenCalledWith("rpc_delete_mailing_contact", { p_email: "user@example.com" });
    expect(mocks.deleteUser).toHaveBeenCalledExactlyOnceWith("customer-1");
    expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(mocks.deleteUser.mock.invocationCallOrder[0]);
  });

  it("keeps the account available for retry if queued mailing data cannot be removed", async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === "rpc_delete_mailing_contact"
      ? { error: { message: "mailing unavailable" } } : { data: name === "rpc_delete_customer_newsletter_data" ? false : 0, error: null });

    await expect(deleteCustomerAccount({ customerId: "customer-1", customerEmail: "user@example.com" }))
      .rejects.toThrow("delete mailing contact");
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("does not delete the account or fall back to a pattern query when anonymization fails", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "anonymization unavailable" } });
    await expect(deleteCustomerAccount({ customerId: "customer-1", customerEmail: "a_b@example.com" }))
      .rejects.toThrow("anonymize customer orders");
    expect(mocks.deleteUser).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("keeps the authentication account when pending newsletter consent cannot be erased", async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === "rpc_delete_customer_newsletter_data"
      ? { error: { message: "newsletter purge unavailable" } } : { data: 0, error: null });
    await expect(deleteCustomerAccount({ customerId: "customer-1", customerEmail: "user@example.com" }))
      .rejects.toThrow("delete newsletter subscriber");
    expect(mocks.deleteUser).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalledWith("rpc_delete_mailing_contact", expect.anything());
  });
});
