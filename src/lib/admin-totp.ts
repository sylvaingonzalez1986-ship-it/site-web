import "server-only";

import { createHmac } from "node:crypto";

const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function decodeBase32(encoded: string): Buffer {
  const cleaned = encoded.replace(/[\s=-]+/g, "").toUpperCase();
  let bits = "";
  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error("Invalid base32 character.");
    }
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateTotpCode(secret: Buffer, counter: bigint): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(counter);

  const hmac = createHmac("sha1", secret).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);

  const otp = binary % 10 ** TOTP_DIGITS;
  return otp.toString().padStart(TOTP_DIGITS, "0");
}

export function isAdminTotpEnabled(): boolean {
  return Boolean(process.env.ADMIN_TOTP_SECRET?.trim());
}

export function verifyAdminTotp(code: string): boolean {
  const secretBase32 = process.env.ADMIN_TOTP_SECRET?.trim();
  if (!secretBase32) {
    return true;
  }

  const cleaned = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(cleaned)) {
    return false;
  }

  const secret = decodeBase32(secretBase32);
  const now = Math.floor(Date.now() / 1000);
  const currentStep = BigInt(Math.floor(now / TOTP_STEP_SECONDS));

  // Allow ±1 step window to account for clock drift
  for (let offset = -1; offset <= 1; offset++) {
    const step = currentStep + BigInt(offset);
    if (generateTotpCode(secret, step) === cleaned) {
      return true;
    }
  }

  return false;
}
