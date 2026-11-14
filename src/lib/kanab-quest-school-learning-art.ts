import type {HistoryLesson} from './kanab-quest-school-history-types';
import type {KqSchoolCurriculumData} from './kanab-quest-school-curriculum';

/** Illustrative scenes never stand in for the sources or anatomical evidence. */
export function getSchoolLearningArt(lesson:HistoryLesson,fallback:KqSchoolCurriculumData['hero']):KqSchoolCurriculumData['hero'] {
 if(/^history-(brittany|medieval|europe)/.test(lesson.id)||lesson.id.startsWith('products-fibres'))return {...fallback,
  src:'/placard/school/learning/fibre-workshop-v1.webp',
  alt:'Atelier fictif consacré au chanvre : tiges, fibres, fil et toile, avec un port dessiné en arrière-plan.',
  caption:'Illustration de synthèse. Matières stylisées, sans échelle commune ; ni reconstitution historique de Noyal ou Locronan ni preuve de l’origine d’une toile.'};
 if(/^history-(evidence|prehistory|antiquity|scientific)/.test(lesson.id))return {...fallback,
  src:'/placard/school/learning/evidence-desk-v1.webp',
  alt:'Table d’enquête illustrée : akènes, fibres, tige, tesson, loupe, livre et microscope.',
  caption:'Décor de synthèse : catégories de preuves, objets fictifs et tailles non comparables. Aucune découverte réelle ni coupe anatomique n’est reproduite.'};
 return fallback;
}
