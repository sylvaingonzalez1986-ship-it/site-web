import "server-only";

function isExplicitlyEnabled(raw: string | undefined): boolean {
  const normalized = raw?.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "on" || normalized === "yes";
}

export function isContestFeatureEnabledServer(): boolean {
  return isExplicitlyEnabled(process.env.CONTEST_FEATURE_ENABLED)
    && (process.env.NODE_ENV !== "production" || isExplicitlyEnabled(process.env.CONTEST_FEATURE_ALLOW_PRODUCTION));
}

export function isContestBetaAccessRestrictedServer(): boolean {
  const normalized = process.env.CONTEST_BETA_ACCESS_ENABLED?.trim().toLowerCase();
  return normalized !== "0" && normalized !== "false" && normalized !== "off" && normalized !== "no";
}
