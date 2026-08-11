import { describe, expect, it } from "vitest";
import {
  clearPendingVivaPayment,
  PENDING_VIVA_PAYMENT_STORAGE_KEY,
  readPendingVivaPayment,
  savePendingVivaPayment,
} from "@/lib/pending-viva-payment";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    values,
  };
}

describe("pending Viva payment storage", () => {
  it("stores and reads a valid pending payment", () => {
    const storage = createStorage();
    savePendingVivaPayment(storage, {
      attemptId: "b1a3067c-321b-4ec6-bc9d-1778aef2a19d",
      orderId: "ORD-20260811-1234",
    });

    expect(readPendingVivaPayment(storage)).toMatchObject({
      version: 1,
      attemptId: "b1a3067c-321b-4ec6-bc9d-1778aef2a19d",
      orderId: "ORD-20260811-1234",
    });
  });

  it("removes malformed or expired records", () => {
    const storage = createStorage();
    storage.setItem(
      PENDING_VIVA_PAYMENT_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        attemptId: "invalid",
        orderId: "ORD-1",
        createdAt: 1,
      }),
    );

    expect(readPendingVivaPayment(storage, Date.now())).toBeNull();
    expect(storage.getItem(PENDING_VIVA_PAYMENT_STORAGE_KEY)).toBeNull();
  });

  it("only clears the expected order when one is supplied", () => {
    const storage = createStorage();
    savePendingVivaPayment(storage, {
      attemptId: "b1a3067c-321b-4ec6-bc9d-1778aef2a19d",
      orderId: "ORD-EXPECTED",
    });

    clearPendingVivaPayment(storage, "ORD-OTHER");
    expect(readPendingVivaPayment(storage)?.orderId).toBe("ORD-EXPECTED");
    clearPendingVivaPayment(storage, "ORD-EXPECTED");
    expect(readPendingVivaPayment(storage)).toBeNull();
  });
});
