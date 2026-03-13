export type CookieCategory = "necessary" | "analytics" | "marketing";

export type CookieConsentSelections = Record<CookieCategory, boolean>;

export type CookieConsentState = {
  version: number;
  categories: CookieConsentSelections;
  updatedAt: string;
};

export type CookieCategoryDefinition = {
  key: CookieCategory;
  label: string;
  description: string;
  required: boolean;
};

export const COOKIE_CONSENT_COOKIE_NAME = "lcb_cookie_consent";
export const COOKIE_CONSENT_VERSION = 1;

// CNIL recommends renewing the stored choice after 6 months.
export const COOKIE_CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
export const COOKIE_CONSENT_DURATION_LABEL = "6 mois";

export const DEFAULT_COOKIE_CONSENT_SELECTIONS: CookieConsentSelections = {
  necessary: true,
  analytics: false,
  marketing: false,
};

export const COOKIE_CATEGORIES: CookieCategoryDefinition[] = [
  {
    key: "necessary",
    label: "Cookies necessaires",
    description:
      "Indispensables au fonctionnement du site, a la securite, au panier, a la session et a la verification d'age.",
    required: true,
  },
  {
    key: "analytics",
    label: "Cookies analytiques",
    description:
      "Mesure d'audience et statistiques de navigation. Desactives par defaut tant que vous n'avez pas consenti.",
    required: false,
  },
  {
    key: "marketing",
    label: "Cookies marketing",
    description:
      "Publicite personnalisee, retargeting et reseaux sociaux. Aucun traceur marketing n'est actif aujourd'hui.",
    required: false,
  },
];

export function buildCookieConsentState(
  selections?: Partial<CookieConsentSelections>,
): CookieConsentState {
  return {
    version: COOKIE_CONSENT_VERSION,
    categories: {
      ...DEFAULT_COOKIE_CONSENT_SELECTIONS,
      ...selections,
      necessary: true,
    },
    updatedAt: new Date().toISOString(),
  };
}
