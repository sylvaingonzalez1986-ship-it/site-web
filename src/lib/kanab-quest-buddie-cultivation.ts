import type { KqCannabinoidTotals } from "./kanab-quest-care";

/** Versioned game balancing only: these values do not describe real varieties. */
export type KqBuddieCultivationProfile = {
  version: 1;
  buddieCode: string;
  rarity: "common" | "silver" | "gold" | "epic" | "legendary";
  archetype: "yield" | "balanced" | "expression";
  yieldFactor: number;
  cannabinoidTargets: KqCannabinoidTotals;
  terpenePotentialPercent: number;
  terpeneNotes: [string, string];
};

const families = ["cbd", "cbg", "thc", "cbdv", "thcv", "cbc", "cbn"] as const;
const round = (value: number) => Math.round(value * 10_000) / 10_000;
const notes = ["Agrumes", "Pin", "Fruits rouges", "Bois", "Fleurs", "Épices", "Menthe", "Terre"];

/** Keep this v1 recipe immutable; future balancing requires another version.
 * Each identity has its own small variation. The three specializations exchange
 * simulated quantity for expression. Rarity adds at most 4% to either budget,
 * without changing dice, shared care, XP, or the warehouse's reserved capacity. */
function createProfile(cardNumber: number): KqBuddieCultivationProfile {
  const rarity = cardNumber === 1 ? "legendary" : cardNumber <= 4 ? "epic"
    : cardNumber <= 9 ? "gold" : cardNumber <= 19 ? "silver" : "common";
  const rank = { common: 0, silver: 1, gold: 2, epic: 3, legendary: 4 }[rarity];
  const specialization = (cardNumber - 1) % 3;
  const archetype = (["yield", "balanced", "expression"] as const)[specialization];
  const individuality = ((cardNumber * 17) % 53) / 52;
  const expression = (0.88 + specialization * 0.1 + individuality * 0.015) * (1 + rank / 100);
  return {
    version: 1,
    buddieCode: `HH2026-${String(cardNumber).padStart(3, "0")}`,
    rarity,
    archetype,
    yieldFactor: round(Math.min(1, (0.96 - specialization * 0.08 + individuality * 0.012) * (1 + rank / 100))),
    cannabinoidTargets: {
      cbd: round((9 + (cardNumber % 4) * 1.4) * expression),
      cbg: round((0.7 + ((cardNumber * 3) % 7) * 0.23) * expression),
      thc: round((0.1 + (cardNumber % 5) * 0.02) * expression),
      cbdv: round((0.12 + ((cardNumber * 5) % 9) * 0.035) * expression),
      thcv: round((0.01 + (cardNumber % 3) * 0.01) * expression),
      cbc: round((0.22 + (cardNumber % 6) * 0.035) * expression),
      cbn: 0,
    },
    terpenePotentialPercent: round((1.5 + specialization * 0.65 + individuality * 0.12) * (1 + rank / 100)),
    terpeneNotes: [notes[(cardNumber - 1) % notes.length], notes[(cardNumber + 2) % notes.length]],
  };
}

/** A fresh snapshot is returned so callers cannot mutate the catalogue. */
export function getKqBuddieCultivationProfile(code: string): KqBuddieCultivationProfile {
  if (!/^HH2026-\d{3}$/.test(code)) throw new Error("Buddie inconnu pour ce profil de simulation.");
  const cardNumber = Number(code.slice(-3));
  if (cardNumber < 1 || cardNumber > 52) throw new Error("Buddie inconnu pour ce profil de simulation.");
  return createProfile(cardNumber);
}

/** Exact v1 validation keeps imported saves from inventing stronger profiles. */
export function isKqBuddieCultivationProfile(value: unknown): value is KqBuddieCultivationProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Record<string, unknown>;
  if (profile.version !== 1 || typeof profile.buddieCode !== "string") return false;
  let expected: KqBuddieCultivationProfile;
  try { expected = getKqBuddieCultivationProfile(profile.buddieCode); } catch { return false; }
  if (!profile.cannabinoidTargets || typeof profile.cannabinoidTargets !== "object") return false;
  const targets = profile.cannabinoidTargets as Record<string, unknown>;
  return Object.keys(profile).length === Object.keys(expected).length
    && profile.rarity === expected.rarity && profile.archetype === expected.archetype
    && profile.yieldFactor === expected.yieldFactor
    && profile.terpenePotentialPercent === expected.terpenePotentialPercent
    && Array.isArray(profile.terpeneNotes) && profile.terpeneNotes.length === 2
    && profile.terpeneNotes.every((note, index) => note === expected.terpeneNotes[index])
    && Object.keys(targets).length === families.length
    && families.every(family => targets[family] === expected.cannabinoidTargets[family]);
}

/** Applied once, before the final receipt is frozen. A profile never adds mass. */
export function applyKqBuddieYield(grams: number, profile?: KqBuddieCultivationProfile): number {
  return profile ? Math.round(grams * profile.yieldFactor * 10) / 10 : grams;
}
