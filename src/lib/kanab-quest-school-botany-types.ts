import type { HistorySource } from "./kanab-quest-school-history-types";

export type BotanySource = HistorySource;
export type BotanyLineageStatus = "documented" | "breeder-claim" | "hypothesis";
export type BotanyPedigreeNode = Readonly<{ id: string; label: string; detail: string; buddyCodes?: readonly string[] }>;
export type BotanyPedigreeEdge = Readonly<{
  id: string; parentId: string; childId: string; status: BotanyLineageStatus;
  relation?: "parent" | "ancestry";
  claimant: string; period: string; explanation: string; limitation: string; sourceIds: readonly string[];
}>;
export type BotanyVarietyDossier = Readonly<{
  id: string; title: string; family: string;
  claimedOrigin: string; documentedPeriod: string; declaredBreeder: string;
  announcedParents: readonly string[]; variants: readonly string[];
  evidence: readonly string[]; unknowns: readonly string[];
  buddyCodes: readonly string[]; sourceIds: readonly string[];
  nodes: readonly BotanyPedigreeNode[]; edges: readonly BotanyPedigreeEdge[];
  lessonIds: readonly string[];
}>;
