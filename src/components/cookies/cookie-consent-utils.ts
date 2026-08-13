import {
  buildCookieConsentState,
  COOKIE_CONSENT_COOKIE_NAME,
  COOKIE_CONSENT_MAX_AGE_SECONDS,
  COOKIE_CONSENT_VERSION,
  type CookieConsentSelections,
  type CookieConsentState,
} from "@/components/cookies/cookie-consent-config";

function encodeBase64(value: string): string {
  if (typeof globalThis.btoa !== "function") {
    throw new Error("Base64 encoding unavailable in this environment.");
  }

  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return globalThis.btoa(binary);
}

function decodeBase64(value: string): string {
  if (typeof globalThis.atob !== "function") {
    throw new Error("Base64 decoding unavailable in this environment.");
  }

  const binary = globalThis.atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function readCookieValue(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const pairs = document.cookie ? document.cookie.split("; ") : [];
  const prefix = `${name}=`;
  for (const pair of pairs) {
    if (pair.startsWith(prefix)) {
      return pair.slice(prefix.length);
    }
  }

  return null;
}

function normalizeConsentState(payload: unknown): CookieConsentState | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const candidate = payload as Partial<CookieConsentState>;
  const rawCategories = candidate.categories;
  if (!rawCategories || typeof rawCategories !== "object" || Array.isArray(rawCategories)) {
    return null;
  }

  const categories = rawCategories as Partial<CookieConsentSelections>;
  const updatedAt =
    typeof candidate.updatedAt === "string" && Number.isFinite(Date.parse(candidate.updatedAt))
      ? candidate.updatedAt
      : new Date().toISOString();

  if (candidate.version !== COOKIE_CONSENT_VERSION) {
    return null;
  }

  return {
    version: COOKIE_CONSENT_VERSION,
    categories: {
      necessary: true,
      analytics: categories.analytics === true,
      marketing: categories.marketing === true,
    },
    updatedAt,
  };
}

function serializeConsent(state: CookieConsentState): string {
  return encodeURIComponent(encodeBase64(JSON.stringify(state)));
}

export function getConsentFromCookie(): CookieConsentState | null {
  const encoded = readCookieValue(COOKIE_CONSENT_COOKIE_NAME);
  if (!encoded) {
    return null;
  }

  return parseConsentCookieValue(encoded);
}

export function parseConsentCookieValue(encoded: string): CookieConsentState | null {
  try {
    const json = decodeBase64(decodeURIComponent(encoded));
    return normalizeConsentState(JSON.parse(json));
  } catch {
    return null;
  }
}

export function setConsentCookie(
  selections: Partial<CookieConsentSelections> | CookieConsentState,
): CookieConsentState | null {
  if (typeof document === "undefined") {
    return null;
  }

  const state =
    "categories" in selections
      ? buildCookieConsentState(selections.categories)
      : buildCookieConsentState(selections);
  const parts = [
    `${COOKIE_CONSENT_COOKIE_NAME}=${serializeConsent(state)}`,
    "Path=/",
    `Max-Age=${COOKIE_CONSENT_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
  ];

  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    parts.push("Secure");
  }

  document.cookie = parts.join("; ");
  return state;
}

export function hasValidConsent(): boolean {
  return getConsentFromCookie() !== null;
}

export function revokeConsent(): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = [
    `${COOKIE_CONSENT_COOKIE_NAME}=`,
    "Path=/",
    "Max-Age=0",
    "SameSite=Lax",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ].join("; ");
}
