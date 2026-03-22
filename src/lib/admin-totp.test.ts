import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isAdminTotpEnabled, verifyAdminTotp } from "@/lib/admin-totp";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const FIXED_NOW_MS = 1_700_000_000_000;
const originalTotpSecret = process.env.ADMIN_TOTP_SECRET;

function decodeBase32(encoded: string): Buffer {
  const cleaned = encoded.replace(/[\s=-]+/g, "").toUpperCase();
  let bits = "";
  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char);
    bits += index.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function createTotp(secretBase32: string, timestampMs: number): string {
  const secret = decodeBase32(secretBase32);
  const counter = BigInt(Math.floor(timestampMs / 1000 / 30));
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(counter);

  const hmac = createHmac("sha1", secret).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);

  return String(binary % 1_000_000).padStart(6, "0");
}

afterEach(() => {
  vi.restoreAllMocks();
  if (originalTotpSecret === undefined) {
    delete process.env.ADMIN_TOTP_SECRET;
    return;
  }

  process.env.ADMIN_TOTP_SECRET = originalTotpSecret;
});

describe("admin-totp", () => {
  it("is disabled when no secret is configured", () => {
    delete process.env.ADMIN_TOTP_SECRET;

    expect(isAdminTotpEnabled()).toBe(false);
    expect(verifyAdminTotp("123456")).toBe(true);
  });

  it("accepts a valid TOTP code", () => {
    process.env.ADMIN_TOTP_SECRET = "JBSWY3DPEHPK3PXP";
    vi.spyOn(Date, "now").mockReturnValue(FIXED_NOW_MS);

    const code = createTotp(process.env.ADMIN_TOTP_SECRET, FIXED_NOW_MS);

    expect(isAdminTotpEnabled()).toBe(true);
    expect(verifyAdminTotp(code)).toBe(true);
    expect(verifyAdminTotp(`${code.slice(0, 3)} ${code.slice(3)}`)).toBe(true);
  });

  it("rejects malformed or invalid TOTP codes", () => {
    process.env.ADMIN_TOTP_SECRET = "JBSWY3DPEHPK3PXP";
    vi.spyOn(Date, "now").mockReturnValue(FIXED_NOW_MS);

    expect(verifyAdminTotp("12ab56")).toBe(false);
    expect(verifyAdminTotp("12345")).toBe(false);
    expect(verifyAdminTotp("000000")).toBe(false);
  });
});