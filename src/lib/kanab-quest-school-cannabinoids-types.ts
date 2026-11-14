import type { HistorySource } from "./kanab-quest-school-history-types";

export type CannabinoidFamily = "thc" | "cbd" | "cbg" | "cbc" | "cbn" | "thcv" | "cbdv" | "other-phyto" | "endocannabinoid" | "emerging";
export type CannabinoidForm = "acidic" | "neutral" | "lipid-mediator";
export type CannabinoidOrigin = "phytocannabinoid" | "endocannabinoid" | "semisynthetic" | "synthetic";
export type CannabinoidModel = "analytical" | "plant-enzyme" | "cell" | "animal" | "human" | "surveillance";
export type CannabinoidOccurrenceStatus = "identified" | "reported-limited" | "artifact-possible" | "not-established" | "commercial-product" | "endogenous";
export type CannabinoidEvidence = Readonly<{
  statement: string;
  model: CannabinoidModel;
  limitation: string;
  sourceIds: readonly string[];
}>;
export type CannabinoidOccurrence = Readonly<{
  status: CannabinoidOccurrenceStatus;
  matrix: string;
  statement: string;
  locator: string;
  limitation: string;
  sourceIds: readonly string[];
}>;
export type CannabinoidCompound = Readonly<{
  id: string;
  name: string;
  synonyms: readonly string[];
  family: CannabinoidFamily;
  form: CannabinoidForm;
  originCategories: readonly CannabinoidOrigin[];
  identity: Readonly<{ statement: string; distinction: string; sourceIds: readonly string[] }>;
  occurrence: readonly CannabinoidOccurrence[];
  mechanisms: readonly CannabinoidEvidence[];
  humanEvidence: CannabinoidEvidence;
  risks: readonly string[];
  unknowns: readonly string[];
  studyIds: readonly string[];
  sourceIds: readonly string[];
}>;
export type CannabinoidSource = HistorySource;
export type CannabinoidCorpus = Readonly<{
  id: string;
  version: string;
  checkedAt: string;
  title: string;
  scope: string;
  inclusionRules: readonly string[];
  exclusions: readonly string[];
  limitations: readonly string[];
  sourceIds: readonly string[];
}>;
export type CannabinoidNetworkNode = Readonly<{
  id: string;
  label: string;
  compoundId?: string;
  kind: "compound" | "metabolite" | "process-context";
  detail: string;
}>;
export type CannabinoidNetworkEdge = Readonly<{
  id: string;
  from: string;
  to: string;
  kind: "biosynthesis" | "decarboxylation" | "oxidation" | "metabolism" | "commercial-conversion";
  evidenceStatus: "supported" | "proposed";
  label: string;
  explanation: string;
  limitation: string;
  sourceIds: readonly string[];
}>;
