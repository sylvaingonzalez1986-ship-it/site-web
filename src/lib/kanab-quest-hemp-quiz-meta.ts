import type { HempQuizTopic } from './kanab-quest-hemp-quiz-types';
export const HEMP_QUIZ_BANK_SIZE = 360;
// Editorial revision only. Stored tournament plans keep their original questions.
export const HEMP_QUIZ_BANK_REVISION = '2026-11-14.hemp360';
export const HEMP_QUIZ_TOPICS: readonly Readonly<{ id: HempQuizTopic; title: string }>[] = [
  { id: 'plant', title: 'La plante' }, { id: 'genetics', title: 'Variétés et génétique' },
  { id: 'molecules', title: 'Arômes et terpènes' }, { id: 'evidence', title: 'Cannabinoïdes' },
  { id: 'seeds', title: 'Graines et alimentation' }, { id: 'profiles', title: 'Fibres et matériaux' },
  { id: 'uses', title: 'Sol et racines' }, { id: 'biodiversity', title: 'Santé du chanvre' },
  { id: 'prevention', title: 'Culture et récolte' },
  { id: 'history', title: 'Histoire et anecdotes' },
];
export const HEMP_QUIZ_LEVELS = [
  { id: 1, label: 'Facile', description: 'Les bases du chanvre.' },
  { id: 2, label: 'Intermédiaire', description: 'Les organes, les matières et leurs fonctions.' },
  { id: 3, label: 'Difficile', description: 'Les particularités de la plante et de ses composés.' },
  { id: 4, label: 'Expert', description: 'Des connaissances précises sur le chanvre.' },
] as const;
