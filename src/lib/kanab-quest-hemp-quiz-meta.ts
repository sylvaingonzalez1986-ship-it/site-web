import type { HempQuizTopic } from './kanab-quest-hemp-quiz-types';
import release from './kanab-quest-hemp-quiz-release.json';
export const HEMP_QUIZ_BANK_SIZE = release.activeCount;
// Editorial revision only. Stored tournament plans keep their original questions.
export const HEMP_QUIZ_BANK_REVISION = release.revision;
export const HEMP_QUIZ_TOPICS: readonly Readonly<{ id: HempQuizTopic; title: string }>[] = [
  { id: 'plant', title: 'La plante' }, { id: 'genetics', title: 'Variétés et génétique' },
  { id: 'molecules', title: 'Arômes et terpènes' }, { id: 'evidence', title: 'Cannabinoïdes' },
  { id: 'seeds', title: 'Graines et alimentation' }, { id: 'profiles', title: 'Fibres et matériaux' },
  { id: 'uses', title: 'Sol et racines' }, { id: 'biodiversity', title: 'Santé du chanvre' },
  { id: 'prevention', title: 'Culture et prévention' },
  { id: 'history', title: 'Histoire et anecdotes' },
];
export const HEMP_QUIZ_LEVELS = [
  { id: 1, label: 'Facile', description: 'Les repères du cannabis, du CBD et du chanvre.' },
  { id: 2, label: 'Intermédiaire', description: 'Les produits, les lignées, les composés et leurs usages.' },
  { id: 3, label: 'Difficile', description: 'Les particularités de la plante et de ses composés.' },
  { id: 4, label: 'Expert', description: 'Des connaissances précises sur le chanvre.' },
] as const;
