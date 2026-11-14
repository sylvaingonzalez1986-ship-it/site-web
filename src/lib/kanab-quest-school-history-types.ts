import type { KqSchoolQuestion, KqSchoolSource } from "./kanab-quest-school-content";

export type HistoryEvidence = "observation" | "interpretation" | "experiment" | "clinical" | "tradition" | "fiction" | "law";
export type HistoryRegion = "global" | "central-asia" | "east-asia" | "south-asia" | "middle-east" | "africa" | "europe" | "brittany" | "americas";
export type HistoryUse = "plant" | "fibre" | "food" | "ritual" | "medicine" | "science" | "policy" | "industry";
export type HistorySource = KqSchoolSource & Readonly<{
  author: string; published: string; passage: string;
  access: "full-text" | "abstract" | "catalogue" | "official-page" | "excerpt" | "unavailable";
  documentKind: string; limitation: string;
}>;
export type HistoryBlock = Readonly<{ text: string; evidence: HistoryEvidence; sourceIds: readonly string[] }>;
export type HistoryChoice = Readonly<{ id: string; text: string; correct: boolean; feedback: string }>;
export type HistoryStep = Readonly<{ id: string; prompt: string; choices: readonly HistoryChoice[]; reasonPrompt?: string; reasons?: readonly HistoryChoice[]; sourceIds: readonly string[] }>;
export type HistoryActivity = Readonly<{
  id: string; kind: "dossier" | "order" | "matching" | "documents" | "chronology" | "choice" | "diagram";
  title: string; evaluates: string; scenario: string; fictional: boolean;
  documents?: readonly Readonly<{ title: string; text: string; sourceIds: readonly string[]; status: string }>[];
  steps: readonly HistoryStep[]; takeaway: string;
}>;
export type HistoryVisual = Readonly<{
  kind: "evidence" | "chain" | "dates" | "comparison";
  title: string; nodes: readonly Readonly<{ label: string; detail: string }>[];
  caption: string; sourceIds: readonly string[];
}>;
export type HistoryLesson = Readonly<{
  id: string; title: string; question: string; objective: string; minutes: number;
  essential: readonly HistoryBlock[]; example: HistoryBlock; deeper: readonly HistoryBlock[];
  visual: HistoryVisual; activity: HistoryActivity;
  glossaryIds: readonly string[]; relatedLessonIds: readonly string[];
  nextQuestion: string; buddyCodes?: readonly string[];
}>;
export type HistoryChapter = Readonly<{
  id: string; number: number; title: string; introduction: string;
  context: Readonly<{ who: string; where: string; uses: string; transformations: string; evidence: string; labourAndTrade: string }>;
  lessons: readonly HistoryLesson[]; checkpoint: HistoryActivity;
}>;
export type HistoryEvent = Readonly<{
  id: string; title: string; startYear: number; endYear?: number; dateLabel: string;
  dateKind: "object" | "event" | "publication" | "effective-law";
  region: HistoryRegion; uses: readonly HistoryUse[]; evidence: HistoryEvidence;
  summary: string; uncertainty: string; sourceIds: readonly string[]; lessonId: string;
}>;
export type HistoryRoute = Readonly<{
  id: string; title: string; from: Readonly<{ label: string; lon: number; lat: number }>;
  to: Readonly<{ label: string; lon: number; lat: number }>;
  period: string; region: HistoryRegion; uses: readonly HistoryUse[];
  certainty: "documented-link" | "hypothesis";
  explanation: string; limitation: string; sourceIds: readonly string[]; lessonId: string;
}>;
export type HistoryTerm = Readonly<{ id: string; term: string; definition: string; sourceIds: readonly string[]; lessonIds: readonly string[] }>;
export type HistoryQuizQuestion = KqSchoolQuestion & Readonly<{ chapterId: string }>;
export type HistoryAnswer = Readonly<{ correctOptionId: string; explanation: string; optionExplanations: Readonly<Record<string, string>> }>;
