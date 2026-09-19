export const CHANVRIER_STRENGTHS = [
  { code: "green-thumb", name: "Main Verte", stage: "Culture", badge: "+2 XP / culture", description: "Commence chaque culture avec 2 XP supplémentaires. Le bonus de rareté de ton Buddie s’ajoute toujours." },
  { code: "treasurer", name: "Trésorier", stage: "Installation", badge: "1 000 € + livret à 5 %", description: "Commence avec 1 000 € de monnaie de jeu au lieu de 350 € : un bonus unique de 650 €. Accède au livret d’épargne et place ton argent à 5 % par tranche complète de 24 h." },
  { code: "merchant", name: "Commercial", stage: "Vente", badge: "Ventes ×1,5", description: "Vends 50 % de volume en plus en ligne et en boutique, et gagne 50 % de plus à quantité égale sur tous les canaux. Le grossiste reprend déjà tout ton stock. La qualité reste essentielle." },
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
export const CHANVRIER_APPEARANCE_OPTIONS = {
  hair: [{ code: "crop", name: "Court" }, { code: "quiff", name: "Banane" }, { code: "bob", name: "Carré" }, { code: "long", name: "Long" }, { code: "curls", name: "Boucles" }, { code: "afro", name: "Afro" }, { code: "braids", name: "Tresses" }, { code: "bun", name: "Chignon" }, { code: "ponytail", name: "Queue de cheval" }, { code: "mohawk", name: "Crête" }, { code: "buzz", name: "Rasé court" }, { code: "bald", name: "Sans cheveux" }],
  hairColor: [{ code: "black", name: "Noir", color: "#29232b" }, { code: "chestnut", name: "Châtain", color: "#694432" }, { code: "blond", name: "Blond", color: "#dfb85f" }, { code: "ginger", name: "Roux", color: "#b95632" }, { code: "silver", name: "Argent", color: "#c3cbd2" }, { code: "pink", name: "Rose", color: "#ce658b" }, { code: "indigo", name: "Indigo", color: "#6765ae" }, { code: "mint", name: "Menthe", color: "#58a68e" }],
  face: [{ code: "oval", name: "Ovale" }, { code: "round", name: "Rond" }, { code: "square", name: "Carré" }, { code: "heart", name: "Cœur" }, { code: "long", name: "Allongé" }, { code: "angular", name: "Anguleux" }],
  eyes: [{ code: "almond", name: "Amande" }, { code: "round", name: "Ronds" }, { code: "relaxed", name: "Détendus" }, { code: "bright", name: "Grands" }],
  eyeColor: [{ code: "brown", name: "Noisette", color: "#78452c" }, { code: "blue", name: "Bleu", color: "#3986b2" }, { code: "green", name: "Vert", color: "#528354" }, { code: "grey", name: "Gris", color: "#818295" }],
  eyebrows: [{ code: "natural", name: "Naturels" }, { code: "thick", name: "Épais" }, { code: "arched", name: "Arquées" }],
  nose: [{ code: "small", name: "Fin" }, { code: "round", name: "Rond" }, { code: "wide", name: "Large" }],
  mouth: [{ code: "smile", name: "Sourire" }, { code: "grin", name: "Grand sourire" }, { code: "calm", name: "Serein" }],
  facialHair: [{ code: "none", name: "Sans barbe" }, { code: "stubble", name: "Barbe courte" }, { code: "beard", name: "Barbe longue" }, { code: "moustache", name: "Moustache" }],
  top: [{ code: "overalls", name: "Salopette" }, { code: "tee", name: "T-shirt" }, { code: "hoodie", name: "Sweat à capuche" }, { code: "jacket", name: "Veste" }, { code: "shirt", name: "Chemise" }, { code: "apron", name: "Tablier" }],
  bottom: [{ code: "jeans", name: "Jean" }, { code: "cargo", name: "Cargo" }, { code: "shorts", name: "Short" }, { code: "skirt", name: "Jupe" }],
  bottomColor: CHANVRIER_CLOTHES,
  shoes: [{ code: "boots", name: "Bottes" }, { code: "sneakers", name: "Baskets" }, { code: "high-tops", name: "Montantes" }, { code: "work", name: "Chaussures de travail" }],
  shoeColor: CHANVRIER_CLOTHES,
  accessory: [{ code: "none", name: "Aucun" }, { code: "glasses", name: "Lunettes" }, { code: "round-glasses", name: "Lunettes rondes" }, { code: "earrings", name: "Boucles d’oreilles" }, { code: "scarf", name: "Foulard" }],
} as const;
export type ChanvrierAppearance = { [K in keyof typeof CHANVRIER_APPEARANCE_OPTIONS]: typeof CHANVRIER_APPEARANCE_OPTIONS[K][number]["code"] };
export const DEFAULT_CHANVRIER_APPEARANCE: ChanvrierAppearance = {
  hair: "crop", hairColor: "chestnut", face: "oval", eyes: "almond", eyeColor: "brown", eyebrows: "natural", nose: "small", mouth: "smile", facialHair: "none",
  top: "overalls", bottom: "jeans", bottomColor: "blue", shoes: "boots", shoeColor: "ochre", accessory: "none",
};
export function getChanvrierAppearance(profile: { gender: "male" | "female"; appearance?: ChanvrierAppearance }): ChanvrierAppearance {
  return { ...DEFAULT_CHANVRIER_APPEARANCE, hair: profile.gender === "female" ? "bob" : "crop", ...profile.appearance };
}
export type ChanvrierProfile = {
  nickname: string; gender: "male" | "female";
  clothing: typeof CHANVRIER_CLOTHES[number]["code"]; skin: typeof CHANVRIER_SKINS[number]["code"];
  strength: ChanvrierStrength;
  appearance?: ChanvrierAppearance;
};
export type ChanvrierAvatarProfile = Pick<ChanvrierProfile, "gender" | "clothing" | "skin" | "appearance">;

export function parseChanvrierProfile(value: unknown): ChanvrierProfile | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.nickname !== "string" || !/^[A-Za-z0-9._-]{3,24}$/.test(row.nickname.trim())
    || !["male", "female"].includes(String(row.gender))
    || !CHANVRIER_CLOTHES.some(choice => choice.code === row.clothing)
    || !CHANVRIER_SKINS.some(choice => choice.code === row.skin)
    || !CHANVRIER_STRENGTHS.some(choice => choice.code === row.strength)) return null;
  const profile = { nickname: row.nickname.trim(), gender: row.gender, clothing: row.clothing, skin: row.skin, strength: row.strength } as ChanvrierProfile;
  if (row.appearance !== undefined) {
    if (!row.appearance || typeof row.appearance !== "object" || Array.isArray(row.appearance)) return null;
    const values = row.appearance as Record<string, unknown>;
    const appearance = getChanvrierAppearance(profile);
    for (const key of Object.keys(CHANVRIER_APPEARANCE_OPTIONS) as (keyof ChanvrierAppearance)[]) {
      if (values[key] === undefined) continue;
      if (!CHANVRIER_APPEARANCE_OPTIONS[key].some(choice => choice.code === values[key])) return null;
      Object.assign(appearance, { [key]: values[key] });
    }
    profile.appearance = appearance;
  }
  return profile;
}
export function getChanvrierStartingXp(strength?: ChanvrierStrength | null) { return strength === "green-thumb" ? 2 : 0; }
export function getChanvrierSalesMultiplier(strength?: ChanvrierStrength | null) { return strength === "merchant" ? 1.5 : 1; }
