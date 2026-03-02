import "server-only";

import { scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

const HASH_PREFIX = "scrypt";
const MAX_PASSWORD_LENGTH = 256;

type ParsedPasswordHash = {
  salt: Buffer;
  derivedKey: Buffer;
};

function getConfiguredAdminPasswordHash(): string | null {
  const value = process.env.ADMIN_PASSWORD_HASH?.trim() ?? "";
  return value ? value : null;
}

function parsePasswordHash(value: string): ParsedPasswordHash | null {
  const [prefix, saltBase64, hashBase64] = value.split("$");
  if (
    prefix !== HASH_PREFIX ||
    !saltBase64 ||
    !hashBase64
  ) {
    return null;
  }

  try {
    const salt = Buffer.from(saltBase64, "base64");
    const derivedKey = Buffer.from(hashBase64, "base64");
    if (salt.length < 16 || derivedKey.length < 32) {
      return null;
    }

    return { salt, derivedKey };
  } catch {
    return null;
  }
}

async function verifyScryptHash(candidate: string, hashValue: string): Promise<boolean> {
  const parsed = parsePasswordHash(hashValue);
  if (!parsed) {
    throw new Error("ADMIN_PASSWORD_HASH invalide. Format attendu: scrypt$<salt_base64>$<hash_base64>.");
  }

  const derived = (await scrypt(candidate, parsed.salt, parsed.derivedKey.length)) as Buffer;
  if (derived.length !== parsed.derivedKey.length) {
    return false;
  }

  return timingSafeEqual(derived, parsed.derivedKey);
}

export async function verifyAdminPassword(candidate: unknown): Promise<boolean> {
  if (typeof candidate !== "string") {
    return false;
  }

  if (candidate.length < 1 || candidate.length > MAX_PASSWORD_LENGTH) {
    return false;
  }

  const configuredHash = getConfiguredAdminPasswordHash();
  if (!configuredHash) {
    throw new Error("ADMIN_PASSWORD_HASH manquant. Definis un hash scrypt pour sécuriser l'accès admin.");
  }

  return verifyScryptHash(candidate, configuredHash);
}



