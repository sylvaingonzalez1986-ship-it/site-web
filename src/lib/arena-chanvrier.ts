export const CHANVRIER_STRENGTHS = [
  { code: "green-thumb", name: "Main Verte", stage: "Culture", badge: "+4 XP / culture", description: "Commence chaque culture avec 4 XP supplémentaires. Le bonus de rareté de ton Buddie s’ajoute toujours." },
  { code: "treasurer", name: "Trésorier", stage: "Installation", badge: "2 000 € au départ", description: "Commence avec 2 000 € de trésorerie au lieu de 350 €. Tu reçois 1 650 € supplémentaires une seule fois, même si ton aventure a déjà commencé." },
  { code: "merchant", name: "Commercial", stage: "Vente", badge: "Ventes ×2", description: "Deux fois plus de capacité en ligne et en boutique. Les bonnes ventes recrutent deux fois plus vite, jusqu’à 10 clients et 2 boutiques par cycle. La qualité reste essentielle." },
  { code: "handyperson", name: "Bricoleur", stage: "Transformation", badge: "Réparations offertes", description: "Remets gratuitement tes machines en route lorsqu’elles sont usées. Leur entretien reste nécessaire tous les 10 à 20 cycles." },
] as const;
export type ChanvrierStrength = typeof CHANVRIER_STRENGTHS[number]["code"];
export const CHANVRIER_CLOTHES = [
  { code: "teal", name: "Vert atelier", color: "#087f7c" }, { code: "blue", name: "Bleu de travail", color: "#2866ce" },
  { code: "ochre", name: "Ocre solaire", color: "#c89536" }, { code: "berry", name: "Bordeaux", color: "#a34c68" },
  { code: "sage", name: "Vert sauge", color: "#7c9560" }, { code: "violet", name: "Violet", color: "#8161af" },
] as const;
export const CHANVRIER_SKINS = [
  { code: "ivory", name: "Ivoire", color: "#f7d9bb" }, { code: "peach", name: "Pêche", color: "#eeb889" },
  { code: "honey", name: "Miel", color: "#c99060" }, { code: "copper", name: "Cuivré", color: "#ac714b" },
  { code: "brown", name: "Brun", color: "#815034" }, { code: "ebony", name: "Ébène", color: "#533628" },
] as const;
export type ChanvrierProfile = {
  nickname: string; gender: "male" | "female";
  clothing: typeof CHANVRIER_CLOTHES[number]["code"]; skin: typeof CHANVRIER_SKINS[number]["code"];
  strength: ChanvrierStrength;
};
export function parseChanvrierProfile(value: unknown): ChanvrierProfile | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.nickname !== "string" || !/^[A-Za-z0-9._-]{3,24}$/.test(row.nickname.trim())
    || !["male", "female"].includes(String(row.gender))
    || !CHANVRIER_CLOTHES.some(choice => choice.code === row.clothing)
    || !CHANVRIER_SKINS.some(choice => choice.code === row.skin)
    || !CHANVRIER_STRENGTHS.some(choice => choice.code === row.strength)) return null;
  return { nickname: row.nickname.trim(), gender: row.gender, clothing: row.clothing, skin: row.skin, strength: row.strength } as ChanvrierProfile;
}
export function getChanvrierStartingXp(strength?: ChanvrierStrength | null) { return strength === "green-thumb" ? 4 : 0; }
export function getChanvrierSalesMultiplier(strength?: ChanvrierStrength | null) { return strength === "merchant" ? 2 : 1; }
