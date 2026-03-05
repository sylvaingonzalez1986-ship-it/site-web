"use client";

import { OPEN_CONSENT_PREFERENCES_EVENT } from "@/lib/cookie-consent";

export function CookiePreferencesButton() {
  return (
    <button
      type="button"
      className="btn-cartoon btn-secondary mt-3 h-9 px-3 text-xs"
      onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_PREFERENCES_EVENT))}
    >
      Modifier mes preferences cookies
    </button>
  );
}
