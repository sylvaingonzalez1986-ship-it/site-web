function isExplicitlyDisabled(raw: string | undefined): boolean {
  const normalized = raw?.trim().toLowerCase();
  return normalized === "0" || normalized === "false" || normalized === "off";
}

export function isCmsPagesEnabledServer(): boolean {
  return !isExplicitlyDisabled(process.env.CMS_PAGES_ENABLED);
}

export function isCmsPagesEnabledClient(): boolean {
  return !isExplicitlyDisabled(process.env.NEXT_PUBLIC_CMS_PAGES_ENABLED);
}
