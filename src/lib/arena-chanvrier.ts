import { CHANVRIER_WARDROBE_OPTIONS } from "./chanvrier-wardrobe-catalog";

export const CHANVRIER_OWNER_HEADER = "x-arena-chanvrier-owner";

export const CHANVRIER_STRENGTHS = [
  { code: "green-thumb", name: "Main Verte", stage: "Culture", badge: "+2 XP / culture", description: "Commence chaque culture avec 2 XP supplémentaires. Le bonus de rareté de ton Buddie s’ajoute toujours." },
  { code: "treasurer", name: "Trésorier", stage: "Installation", badge: "+650 € + livret à 5 %", description: "Reçois un bonus unique de 650 € de monnaie de jeu à la création de ton personnage. Accède au livret d’épargne et place ton argent à 5 % par tranche complète de 24 h." },
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
export const CHANVRIER_FABRICS = [
  ...CHANVRIER_CLOTHES,
  { code: "cream", name: "Écru", color: "#f6e5c7" }, { code: "navy", name: "Bleu marine", color: "#263951" },
  { code: "slate", name: "Ardoise", color: "#546472" }, { code: "coral", name: "Corail", color: "#df765a" },
  { code: "butter", name: "Bouton d’or", color: "#f1c748" }, { code: "seafoam", name: "Écume", color: "#85c5ad" },
  { code: "heather", name: "Bruyère", color: "#ad7c98" }, { code: "brick", name: "Brique", color: "#ac4939" },
  { code: "ink", name: "Encre", color: "#282c35" }, { code: "linen", name: "Lin", color: "#beae91" },
] as const;
export const CHANVRIER_FABRIC_DYES = [
  ...CHANVRIER_FABRICS,
  { code: "oat", name: "Crème", color: "#f5e3be" }, { code: "petrol", name: "Pétrole", color: "#204858" },
  { code: "cider", name: "Cidre", color: "#c78c3e" }, { code: "denim", name: "Denim", color: "#225369" },
  { code: "moor", name: "Lande", color: "#59634a" }, { code: "plum", name: "Prune", color: "#684554" },
  { code: "chestnut-burr", name: "Châtaigne", color: "#83533e" }, { code: "madder", name: "Garance", color: "#b14b42" },
] as const;
export const CHANVRIER_APPEARANCE_OPTIONS = {
  body: [{ code: "regular", name: "Classique" }, { code: "compact", name: "Menu" }, { code: "broad", name: "Robuste" }],
  hair: [{ code: "crop", name: "Court" }, { code: "quiff", name: "Banane" }, { code: "bob", name: "Carré" }, { code: "long", name: "Long" }, { code: "curls", name: "Boucles" }, { code: "afro", name: "Afro" }, { code: "braids", name: "Tresses" }, { code: "bun", name: "Chignon" }, { code: "ponytail", name: "Queue de cheval" }, { code: "mohawk", name: "Crête" }, { code: "buzz", name: "Rasé court" }, { code: "bald", name: "Sans cheveux" }, { code: "waves", name: "Ondulations" }, { code: "pixie", name: "Coupe lutin" }],
  hairColor: [{ code: "black", name: "Noir", color: "#29232b" }, { code: "chestnut", name: "Châtain", color: "#694432" }, { code: "blond", name: "Blond", color: "#dfb85f" }, { code: "ginger", name: "Roux", color: "#b95632" }, { code: "silver", name: "Argent", color: "#c3cbd2" }, { code: "pink", name: "Rose", color: "#ce658b" }, { code: "indigo", name: "Indigo", color: "#6765ae" }, { code: "mint", name: "Menthe", color: "#58a68e" }],
  face: [{ code: "oval", name: "Ovale" }, { code: "round", name: "Rond" }, { code: "square", name: "Carré" }, { code: "heart", name: "Cœur" }, { code: "long", name: "Allongé" }, { code: "angular", name: "Anguleux" }, { code: "pear", name: "Poire" }, { code: "cheeked", name: "Pommettes hautes" }],
  eyes: [{ code: "almond", name: "Amande" }, { code: "round", name: "Ronds" }, { code: "relaxed", name: "Détendus" }, { code: "bright", name: "Grands" }],
  eyeColor: [{ code: "brown", name: "Noisette", color: "#78452c" }, { code: "blue", name: "Bleu", color: "#3986b2" }, { code: "green", name: "Vert", color: "#528354" }, { code: "grey", name: "Gris", color: "#818295" }, { code: "amber", name: "Ambre", color: "#bc8541" }, { code: "hazel", name: "Olive", color: "#8e9257" }],
  eyebrows: [{ code: "natural", name: "Naturels" }, { code: "thick", name: "Épais" }, { code: "arched", name: "Arquées" }],
  nose: [{ code: "small", name: "Fin" }, { code: "round", name: "Rond" }, { code: "wide", name: "Large" }],
  mouth: [{ code: "smile", name: "Sourire" }, { code: "grin", name: "Grand sourire" }, { code: "calm", name: "Serein" }],
  facialHair: [{ code: "none", name: "Sans barbe" }, { code: "stubble", name: "Barbe courte" }, { code: "beard", name: "Barbe longue" }, { code: "moustache", name: "Moustache" }],
  ...CHANVRIER_WARDROBE_OPTIONS,
  bottomColor: CHANVRIER_FABRICS,
  shoeColor: CHANVRIER_FABRICS,
  jacketColor: CHANVRIER_FABRICS,
  headwearColor: CHANVRIER_FABRICS,
  accentColor: CHANVRIER_FABRICS,
} as const;

export type ChanvrierChoiceKey = keyof typeof CHANVRIER_APPEARANCE_OPTIONS;
export const CHANVRIER_DYE_ZONES = ["skin", "hair", "eyes", "top", "bottom", "shoes", "jacket", "headwear", "accent", "stripe"] as const;
export type ChanvrierDyeZone = typeof CHANVRIER_DYE_ZONES[number];
export type ChanvrierAppearance = {
  [K in ChanvrierChoiceKey]: typeof CHANVRIER_APPEARANCE_OPTIONS[K][number]["code"]
} & { version: 2; dyes?: Partial<Record<ChanvrierDyeZone, string>> };

export const DEFAULT_CHANVRIER_APPEARANCE: ChanvrierAppearance = {
  version: 2, body: "regular", hair: "crop", hairColor: "chestnut", face: "oval", eyes: "almond", eyeColor: "brown", eyebrows: "natural", nose: "small", mouth: "smile", facialHair: "none",
  top: "overalls", bottom: "jeans", bottomColor: "blue", shoes: "boots", shoeColor: "ochre", accessory: "none",
  headwear: "none", jacket: "none", accentColor: "cream", jacketColor: "navy", headwearColor: "cream",
};

/** Pre-customization rows have no appearance. Version 1 stored any subset of the original slots. */
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

function swatch(options: readonly { code: string; color: string }[], code: string) {
  return options.find(option => option.code === code)!.color;
}

export function getChanvrierColors(profile: ChanvrierAvatarProfile): Record<ChanvrierDyeZone, string> {
  const look = getChanvrierAppearance(profile);
  const top = look.dyes?.top ?? swatch(CHANVRIER_CLOTHES, profile.clothing);
  return {
    skin: swatch(CHANVRIER_SKINS, profile.skin), top,
    hair: swatch(CHANVRIER_APPEARANCE_OPTIONS.hairColor, look.hairColor), eyes: swatch(CHANVRIER_APPEARANCE_OPTIONS.eyeColor, look.eyeColor),
    bottom: swatch(CHANVRIER_FABRICS, look.bottomColor), shoes: swatch(CHANVRIER_FABRICS, look.shoeColor),
    jacket: swatch(CHANVRIER_FABRICS, look.jacketColor), headwear: swatch(CHANVRIER_FABRICS, look.headwearColor),
    accent: swatch(CHANVRIER_FABRICS, look.accentColor), stripe: defaultChanvrierStripe(top), ...look.dyes,
  };
}

export function defaultChanvrierStripe(topColor: string) {
  const channel = (offset: number) => {
    const srgb = parseInt(topColor.slice(offset, offset + 2), 16) / 255;
    return srgb <= .04045 ? srgb / 12.92 : ((srgb + .055) / 1.055) ** 2.4;
  };
  const lightness = channel(1) * .213 + channel(3) * .715 + channel(5) * .072;
  return lightness > .36 ? "#204858" : "#f5e3be";
}

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
    if (values.version !== undefined && values.version !== 1 && values.version !== 2) return null;
    const appearance = getChanvrierAppearance(profile);
    if (values.dyes !== undefined) {
      if (!values.dyes || typeof values.dyes !== "object" || Array.isArray(values.dyes)) return null;
      const dyes: NonNullable<ChanvrierAppearance["dyes"]> = {};
      for (const [zone, hex] of Object.entries(values.dyes)) {
        if (!CHANVRIER_DYE_ZONES.includes(zone as ChanvrierDyeZone) || typeof hex !== "string" || !/^#[0-9a-f]{6}$/i.test(hex)) return null;
        dyes[zone as ChanvrierDyeZone] = hex.toLowerCase();
      }
      if (Object.keys(dyes).length) appearance.dyes = dyes;
    }
    for (const key of Object.keys(CHANVRIER_APPEARANCE_OPTIONS) as ChanvrierChoiceKey[]) {
      if (values[key] === undefined && values.version !== 2) continue;
      if (!CHANVRIER_APPEARANCE_OPTIONS[key].some(choice => choice.code === values[key])) return null;
      Object.assign(appearance, { [key]: values[key] });
    }
    profile.appearance = appearance;
  }
  return profile;
}
export function getChanvrierStartingXp(strength?: ChanvrierStrength | null) { return strength === "green-thumb" ? 2 : 0; }
export function getChanvrierSalesMultiplier(strength?: ChanvrierStrength | null) { return strength === "merchant" ? 1.5 : 1; }
