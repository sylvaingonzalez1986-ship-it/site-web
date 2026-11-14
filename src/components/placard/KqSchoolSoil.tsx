"use client";
import {SOIL_CHAPTERS,SOIL_SOURCES,SOIL_TERMS,SOIL_QUESTIONS,SOIL_VERSION,SOIL_LESSON_ALIASES} from '@/lib/kanab-quest-school-soil';
import type {KqSchoolCurriculumData} from '@/lib/kanab-quest-school-curriculum';
import {KqSchoolCurriculum,type KqCurriculumProps} from './KqSchoolCurriculum';
import {useKqSoilProgress} from './useKqSoilProgress';
import {KqSoilCutaway,KqSoilNetwork,KqSoilCycle,KqSoilMethod} from './KqSoilVisuals';
import {KqSoilIndicators,KqSoilAnalyses,KqSoilNutrients,KqSoilInputs} from './KqSoilTools';
import styles from './KqSchoolSoil.module.css';
const data:KqSchoolCurriculumData={id:'soil',label:'Sol, racines et nutrition',version:SOIL_VERSION,chapters:SOIL_CHAPTERS,sources:SOIL_SOURCES,terms:SOIL_TERMS,questions:SOIL_QUESTIONS,aliases:SOIL_LESSON_ALIASES,
 hero:{src:'/placard/school/soil/cutaway-v1.webp',alt:'Coupe illustrée du sol sous un plant de chanvre, avec racines, pores, agrégats, résidus et faune.',title:'Comprendre le milieu des racines',introduction:'Explore le sol, relie ses propriétés et compare des analyses. Construis une décision à partir des observations et de leurs limites.',caption:'Coupe de synthèse non mesurée. Les analyses chiffrées sont des exercices fictifs.'},
 searchPlaceholder:'Structure, rhizosphère, CEC, compost…',quizExplanation:'Dix questions, une par chapitre, parmi quarante questions de synthèse.',contextTitle:'Le contexte de la décision',contextLabels:{who:'Acteurs',where:'Sol et environnement',uses:'Objectif et débouché',transformations:'Processus',evidence:'Mesures et preuves',labourAndTrade:'Travail et suivi'}};
export function KqSchoolSoil(props:KqCurriculumProps){
 const progress=useKqSoilProgress(props.ownerId);
 return <KqSchoolCurriculum {...props} data={data} progress={progress} extraTabs={[
  {id:'cutaway',label:'Coupe du sol',title:'Explorer le milieu des racines',render:()=> <KqSoilCutaway/>},
  {id:'network',label:'Relations',title:'Organismes et matière organique',render:()=> <KqSoilNetwork/>},
  {id:'indicators',label:'Indicateurs',title:'Lire une mesure et sa limite',render:()=> <KqSoilIndicators/>},
  {id:'analyses',label:'Deux analyses',title:'Comparer les méthodes avant les chiffres',render:()=> <KqSoilAnalyses/>},
  {id:'inputs',label:'Apports',title:'Comparer les fonctions recherchées',render:()=> <KqSoilInputs/>},
  {id:'method',label:'Raisonner',title:'De l’observation au suivi',render:()=> <KqSoilMethod/>},
 ]} replaceLessonVisual renderVisual={lesson=>lesson.id.startsWith('soil-physical-')||lesson.id==='soil-rhizosphere-1'?<KqSoilCutaway/>:lesson.id.startsWith('soil-life-')||lesson.id==='soil-organic-2'?<KqSoilNetwork/>:lesson.id==='soil-organic-1'?<KqSoilCycle/>:lesson.id.startsWith('soil-nutrients-')?<KqSoilNutrients/>:lesson.id.startsWith('soil-measures-')?<KqSoilIndicators compact/>:lesson.id.startsWith('soil-analysis-')?<KqSoilAnalyses/>:lesson.id.startsWith('soil-inputs-')||lesson.id.startsWith('soil-amendments-')?<KqSoilInputs/>:lesson.id==='soil-hemp-2'?<KqSoilMethod/>:null}
 renderLessonTail={lesson=><div className={styles.links}>{lesson.id.startsWith('soil-measures-')?<button type="button" onClick={()=>props.onPassageChange('soil-indicators')}>Tous les indicateurs</button>:null}<button type="button" onClick={()=>props.onPassageChange('soil-method')}>Méthode de raisonnement</button>{lesson.id.startsWith('soil-rhizosphere-')||lesson.id.startsWith('soil-physical-')?<button type="button" onClick={()=>props.onOtherCourse('plant','botany-anatomy-1')}>Revoir les organes des racines</button>:null}<button type="button" onClick={()=>props.onOtherCourse('biodiversity','health-causes-2')}>Enquêter sur un symptôme</button><button type="button" onClick={()=>props.onOtherCourse('genetics','cultivation-axes-1')}>Sol et modes de culture</button></div>}/>;
}
