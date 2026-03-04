import { describe, expect, it, vi } from "vitest";

import { createOrderId } from "@/lib/order-id";

describe("order-id", () => {
  it("builds an order id with the expected date prefix and 4-digit suffix", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    expect(createOrderId(new Date("2026-03-04T10:00:00.000Z"))).toBe("ORD-20260304-1000");
  });
});
