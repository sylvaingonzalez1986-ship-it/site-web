export type ContestCannabinoidOption = {
  code: string;
  label: string;
  description: string;
};

export type ContestCannabinoidRate = {
  code: string;
  rate: number;
};

export const CANNABIS_CANNABINOID_OPTIONS: ContestCannabinoidOption[] = [
  { code: "cbd", label: "CBD", description: "Cannabinoide principal recherche pour l'equilibre et la douceur." },
  { code: "thc", label: "THC", description: "Controle de conformite: les lots concours restent sous 0,3 %." },
  { code: "cbg", label: "CBG", description: "Cannabinoide minoritaire souvent associe a un profil clair et vegetal." },
  { code: "cbc", label: "CBC", description: "Cannabinoide minoritaire qui complete le profil global de la fleur." },
  { code: "cbn", label: "CBN", description: "Cannabinoide d'oxydation, utile pour lire l'age et l'evolution de la fleur." },
  { code: "cbdv", label: "CBDV", description: "Variante proche du CBD, presente en petites quantites selon les genetics." },
  { code: "thcv", label: "THCV", description: "Variante suivie en trace dans une lecture de profil, pas dans la note." },
  { code: "cbcv", label: "CBCV", description: "Variante du CBC, rare et souvent minoritaire." },
  { code: "cbe", label: "CBE", description: "Compose secondaire issu de l'evolution naturelle des cannabinoides." },
  { code: "cbt", label: "CBT", description: "Cannabinoide secondaire, surtout utile pour une fiche laboratoire complete." },
];

export const CANNABIS_CANNABINOID_CODES = new Set(
  CANNABIS_CANNABINOID_OPTIONS.map((cannabinoid) => cannabinoid.code),
);

export function normalizeContestCannabinoid(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-").replace(/_/g, "-");
}
