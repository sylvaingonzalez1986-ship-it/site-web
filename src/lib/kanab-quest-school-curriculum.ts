import type { HistoryChapter, HistoryLesson, HistorySource, HistoryTerm, HistoryQuizQuestion } from "./kanab-quest-school-history-types";

export type KqSchoolCurriculumData = Readonly<{
  id: string; label: string; version: string;
  chapters: readonly HistoryChapter[]; sources: readonly HistorySource[]; terms: readonly HistoryTerm[]; questions: readonly HistoryQuizQuestion[];
  aliases: Readonly<Record<string, string>>;
  hero: Readonly<{ src: string; alt: string; title: string; introduction: string; caption: string }>;
  searchPlaceholder: string; quizExplanation: string;
  contextTitle: string; contextLabels: Readonly<Record<keyof HistoryChapter["context"], string>>;
}>;
export const foldCurriculumText = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("fr");
export function searchCurriculum(query: string, lessons: readonly HistoryLesson[], terms: readonly HistoryTerm[]) {
  const words = foldCurriculumText(query.trim()).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const candidates = [
    ...lessons.map(lesson => ({ id: lesson.id, kind: "lesson" as const, title: lesson.title, excerpt: lesson.question,
      text: [lesson.title, lesson.question, lesson.objective, ...lesson.essential.map(block => block.text), lesson.example.text, ...lesson.deeper.map(block => block.text)].join(" ") })),
    ...terms.map(term => ({ id: term.id, kind: "term" as const, title: term.term, excerpt: term.definition, text: `${term.term} ${term.definition}` })),
  ];
  return candidates.filter(item => words.every(word => foldCurriculumText(item.text).includes(word)))
    .sort((a, b) => Number(words.every(word => foldCurriculumText(b.title).includes(word))) - Number(words.every(word => foldCurriculumText(a.title).includes(word))))
    .slice(0, 30).map(({ id, kind, title, excerpt }) => ({ id, kind, title, excerpt }));
}
