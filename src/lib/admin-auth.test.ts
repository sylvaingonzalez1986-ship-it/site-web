import { describe, expect, it } from "vitest";

import {
  decodeAdminSessionPayload,
  encodeAdminSessionPayload,
} from "@/lib/admin-auth";

describe("admin-auth", () => {
  it("round-trips a valid payload", () => {
    const payload = {
      v: 1,
      exp: Math.floor(Date.now() / 1000) + 60,
      nonce: "1234567890abcdef",
    };

    expect(decodeAdminSessionPayload(encodeAdminSessionPayload(payload))).toEqual(payload);
  });

  it("rejects invalid hex payloads", () => {
    expect(decodeAdminSessionPayload("not-hex")).toBeNull();
  });

  it("rejects payloads with a version mismatch", () => {
    const encoded = encodeAdminSessionPayload({
      v: 2,
      exp: Math.floor(Date.now() / 1000) + 60,
      nonce: "1234567890abcdef",
    } as never);

    expect(decodeAdminSessionPayload(encoded)).toBeNull();
  });

  it("rejects payloads with a short nonce", () => {
    const encoded = encodeAdminSessionPayload({
      v: 1,
      exp: Math.floor(Date.now() / 1000) + 60,
      nonce: "short",
    } as never);

    expect(decodeAdminSessionPayload(encoded)).toBeNull();
  });
});
