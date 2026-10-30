import { afterEach, describe, expect, it, vi } from "vitest";
import { createClientRequestKey } from "@/lib/client-request-key";

afterEach(() => vi.unstubAllGlobals());

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

  it("uses browser crypto when the global randomUUID method is missing", () => {
    const browserCrypto = {
      getRandomValues: vi.fn(function (this: unknown, values: Uint8Array) {
        expect(this).toBe(browserCrypto);
        return values.fill(0xa5);
      }),
    };
    vi.stubGlobal("crypto", browserCrypto);

    expect(createClientRequestKey()).toBe("a5a5a5a5-a5a5-45a5-a5a5-a5a5a5a5a5a5");
    expect(browserCrypto.getRandomValues).toHaveBeenCalledTimes(1);
  });

  it("still creates a valid UUID when no Web Crypto API is exposed", () => {
    expect(createClientRequestKey(null)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
