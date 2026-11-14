import type { HistorySource } from "./kanab-quest-school-history-types";

export type TerpeneFamily = "monoterpene-hydrocarbon" | "oxygenated-monoterpene" | "sesquiterpene-hydrocarbon" | "oxygenated-sesquiterpene" | "other";
export type TerpeneAromaFamily = "citrus" | "woody" | "floral" | "herbal" | "spicy" | "earthy" | "fruity" | "sulfurous" | "other";
export type TerpeneEvidence = Readonly<{ statement: string; locator: string; sourceIds: readonly string[] }>;
export type TerpeneIdentification = Readonly<{
  level: "reference-standard" | "ri-ms-supported" | "tentative" | "not-established";
  methods: readonly string[]; statement: string; limitations: readonly string[]; sourceIds: readonly string[];
}>;
export type TerpeneBiology = Readonly<{
  statement: string;
  model: "plant-enzyme" | "plant-ecology" | "cell" | "animal" | "human" | "analytical";
  limitations: string; sourceIds: readonly string[];
}>;
export type TerpeneCompound = Readonly<{
  id: string; name: string; synonyms: readonly string[]; isomerNotes: string; family: TerpeneFamily;
  detailLevel: "detailed" | "inventory";
  identification: TerpeneIdentification;
  cannabisEvidence: readonly TerpeneEvidence[];
  aroma: Readonly<{ description: string; families: readonly TerpeneAromaFamily[]; limitations: string; sourceIds: readonly string[] }>;
  otherPlants: readonly Readonly<{ name: string; statement: string; sourceIds: readonly string[] }>[];
  biology: readonly TerpeneBiology[];
  sourceIds: readonly string[];
}>;
export type TerpeneBuddyLink = Readonly<{
  buddyCode: string; compoundIds: readonly string[]; exactExcerpt: string;
  attribution: string; sourceIds: readonly string[]; limitation: string;
}>;
export type TerpeneCorpus = Readonly<{
  id: string; version: string; checkedAt: string; title: string; scope: string;
  inclusionRules: readonly string[]; exclusions: readonly string[]; synonymRules: readonly string[];
  limitations: readonly string[]; sourceIds: readonly string[];
}>;
export type TerpeneSource = HistorySource;
