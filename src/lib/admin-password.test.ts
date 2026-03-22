import { randomBytes, scryptSync } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { verifyAdminPassword } from "@/lib/admin-password";

const originalPasswordHash = process.env.ADMIN_PASSWORD_HASH;

function buildPasswordHash(password: string): string {
  const salt = randomBytes(16);
  const derivedKey = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${derivedKey.toString("base64")}`;
}

afterEach(() => {
  if (originalPasswordHash === undefined) {
    delete process.env.ADMIN_PASSWORD_HASH;
    return;
  }

  process.env.ADMIN_PASSWORD_HASH = originalPasswordHash;
});

describe("admin-password", () => {
  it("accepts the configured password when the scrypt hash is valid", async () => {
    process.env.ADMIN_PASSWORD_HASH = buildPasswordHash("Sup3r-Safe!");

    await expect(verifyAdminPassword("Sup3r-Safe!")).resolves.toBe(true);
    await expect(verifyAdminPassword("wrong-password")).resolves.toBe(false);
  });

  it("rejects non-string or oversized passwords", async () => {
    process.env.ADMIN_PASSWORD_HASH = buildPasswordHash("valid-password");

    await expect(verifyAdminPassword(null)).resolves.toBe(false);
    await expect(verifyAdminPassword("x".repeat(257))).resolves.toBe(false);
  });

  it("throws when the configured hash is missing", async () => {
    delete process.env.ADMIN_PASSWORD_HASH;

    await expect(verifyAdminPassword("anything")).rejects.toThrow("ADMIN_PASSWORD_HASH manquant");
  });

  it("throws when the configured hash format is invalid", async () => {
    process.env.ADMIN_PASSWORD_HASH = "invalid-format";

    await expect(verifyAdminPassword("anything")).rejects.toThrow("ADMIN_PASSWORD_HASH invalide");
  });
});