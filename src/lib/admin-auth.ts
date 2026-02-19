export const ADMIN_COOKIE_NAME = "lcb_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

const ADMIN_SESSION_TOKEN_VERSION = 1;
const DEFAULT_ADMIN_COOKIE_PATH = "/";

type AdminSessionPayload = {
  v: number;
  exp: number;
  nonce: string;
};

let cachedSigningKeyPromise: Promise<CryptoKey> | null = null;

function requireEnv(name: "ADMIN_PASSWORD" | "ADMIN_SESSION_SECRET"): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} manquant.`);
  }
  return value;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(value: string): Uint8Array | null {
  if (!value || value.length % 2 !== 0 || /[^a-fA-F0-9]/.test(value)) {
    return null;
  }

  const output = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    const byte = Number.parseInt(value.slice(index, index + 2), 16);
    if (!Number.isFinite(byte)) {
      return null;
    }
    output[index / 2] = byte;
  }
  return output;
}

function encodePayload(payload: AdminSessionPayload): string {
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  return bytesToHex(encoded);
}

function decodePayload(encodedPayload: string): AdminSessionPayload | null {
  const bytes = hexToBytes(encodedPayload);
  if (!bytes) {
    return null;
  }

  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<AdminSessionPayload>;
    const exp = parsed.exp;
    const nonce = parsed.nonce;
    if (
      parsed.v !== ADMIN_SESSION_TOKEN_VERSION ||
      typeof exp !== "number" ||
      !Number.isFinite(exp) ||
      typeof nonce !== "string" ||
      nonce.length < 16
    ) {
      return null;
    }

    return {
      v: ADMIN_SESSION_TOKEN_VERSION,
      exp: Math.floor(exp),
      nonce,
    };
  } catch {
    return null;
  }
}

async function getSigningKey(): Promise<CryptoKey> {
  if (cachedSigningKeyPromise) {
    return cachedSigningKeyPromise;
  }

  const secret = requireEnv("ADMIN_SESSION_SECRET");
  cachedSigningKeyPromise = crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign", "verify"],
  );

  return cachedSigningKeyPromise;
}

export function getAdminPassword(): string {
  return requireEnv("ADMIN_PASSWORD");
}

export async function createAdminSessionToken(
  maxAgeSeconds = ADMIN_SESSION_MAX_AGE_SECONDS,
): Promise<string> {
  const key = await getSigningKey();
  const payload: AdminSessionPayload = {
    v: ADMIN_SESSION_TOKEN_VERSION,
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
    nonce: crypto.randomUUID(),
  };

  const encodedPayload = encodePayload(payload);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(encodedPayload),
  );
  const encodedSignature = bytesToHex(new Uint8Array(signature));

  return `${encodedPayload}.${encodedSignature}`;
}

export async function verifyAdminSessionToken(token: string | undefined): Promise<boolean> {
  if (!token) {
    return false;
  }

  const [encodedPayload, encodedSignature] = token.split(".");
  if (!encodedPayload || !encodedSignature) {
    return false;
  }

  const payload = decodePayload(encodedPayload);
  if (!payload) {
    return false;
  }

  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    return false;
  }

  const signatureBytes = hexToBytes(encodedSignature);
  if (!signatureBytes) {
    return false;
  }

  const key = await getSigningKey();
  const signatureBuffer = signatureBytes.buffer.slice(
    signatureBytes.byteOffset,
    signatureBytes.byteOffset + signatureBytes.byteLength,
  ) as ArrayBuffer;
  return crypto.subtle.verify(
    "HMAC",
    key,
    signatureBuffer,
    new TextEncoder().encode(encodedPayload),
  );
}

export function getAdminCookieOptions(maxAgeSeconds = ADMIN_SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true as const,
    sameSite: "strict" as const,
    path: DEFAULT_ADMIN_COOKIE_PATH,
    secure: process.env.NODE_ENV === "production",
    maxAge: maxAgeSeconds,
  };
}
