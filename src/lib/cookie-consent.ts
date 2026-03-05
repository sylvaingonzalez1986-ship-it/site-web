export const CONSENT_COOKIE_NAME = "lcb_cookie_consent";
export const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 395;
export const COOKIE_CONSENT_VERSION = 1;
export const CONSENT_UPDATED_EVENT = "lcb:consent-updated";
export const OPEN_CONSENT_PREFERENCES_EVENT = "lcb:consent-open-preferences";

export type ConsentCategories = {
  analytics: boolean;
};

type PersistedConsent = {
  v: number;
  ts: string;
  analytics: boolean;
};

export const DEFAULT_CONSENT: ConsentCategories = {
  analytics: false,
};

function parseCookieString(cookieName: string, source: string): string | null {
  const prefix = `${cookieName}=`;
  const parts = source.split(";").map((chunk) => chunk.trim());
  for (const part of parts) {
    if (part.startsWith(prefix)) {
      return part.slice(prefix.length);
    }
  }
  return null;
}

export function readConsent(): ConsentCategories | null {
  if (typeof document === "undefined") {
    return null;
  }

  const raw = parseCookieString(CONSENT_COOKIE_NAME, document.cookie);
  if (!raw) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(raw);
    const parsed = JSON.parse(decoded) as Partial<PersistedConsent>;
    if (parsed.v !== COOKIE_CONSENT_VERSION || typeof parsed.analytics !== "boolean") {
      return null;
    }
    return { analytics: parsed.analytics };
  } catch {
    return null;
  }
}

export function hasConsented(): boolean {
  return readConsent() !== null;
}

export function writeConsent(categories: ConsentCategories): void {
  if (typeof document === "undefined") {
    return;
  }

  const payload: PersistedConsent = {
    v: COOKIE_CONSENT_VERSION,
    ts: new Date().toISOString(),
    analytics: categories.analytics === true,
  };
  const encoded = encodeURIComponent(JSON.stringify(payload));
  document.cookie = `${CONSENT_COOKIE_NAME}=${encoded}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax; Secure`;
}
