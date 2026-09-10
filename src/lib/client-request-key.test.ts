import { describe, expect, it } from "vitest";
import { createClientRequestKey } from "@/lib/client-request-key";

describe("client request keys", () => {
  it("uses a native UUID when secure-context crypto supports it", () => {
    expect(createClientRequestKey({
      randomUUID: () => "123e4567-e89b-42d3-a456-426614174000",
    })).toBe("123e4567-e89b-42d3-a456-426614174000");
  });

  it("builds a valid UUID with getRandomValues when randomUUID is unavailable", () => {
    expect(createClientRequestKey({
      getRandomValues: (values) => {
        values.fill(0);
        return values;
      },
    })).toBe("00000000-0000-4000-8000-000000000000");
  });

  it("still creates a valid UUID when no Web Crypto API is exposed", () => {
    expect(createClientRequestKey(null)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
