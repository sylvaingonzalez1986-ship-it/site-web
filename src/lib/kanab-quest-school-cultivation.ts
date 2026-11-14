import { CULTIVATION_CHAPTERS, CULTIVATION_LESSON_SOURCES, CULTIVATION_TERMS, CULTIVATION_QUESTIONS } from './kanab-quest-school-cultivation-lessons';
import { CULTIVATION_SYSTEM_SOURCES } from './kanab-quest-school-cultivation-systems';
import { CULTIVATION_VISUAL_SOURCES } from './kanab-quest-school-cultivation-visuals';
export { CULTIVATION_SYSTEMS, CULTIVATION_CASES, CULTIVATION_BALANCE, CULTIVATION_GUIDE, simulateCultivationScenario } from './kanab-quest-school-cultivation-systems';
export { CULTIVATION_CHAPTERS, CULTIVATION_TERMS, CULTIVATION_QUESTIONS };
export const CULTIVATION_VERSION = '2026-11-12.cultivation1';
export const VERSION = CULTIVATION_VERSION;
export const CULTIVATION_LESSONS = CULTIVATION_CHAPTERS.flatMap(chapter => chapter.lessons);
export const CULTIVATION_SOURCES = [...CULTIVATION_LESSON_SOURCES, ...CULTIVATION_SYSTEM_SOURCES, ...CULTIVATION_VISUAL_SOURCES];
export const CULTIVATION_LESSON_ALIASES: Readonly<Record<string,string>> = {
  'genetics-1':'cultivation-axes-1', 'genetics-2':'cultivation-performance-1',
  'genetics-3':'cultivation-risks-2', 'genetics-4':'cultivation-decisions-2',
};
