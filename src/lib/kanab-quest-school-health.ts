import { HEALTH_CHAPTERS, HEALTH_LESSON_SOURCES, HEALTH_TERMS, HEALTH_QUESTIONS } from './kanab-quest-school-health-lessons';
import { HEALTH_ATLAS_SOURCES } from './kanab-quest-school-health-atlas';
import { HEALTH_DOCUMENT_SOURCES } from './kanab-quest-school-health-documents';
export { HEALTH_CHAPTERS, HEALTH_TERMS, HEALTH_QUESTIONS };
export { HEALTH_ATLAS_ENTRIES, HEALTH_ATLAS_CORPUS } from './kanab-quest-school-health-atlas';
export { HEALTH_PHOTOS, HEALTH_EPHY_RECORD, HEALTH_OBSERVATION_REQUESTS } from './kanab-quest-school-health-documents';
export const HEALTH_VERSION='2026-11-12.health1';
export const VERSION=HEALTH_VERSION;
export const HEALTH_LESSONS=HEALTH_CHAPTERS.flatMap(chapter=>chapter.lessons);
export const HEALTH_SOURCES=[...HEALTH_LESSON_SOURCES,...HEALTH_ATLAS_SOURCES,...HEALTH_DOCUMENT_SOURCES];
export const HEALTH_LESSON_ALIASES:Readonly<Record<string,string>>={
  'biodiversity-1':'health-causes-1','biodiversity-2':'health-allies-1',
  'biodiversity-3':'health-prevention-1','biodiversity-4':'health-ipm-1',
};
