export const KQ_PLACARD_MOBILE_REVIEW_PROFILES = [
  {
    code: "ios-safari",
    name: "iPhone · Safari",
    description: "Appareil iOS physique avec encoche ou Dynamic Island.",
  },
  {
    code: "android-chrome",
    name: "Android · Chrome",
    description: "Téléphone Android physique, largeur compacte ou standard.",
  },
] as const;

export type KqPlacardMobileReviewCheck = {
  code: string;
  label: string;
  procedure?: readonly string[];
  protocolId?: string;
};

export const KQ_PLACARD_MOBILE_MARKET_PROTOCOL_ID = "mobile-market-sale-v2";
export const KQ_PLACARD_MOBILE_EQUIPMENT_PROTOCOL_ID = "mobile-equipment-purchase-v1";

export const KQ_PLACARD_MOBILE_REVIEW_CHECKS: readonly KqPlacardMobileReviewCheck[] = [
  { code: "physical-device", label: "Test réalisé sur l’appareil physique, sans émulateur" },
  { code: "hud-readability", label: "HUD lisible sans zoom et montants non tronqués" },
  { code: "touch-navigation", label: "Navigation tactile fiable avec les profils débutant et collectionneur" },
  { code: "equipment-catalog", label: "Catalogue matériel ouvrable, défilable et refermable" },
  {
    code: "cart-controls",
    label: "Achat réel complet de matériel, panier utilisable au pouce",
    protocolId: KQ_PLACARD_MOBILE_EQUIPMENT_PROTOCOL_ID,
    procedure: [
      "Choisir un matériel compatible, non possédé et abordable, puis l’ajouter au panier.",
      "Ouvrir le panier : le tiroir doit rester clair, défilable et au-dessus du voile sombre.",
      "Valider l’achat depuis le téléphone et attendre le reçu sans retoucher l’écran.",
      "Installer le matériel depuis le reçu, puis vérifier le nouveau solde et l’inventaire du HUD.",
      "Revenir au catalogue : aucun second débit ni doublon de matériel ne doit apparaître.",
    ],
  },
  {
    code: "market-controls",
    label: "Vente réelle complète au marché, sans double paiement",
    protocolId: KQ_PLACARD_MOBILE_MARKET_PROTOCOL_ID,
    procedure: [
      "Ouvrir un lot prêt et choisir une option de vente disponible.",
      "Confirmer la vente depuis le téléphone et attendre le reçu.",
      "Vérifier le versement, la réputation gagnée et le statut vendu du lot.",
      "Retoucher une fois le bouton ou rejouer la requête : aucun second crédit ne doit être accordé.",
    ],
  },
  { code: "virtual-keyboard", label: "Clavier virtuel sans masquer recherche ni actions" },
  { code: "safe-areas", label: "Aucun contrôle sous une encoche, barre système ou zone sûre" },
  { code: "orientation", label: "Retour portrait stable après un passage en paysage" },
  { code: "outdoor-contrast", label: "Contraste et textes utilisables en forte luminosité" },
] as const;

export const KQ_PLACARD_MOBILE_REVIEW_SCHEMA = "kanab-quest-mobile-manual-review-v3";
export const KQ_PLACARD_MOBILE_REVIEW_MANIFEST_ID = "placard-mobile-manual-2x10-v3";

export type KqPlacardMobileReviewStatus = "passed" | "failed";
export type KqPlacardMobileReviewDecision = {
  status: KqPlacardMobileReviewStatus;
  reviewedAt: string;
};
export type KqPlacardMobileReviewState = Partial<Record<string, KqPlacardMobileReviewDecision>>;

export function getKqPlacardMobileReviewKey(profileCode: string, checkCode: string) {
  return `${profileCode}:${checkCode}`;
}

function isStatus(value: unknown): value is KqPlacardMobileReviewStatus {
  return value === "passed" || value === "failed";
}

function reviewKeys() {
  return KQ_PLACARD_MOBILE_REVIEW_PROFILES.flatMap((profile) => (
    KQ_PLACARD_MOBILE_REVIEW_CHECKS.map((check) => getKqPlacardMobileReviewKey(profile.code, check.code))
  ));
}

