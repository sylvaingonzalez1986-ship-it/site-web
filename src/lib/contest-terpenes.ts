export type ContestTerpeneOption = {
  code: string;
  label: string;
  description: string;
};

export const CANNABIS_TERPENE_OPTIONS: ContestTerpeneOption[] = [
  { code: "beta-myrcene", label: "Myrcene", description: "Terreux, musque, fruit mur." },
  { code: "limonene", label: "Limonene", description: "Citron, orange, agrumes lumineux." },
  { code: "beta-caryophyllene", label: "Beta-caryophyllene", description: "Poivre noir, girofle, epices seches." },
  { code: "alpha-humulene", label: "Humulene", description: "Houblon, bois sec, herbe." },
  { code: "alpha-pinene", label: "Alpha-pinene", description: "Pin, foret, resine fraiche." },
  { code: "beta-pinene", label: "Beta-pinene", description: "Pin, herbes aromatiques, bois frais." },
  { code: "linalool", label: "Linalool", description: "Lavande, floral, doux." },
  { code: "terpinolene", label: "Terpinolene", description: "Floral, fruit frais, herbes." },
  { code: "ocimene", label: "Ocimene", description: "Fruite, floral, herbe fraiche." },
  { code: "alpha-bisabolol", label: "Bisabolol", description: "Doux, floral, proche de la camomille." },
  { code: "borneol", label: "Borneol", description: "Camphre, menthe, fraicheur nette." },
  { code: "camphene", label: "Camphene", description: "Sapin, camphre, resine." },
  { code: "eucalyptol", label: "Eucalyptol", description: "Eucalyptus, menthe, souffle frais." },
  { code: "geraniol", label: "Geraniol", description: "Rose, floral, fruit doux." },
  { code: "nerolidol", label: "Nerolidol", description: "Bois, fleur blanche, cire." },
  { code: "caryophyllene-oxide", label: "Caryophyllene oxide", description: "Epice, bois sec, note propre." },
  { code: "valencene", label: "Valencene", description: "Orange, pamplemousse, bois doux." },
];

export const CANNABIS_TERPENE_CODES = new Set(CANNABIS_TERPENE_OPTIONS.map((terpene) => terpene.code));

const CANNABIS_TERPENE_ALIASES: Record<string, string> = {
  myrcene: "beta-myrcene",
  caryophyllene: "beta-caryophyllene",
  humulene: "alpha-humulene",
  bisabolol: "alpha-bisabolol",
};

export function normalizeContestTerpene(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "-").replace(/_/g, "-");
  return CANNABIS_TERPENE_ALIASES[normalized] ?? normalized;
}
