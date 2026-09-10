export type KqLaunchApprovals = {
  seasonCalendarApproved: boolean;
  seasonPrizesApproved: boolean;
  seasonTerritoryApproved: boolean;
  collectionOddsApproved: boolean;
  publicRulesApproved: boolean;
};

export type KqLaunchPrize = {
  tierCode: "champion" | "podium" | "finalist" | "participant";
  label: string;
  quantity: number;
  stock: number;
  unitValueCents: number;
  fulfillment: string;
};

export type KqLaunchDossier = {
  parsed: boolean;
  seasonCode: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  territory: string;
  minimumAge: number;
  eligibility: string;
  prizes: KqLaunchPrize[];
  oddsVersion: string;
  publicRulesUrl: string;
  contactEmail: string;
};

export const KQ_LAUNCH_DOSSIER_ENV_KEY = "KQ_LAUNCH_DOSSIER_JSON" as const;
export const KQ_LAUNCH_ODDS_VERSION = "botte-70-24-6__heritage-equal-v1";
const KQ_REQUIRED_PRIZE_TIERS = ["champion", "podium", "finalist", "participant"] as const;

export const KQ_LAUNCH_APPROVAL_ENV_KEYS = [
  "KQ_SEASON_CALENDAR_APPROVED",
  "KQ_SEASON_PRIZES_APPROVED",
  "KQ_SEASON_TERRITORY_APPROVED",
  "KQ_COLLECTION_ODDS_APPROVED",
  "KQ_PUBLIC_RULES_APPROVED",
] as const;

function isEnabled(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

function emptyDossier(): KqLaunchDossier {
  return {
    parsed: false,
    seasonCode: "",
    startsAt: "",
    endsAt: "",
    timezone: "",
    territory: "",
    minimumAge: 0,
    eligibility: "",
    prizes: [],
    oddsVersion: "",
    publicRulesUrl: "",
    contactEmail: "",
  };
}

export function getKqLaunchDossier(
  env: Record<string, string | undefined> = process.env,
): KqLaunchDossier {
  const raw = env[KQ_LAUNCH_DOSSIER_ENV_KEY]?.trim();
  if (!raw) return emptyDossier();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return emptyDossier();
    const input = parsed as Record<string, unknown>;
    const prizes = Array.isArray(input.prizes) ? input.prizes.flatMap((prize) => {
      if (!prize || typeof prize !== "object" || Array.isArray(prize)) return [];
      const item = prize as Record<string, unknown>;
      if (!KQ_REQUIRED_PRIZE_TIERS.includes(item.tierCode as KqLaunchPrize["tierCode"])) return [];
      return [{
        tierCode: item.tierCode as KqLaunchPrize["tierCode"],
        label: typeof item.label === "string" ? item.label.trim() : "",
        quantity: Number(item.quantity),
        stock: Number(item.stock),
        unitValueCents: Number(item.unitValueCents),
        fulfillment: typeof item.fulfillment === "string" ? item.fulfillment.trim() : "",
      }];
    }) : [];
    return {
      parsed: true,
      seasonCode: typeof input.seasonCode === "string" ? input.seasonCode.trim() : "",
      startsAt: typeof input.startsAt === "string" ? input.startsAt.trim() : "",
      endsAt: typeof input.endsAt === "string" ? input.endsAt.trim() : "",
      timezone: typeof input.timezone === "string" ? input.timezone.trim() : "",
      territory: typeof input.territory === "string" ? input.territory.trim() : "",
      minimumAge: Number(input.minimumAge),
      eligibility: typeof input.eligibility === "string" ? input.eligibility.trim() : "",
      prizes,
      oddsVersion: typeof input.oddsVersion === "string" ? input.oddsVersion.trim() : "",
      publicRulesUrl: typeof input.publicRulesUrl === "string" ? input.publicRulesUrl.trim() : "",
      contactEmail: typeof input.contactEmail === "string" ? input.contactEmail.trim().toLowerCase() : "",
    };
  } catch {
    return emptyDossier();
  }
}

function isExplicitIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value));
}

function isPublicHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname.includes(".")
      && url.hostname !== "localhost"
      && !url.hostname.endsWith(".test")
      && !url.hostname.endsWith(".example");
  } catch {
    return false;
  }
}

