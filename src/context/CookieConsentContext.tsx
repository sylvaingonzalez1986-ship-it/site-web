"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  CONSENT_UPDATED_EVENT,
  DEFAULT_CONSENT,
  OPEN_CONSENT_PREFERENCES_EVENT,
  readConsent,
  writeConsent,
  type ConsentCategories,
} from "@/lib/cookie-consent";

type CookieConsentContextValue = {
  consent: ConsentCategories;
  hasResponded: boolean;
  preferencesOpen: boolean;
  openPreferences: () => void;
  closePreferences: () => void;
  acceptAll: () => void;
  rejectAll: () => void;
  updateConsent: (categories: ConsentCategories) => void;
};

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const initialConsent = typeof document === "undefined" ? null : readConsent();
  const [consent, setConsent] = useState<ConsentCategories>(initialConsent ?? DEFAULT_CONSENT);
  const [hasResponded, setHasResponded] = useState(Boolean(initialConsent));
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  const emitConsentUpdated = useCallback((next: ConsentCategories) => {
    window.dispatchEvent(new CustomEvent(CONSENT_UPDATED_EVENT, { detail: next }));
  }, []);

  useEffect(() => {
    const onOpenPreferences = () => {
      setPreferencesOpen(true);
    };
    window.addEventListener(OPEN_CONSENT_PREFERENCES_EVENT, onOpenPreferences);
    return () => window.removeEventListener(OPEN_CONSENT_PREFERENCES_EVENT, onOpenPreferences);
  }, []);

  const updateConsent = useCallback(
    (categories: ConsentCategories) => {
      writeConsent(categories);
      setConsent(categories);
      setHasResponded(true);
      setPreferencesOpen(false);
      emitConsentUpdated(categories);
    },
    [emitConsentUpdated],
  );

  const acceptAll = useCallback(() => {
    updateConsent({ analytics: true });
  }, [updateConsent]);

  const rejectAll = useCallback(() => {
    updateConsent({ analytics: false });
  }, [updateConsent]);

  const value = useMemo<CookieConsentContextValue>(
    () => ({
      consent,
      hasResponded,
      preferencesOpen,
      openPreferences: () => setPreferencesOpen(true),
      closePreferences: () => setPreferencesOpen(false),
      acceptAll,
      rejectAll,
      updateConsent,
    }),
    [acceptAll, consent, hasResponded, preferencesOpen, rejectAll, updateConsent],
  );

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const value = useContext(CookieConsentContext);
  if (!value) {
    throw new Error("useCookieConsent must be used inside CookieConsentProvider");
  }
  return value;
}
