import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  COOKIE_CONSENT_COOKIE_NAME,
  COOKIE_CONSENT_VERSION,
} from "@/components/cookies/cookie-consent-config";
import {
  getConsentFromCookie,
  hasValidConsent,
  revokeConsent,
  setConsentCookie,
} from "@/components/cookies/cookie-consent-utils";

const cookieStore = new Map<string, string>();
let lastCookieWrite = "";

function installDomMocks(protocol = "https:") {
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      get cookie() {
        return Array.from(cookieStore.entries())
          .map(([key, value]) => `${key}=${value}`)
          .join("; ");
      },
      set cookie(input: string) {
        lastCookieWrite = input;
        const [nameValue, ...attributes] = input.split(";").map((part) => part.trim());
        const separatorIndex = nameValue.indexOf("=");
        const name = nameValue.slice(0, separatorIndex);
        const value = nameValue.slice(separatorIndex + 1);
        const shouldDelete =
          attributes.some((attribute) => attribute === "Max-Age=0") ||
          attributes.some((attribute) => attribute.startsWith("Expires=Thu, 01 Jan 1970"));

        if (shouldDelete) {
          cookieStore.delete(name);
          return;
        }

        cookieStore.set(name, value);
      },
    },
  });

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: {
        protocol,
      },
    },
  });

  Object.defineProperty(globalThis, "btoa", {
    configurable: true,
    value: (input: string) => Buffer.from(input, "binary").toString("base64"),
  });

  Object.defineProperty(globalThis, "atob", {
    configurable: true,
    value: (input: string) => Buffer.from(input, "base64").toString("binary"),
  });
}

describe("cookie consent utils", () => {
  beforeEach(() => {
    cookieStore.clear();
    lastCookieWrite = "";
    installDomMocks();
  });

  afterEach(() => {
    cookieStore.clear();
  });

  it("writes and reads a valid consent cookie", () => {
    const state = setConsentCookie({ analytics: true, marketing: false });

    expect(state).not.toBeNull();
    expect(lastCookieWrite).toContain(`${COOKIE_CONSENT_COOKIE_NAME}=`);
    expect(lastCookieWrite).toContain("SameSite=Lax");
    expect(lastCookieWrite).toContain("Secure");

    const parsed = getConsentFromCookie();
    expect(parsed).toEqual({
      version: COOKIE_CONSENT_VERSION,
      categories: {
        necessary: true,
        analytics: true,
        marketing: false,
      },
      updatedAt: expect.any(String),
    });
    expect(hasValidConsent()).toBe(true);
  });

  it("rejects malformed or outdated consent cookies", () => {
    cookieStore.set(
      COOKIE_CONSENT_COOKIE_NAME,
      encodeURIComponent(
        globalThis.btoa(
          JSON.stringify({
            version: COOKIE_CONSENT_VERSION + 1,
            categories: {
              necessary: true,
              analytics: true,
              marketing: true,
            },
            updatedAt: new Date().toISOString(),
          }),
        ),
      ),
    );

    expect(getConsentFromCookie()).toBeNull();
    expect(hasValidConsent()).toBe(false);
  });

  it("revokes the consent cookie", () => {
    setConsentCookie({ analytics: true, marketing: true });
    expect(cookieStore.has(COOKIE_CONSENT_COOKIE_NAME)).toBe(true);

    revokeConsent();

    expect(cookieStore.has(COOKIE_CONSENT_COOKIE_NAME)).toBe(false);
    expect(hasValidConsent()).toBe(false);
  });
});