export function parseKqPlacardMobileReviewState(value: string | null): KqPlacardMobileReviewState {
  if (!value) return {};
  try {
    const source = JSON.parse(value) as unknown;
    if (!source || typeof source !== "object" || Array.isArray(source)) return {};
    const record = source as Record<string, unknown>;
    return Object.fromEntries(reviewKeys().flatMap((key) => {
      const decision = record[key];
      if (!decision || typeof decision !== "object" || Array.isArray(decision)) return [];
      const candidate = decision as Record<string, unknown>;
      return isStatus(candidate.status)
        ? [[key, {
            status: candidate.status,
            reviewedAt: typeof candidate.reviewedAt === "string" ? candidate.reviewedAt : "",
          }]]
        : [];
    }));
  } catch {
    return {};
  }
}

export function summarizeKqPlacardMobileReview(state: KqPlacardMobileReviewState) {
  const keys = reviewKeys();
  const passed = keys.filter((key) => state[key]?.status === "passed").length;
  const failed = keys.filter((key) => state[key]?.status === "failed").length;
  const pending = keys.length - passed - failed;
  const approvedProfiles = KQ_PLACARD_MOBILE_REVIEW_PROFILES.filter((profile) => (
    KQ_PLACARD_MOBILE_REVIEW_CHECKS.every((check) => (
      state[getKqPlacardMobileReviewKey(profile.code, check.code)]?.status === "passed"
    ))
  )).length;
  return {
    total: keys.length,
    passed,
    failed,
    pending,
    approvedProfiles,
    readyForLaunch: passed === keys.length,
  };
}

export function buildKqPlacardMobileReviewReport(
  state: KqPlacardMobileReviewState,
  exportedAt = new Date().toISOString(),
) {
  return {
    schema: KQ_PLACARD_MOBILE_REVIEW_SCHEMA,
    manifestId: KQ_PLACARD_MOBILE_REVIEW_MANIFEST_ID,
    exportedAt,
    summary: summarizeKqPlacardMobileReview(state),
    profiles: KQ_PLACARD_MOBILE_REVIEW_PROFILES.map((profile) => ({
      code: profile.code,
      name: profile.name,
      checks: KQ_PLACARD_MOBILE_REVIEW_CHECKS.map((check) => {
        const decision = state[getKqPlacardMobileReviewKey(profile.code, check.code)];
        return {
          code: check.code,
          label: check.label,
          protocolId: check.protocolId ?? null,
          procedure: check.procedure ?? [],
          status: decision?.status ?? "pending",
          reviewedAt: decision?.reviewedAt ?? "",
        };
      }),
    })),
  };
}

export function importKqPlacardMobileReviewReport(value: string | unknown) {
  const source = typeof value === "string" ? JSON.parse(value) as unknown : value;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw new Error("Rapport mobile humain invalide.");
  }
  const report = source as Record<string, unknown>;
  if (report.schema !== KQ_PLACARD_MOBILE_REVIEW_SCHEMA) {
    if (
      report.schema === "kanab-quest-mobile-manual-review-v1"
      || report.schema === "kanab-quest-mobile-manual-review-v2"
    ) {
      throw new Error("Preuve mobile obsolète : refais l’achat de matériel et la vente complète sur les deux téléphones puis exporte la v3.");
    }
    throw new Error("Version de rapport mobile humain non prise en charge.");
  }
  if (report.manifestId !== KQ_PLACARD_MOBILE_REVIEW_MANIFEST_ID || !Array.isArray(report.profiles)) {
    throw new Error("Le rapport ne correspond pas à la checklist mobile actuelle.");
  }
  const state: KqPlacardMobileReviewState = {};
  report.profiles.forEach((profileValue) => {
    if (!profileValue || typeof profileValue !== "object" || Array.isArray(profileValue)) return;
    const profile = profileValue as Record<string, unknown>;
    if (typeof profile.code !== "string" || !Array.isArray(profile.checks)) return;
    profile.checks.forEach((checkValue) => {
      if (!checkValue || typeof checkValue !== "object" || Array.isArray(checkValue)) return;
      const check = checkValue as Record<string, unknown>;
      if (typeof check.code !== "string") return;
      if (
        (check.code === "market-controls" && check.protocolId !== KQ_PLACARD_MOBILE_MARKET_PROTOCOL_ID)
        || (check.code === "cart-controls" && check.protocolId !== KQ_PLACARD_MOBILE_EQUIPMENT_PROTOCOL_ID)
      ) return;
      const key = getKqPlacardMobileReviewKey(profile.code as string, check.code);
      if (!reviewKeys().includes(key)) return;
      if (!isStatus(check.status)) return;
      state[key] = {
        status: check.status,
        reviewedAt: typeof check.reviewedAt === "string" ? check.reviewedAt : "",
      };
    });
  });
  return {
    state,
    restored: Object.keys(state).length,
    missing: reviewKeys().filter((key) => !state[key]).length,
  };
}
