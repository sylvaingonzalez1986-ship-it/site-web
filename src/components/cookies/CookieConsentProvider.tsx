"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  DEFAULT_COOKIE_CONSENT_SELECTIONS,
  type CookieCategory,
  type CookieConsentSelections,
  type CookieConsentState,
} from "@/components/cookies/cookie-consent-config";
import { CookieConsentModal } from "@/components/cookies/CookieConsentModal";
import { CookieSettingsButton } from "@/components/cookies/CookieSettingsButton";
import {
  getConsentFromCookie,
  revokeConsent as revokeConsentCookie,
  setConsentCookie,
} from "@/components/cookies/cookie-consent-utils";

type CookieConsentContextValue = {
  consent: CookieConsentState | null;
  showBanner: boolean;
  hasConsent: (category: CookieCategory) => boolean;
  updateConsent: (selections: Partial<CookieConsentSelections>) => void;
  openSettings: () => void;
  revokeConsent: () => void;
};

const CookieConsentContext = createContext<CookieConsentContextValue | undefined>(undefined);

function shouldHideConsentUi(pathname: string | null): boolean {
  return pathname === "/age-gate";
}

function subscribeToHydration(onStoreChange: () => void) {
  void onStoreChange;
  return () => undefined;
}

function useIsHydrated(): boolean {
  return useSyncExternalStore(subscribeToHydration, () => true, () => false);
}

/**
 * Future third-party scripts must be gated by category:
 * - analytics tools (GTM analytics, Matomo, GA) => hasConsent("analytics")
 * - marketing tools (Meta Pixel, ads, retargeting) => hasConsent("marketing")
 */
export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hydrated = useIsHydrated();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [, bumpConsentRevision] = useReducer((value: number) => value + 1, 0);

  const hideConsentUi = shouldHideConsentUi(pathname);
  const consent = hydrated ? getConsentFromCookie() : null;
  const showBanner = hydrated && !hideConsentUi && (settingsOpen || consent === null);
  const dismissible = settingsOpen && consent !== null;

  const updateConsent = useCallback((selections: Partial<CookieConsentSelections>) => {
    setConsentCookie(selections);
    bumpConsentRevision();
    setSettingsOpen(false);
  }, []);

  const openSettings = useCallback(() => {
    if (hideConsentUi) {
      return;
    }

    setSettingsOpen(true);
  }, [hideConsentUi]);

  const closeSettings = useCallback(() => {
    if (!dismissible) {
      return;
    }

    setSettingsOpen(false);
  }, [dismissible]);

  const revokeConsent = useCallback(() => {
    revokeConsentCookie();
    bumpConsentRevision();
    setSettingsOpen(true);
  }, []);

  const hasConsent = useCallback(
    (category: CookieCategory) => {
      if (category === "necessary") {
        return true;
      }

      return consent?.categories[category] === true;
    },
    [consent],
  );

  const contextValue = useMemo<CookieConsentContextValue>(
    () => ({
      consent,
      showBanner,
      hasConsent,
      updateConsent,
      openSettings,
      revokeConsent,
    }),
    [consent, hasConsent, openSettings, revokeConsent, showBanner, updateConsent],
  );

  const showSettingsButton = hydrated && !hideConsentUi && !showBanner && consent !== null;

  return (
    <CookieConsentContext.Provider value={contextValue}>
      {children}
      <CookieConsentModal
        key={`${consent?.updatedAt ?? "empty"}-${settingsOpen ? "settings" : "prompt"}`}
        open={showBanner}
        dismissible={dismissible}
        initialDetailed={settingsOpen}
        initialSelections={consent?.categories ?? DEFAULT_COOKIE_CONSENT_SELECTIONS}
        onAcceptAll={() =>
          updateConsent({
            analytics: true,
            marketing: true,
          })
        }
        onRejectAll={() =>
          updateConsent({
            analytics: false,
            marketing: false,
          })
        }
        onSave={updateConsent}
        onRequestClose={closeSettings}
      />
      {showSettingsButton ? <CookieSettingsButton onClick={openSettings} /> : null}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent(): CookieConsentContextValue {
  const context = useContext(CookieConsentContext);
  if (!context) {
    throw new Error("useCookieConsent must be used within CookieConsentProvider.");
  }

  return context;
}