function getKqLaunchDossierSections(dossier: KqLaunchDossier) {
  const startsAt = Date.parse(dossier.startsAt);
  const endsAt = Date.parse(dossier.endsAt);
  const durationMs = endsAt - startsAt;
  const prizeTiers = new Set(dossier.prizes.map((prize) => prize.tierCode));
  const prizesReady = dossier.prizes.length === KQ_REQUIRED_PRIZE_TIERS.length
    && prizeTiers.size === KQ_REQUIRED_PRIZE_TIERS.length
    && KQ_REQUIRED_PRIZE_TIERS.every((tier) => prizeTiers.has(tier))
    && dossier.prizes.every((prize) => (
      prize.label.length > 0
      && Number.isInteger(prize.quantity) && prize.quantity > 0
      && Number.isInteger(prize.stock) && prize.stock >= prize.quantity
      && Number.isInteger(prize.unitValueCents) && prize.unitValueCents >= 0
      && prize.fulfillment.length > 0
    ))
    && dossier.prizes.some((prize) => prize.unitValueCents > 0);
  const baseIssues = dossier.parsed ? [] : ["JSON absent ou invalide"];
  const section = (issues: string[]) => ({ ready: issues.length === 0, issues });
  return {
    calendar: section([
      ...baseIssues,
      ...(dossier.seasonCode === "KQ-2026-S1" ? [] : ["code saison KQ-2026-S1"]),
      ...(isExplicitIsoDate(dossier.startsAt) ? [] : ["date d’ouverture ISO avec fuseau"]),
      ...(isExplicitIsoDate(dossier.endsAt) ? [] : ["date de clôture ISO avec fuseau"]),
      ...(durationMs >= 24 * 60 * 60 * 1000 && durationMs <= 366 * 24 * 60 * 60 * 1000 ? [] : ["durée entre 1 et 366 jours"]),
      ...(dossier.timezone === "Europe/Paris" ? [] : ["fuseau Europe/Paris"]),
    ]),
    prizes: section([...baseIssues, ...(prizesReady ? [] : ["4 paliers, quantités, stocks, valeurs et remise"])]),
    territory: section([
      ...baseIssues,
      ...(dossier.territory.length >= 2 ? [] : ["territoire"]),
      ...(Number.isInteger(dossier.minimumAge) && dossier.minimumAge >= 18 ? [] : ["âge minimal ≥ 18"]),
      ...(dossier.eligibility.length >= 10 ? [] : ["conditions d’éligibilité"]),
    ]),
    odds: section([
      ...baseIssues,
      ...(dossier.oddsVersion === KQ_LAUNCH_ODDS_VERSION ? [] : [`version ${KQ_LAUNCH_ODDS_VERSION}`]),
    ]),
    rules: section([
      ...baseIssues,
      ...(isPublicHttpsUrl(dossier.publicRulesUrl) ? [] : ["URL publique HTTPS"]),
      ...(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dossier.contactEmail) ? [] : ["email de recours"]),
    ]),
  };
}

export function getKqLaunchDossierSectionChecks(dossier: KqLaunchDossier) {
  const sections = getKqLaunchDossierSections(dossier);
  return [
    { code: "calendar", label: "Calendrier", ...sections.calendar },
    { code: "prizes", label: "Lots", ...sections.prizes },
    { code: "territory", label: "Territoire", ...sections.territory },
    { code: "odds", label: "Probabilités", ...sections.odds },
    { code: "rules", label: "Règlement", ...sections.rules },
  ] as const;
}

export function getKqLaunchApprovals(
  env: Record<string, string | undefined> = process.env,
): KqLaunchApprovals {
  return {
    seasonCalendarApproved: isEnabled(env.KQ_SEASON_CALENDAR_APPROVED),
    seasonPrizesApproved: isEnabled(env.KQ_SEASON_PRIZES_APPROVED),
    seasonTerritoryApproved: isEnabled(env.KQ_SEASON_TERRITORY_APPROVED),
    collectionOddsApproved: isEnabled(env.KQ_COLLECTION_ODDS_APPROVED),
    publicRulesApproved: isEnabled(env.KQ_PUBLIC_RULES_APPROVED),
  };
}

export function areKqLaunchApprovalsComplete(
  approvals: KqLaunchApprovals,
  dossier: KqLaunchDossier,
) {
  return getKqLaunchApprovalChecks(approvals, dossier).every((check) => check.ready);
}

export function getKqLaunchApprovalChecks(
  approvals: KqLaunchApprovals,
  dossier: KqLaunchDossier,
) {
  const sections = getKqLaunchDossierSections(dossier);
  const detail = (section: { ready: boolean; issues: string[] }, approved: boolean) => section.ready
    ? approved ? "Dossier renseigné et décision approuvée." : "Dossier renseigné · approbation formelle en attente."
    : `À compléter : ${section.issues.join(", ")}.`;
  return [
    {
      code: "season-calendar-approved",
      label: "Dates et durée de la saison validées",
      ready: sections.calendar.ready && approvals.seasonCalendarApproved,
      detail: detail(sections.calendar, approvals.seasonCalendarApproved),
    },
    {
      code: "season-prizes-approved",
      label: "Nature, quantité et valeur des lots validées",
      ready: sections.prizes.ready && approvals.seasonPrizesApproved,
      detail: detail(sections.prizes, approvals.seasonPrizesApproved),
    },
    {
      code: "season-territory-approved",
      label: "Territoire et conditions de participation validés",
      ready: sections.territory.ready && approvals.seasonTerritoryApproved,
      detail: detail(sections.territory, approvals.seasonTerritoryApproved),
    },
    {
      code: "collection-odds-approved",
      label: "Probabilités La Botte et Héritage validées",
      ready: sections.odds.ready && approvals.collectionOddsApproved,
      detail: detail(sections.odds, approvals.collectionOddsApproved),
    },
    {
      code: "public-rules-approved",
      label: "Règlement public relu et approuvé",
      ready: sections.rules.ready && approvals.publicRulesApproved,
      detail: detail(sections.rules, approvals.publicRulesApproved),
    },
  ] as const;
}
