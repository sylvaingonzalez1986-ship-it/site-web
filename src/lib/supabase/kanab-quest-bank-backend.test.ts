import { beforeEach, describe, expect, it, vi } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("./admin", () => ({ createSupabaseServiceClient: () => ({ rpc }) }));
import { getKqBank, KqBankError } from "./kanab-quest-bank-backend";
const id = "12345678-1234-4123-8123-123456789abc";
beforeEach(() => vi.clearAllMocks());
describe("bank backend", () => {
  it("validates identity before SQL", async () => {
    await expect(getKqBank("victim")).rejects.toBeInstanceOf(KqBankError);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects incomplete response schemas", async () => {
    rpc.mockResolvedValue({ data: { cashCents: 1000 }, error: null });
    await expect(getKqBank(id)).rejects.toThrow("invalid response");
    expect(rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_bank", { p_user_id: id, p_command: null });
  });
  it.each([["bank_quote_changed", 409], ["bank_reputation", 403], ["bank_cash", 400], ["bank_request_mismatch", 409]])("maps %s to a bounded user error", async (message, status) => {
    rpc.mockResolvedValue({ data: null, error: { message } });
    await expect(getKqBank(id)).rejects.toMatchObject({ status });
  });
  it("does not reveal database errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "private schema credential" } });
    await expect(getKqBank(id)).rejects.toThrow("[supabase:bank] unavailable");
  });
});
