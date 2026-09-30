import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseServiceClient: () => ({ from: mocks.from, rpc: mocks.rpc }),
}));

import {
  getInvoicePersonalMessageFromSupabase,
  setInvoicePersonalMessageInSupabase,
} from "./invoice-backend";

function query() {
  const chain = {
    select: vi.fn(), update: vi.fn(), eq: vi.fn(), single: vi.fn(), maybeSingle: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.single.mockResolvedValue({ data: { personal_message: "Merci !" }, error: null });
  chain.maybeSingle.mockResolvedValue({ data: { personal_message: "Merci !" }, error: null });
  return chain;
}

let chain: ReturnType<typeof query>;
beforeEach(() => {
  vi.clearAllMocks();
  chain = query();
  mocks.from.mockReturnValue(chain);
});

describe("invoice message persistence", () => {
  it("reads the note by order id without issuing an invoice", async () => {
    expect(await getInvoicePersonalMessageFromSupabase(" ORD-1 ")).toBe("Merci !");
    expect(mocks.from).toHaveBeenCalledWith("invoices");
    expect(chain.select).toHaveBeenCalledWith("personal_message");
    expect(chain.eq).toHaveBeenCalledWith("order_id", "ORD-1");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns an empty message when no invoice exists yet", async () => {
    chain.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await getInvoicePersonalMessageFromSupabase("ORD-1")).toBe("");
    expect(chain.update).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("updates only the note and returns the stored value", async () => {
    expect(await setInvoicePersonalMessageInSupabase("ORD-1", " Merci !\r\nÀ bientôt. ")).toBe("Merci !");
    expect(chain.update).toHaveBeenCalledWith({ personal_message: "Merci !\nÀ bientôt." });
    expect(chain.eq).toHaveBeenCalledWith("order_id", "ORD-1");
    expect(chain.select).toHaveBeenCalledWith("personal_message");
    expect(chain.single).toHaveBeenCalledOnce();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("supports clearing an existing note", async () => {
    chain.single.mockResolvedValue({ data: { personal_message: "" }, error: null });
    expect(await setInvoicePersonalMessageInSupabase("ORD-1", " ")).toBe("");
    expect(chain.update).toHaveBeenCalledWith({ personal_message: "" });
  });

  it("rejects invalid arguments before accessing the database", async () => {
    await expect(setInvoicePersonalMessageInSupabase("", "Merci")).rejects.toThrow();
    await expect(getInvoicePersonalMessageFromSupabase(" ")).rejects.toThrow();
    await expect(setInvoicePersonalMessageInSupabase("ORD-1", "x".repeat(1_001))).rejects.toThrow();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("never inserts a missing invoice to save its message", async () => {
    chain.single.mockResolvedValue({ data: null, error: null });
    await expect(setInvoicePersonalMessageInSupabase("ORD-1", "Merci")).rejects.toThrow("Facture introuvable");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("propagates read and write errors instead of silently clearing the note", async () => {
    const failure = { data: null, error: { message: "permission denied" } };
    chain.maybeSingle.mockResolvedValue(failure);
    chain.single.mockResolvedValue(failure);
    await expect(getInvoicePersonalMessageFromSupabase("ORD-1")).rejects.toThrow("permission denied");
    await expect(setInvoicePersonalMessageInSupabase("ORD-1", "Merci")).rejects.toThrow("permission denied");
  });
});
