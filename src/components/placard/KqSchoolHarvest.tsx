"use client";
import {HARVEST_CHAPTERS,HARVEST_SOURCES,HARVEST_TERMS,HARVEST_QUESTIONS,HARVEST_VERSION,HARVEST_LESSON_ALIASES} from '@/lib/kanab-quest-school-harvest';
import type {KqSchoolCurriculumData} from '@/lib/kanab-quest-school-curriculum';
import {KqSchoolCurriculum,type KqCurriculumProps} from './KqSchoolCurriculum';
import {useKqHarvestProgress} from './useKqHarvestProgress';
import {KqHarvestResults,KqHarvestLots,KqHarvestAdvice,KqHarvestTrials,KqHarvestRecords,KqHarvestPlan} from './KqHarvestTools';
import {KqHarvestWorkshop} from './KqHarvestWorkshop';
import styles from './KqSchoolHarvest.module.css';
const data:KqSchoolCurriculumData={id:'harvest',label:'Comprendre ce qui améliore vraiment une récolte',version:HARVEST_VERSION,chapters:HARVEST_CHAPTERS,sources:HARVEST_SOURCES,terms:HARVEST_TERMS,questions:HARVEST_QUESTIONS,aliases:HARVEST_LESSON_ALIASES,
 hero:{src:'/placard/school/harvest/desk-v1.webp',alt:'Atelier illustré d’observation du chanvre : échantillons de graines, fibres, tiges, balance et carnet.',title:'Que signifie une meilleure récolte ?',introduction:'Définis le résultat recherché, compare les bonnes mesures et justifie une décision. Les exemples concernent le chanvre autorisé, notamment les graines et les fibres.',caption:'Décor illustratif, sans mesure ni diagnostic botanique. Les lots et enquêtes sont des exercices fictifs.'},
 searchPlaceholder:'Matière sèche, pertes, répétitions, témoin…',quizExplanation:'Dix questions parmi trente-six : les neuf chapitres sont couverts, avec une question supplémentaire distincte dans l’un d’eux.',contextTitle:'Le contexte de la comparaison',contextLabels:{who:'Acteurs',where:'Parcelle, lot et période',uses:'Résultat recherché',transformations:'Opérations et facteurs',evidence:'Mesures et preuves',labourAndTrade:'Travail, coût et débouché'}};
export function KqSchoolHarvest(props:KqCurriculumProps){
 const progress=useKqHarvestProgress(props.ownerId);
 return <KqSchoolCurriculum {...props} data={data} progress={progress} extraTabs={[
  {id:'results',label:'Résultats recherchés',title:'Définir ce que l’on veut améliorer',render:()=> <KqHarvestResults/>},
  {id:'lots',label:'Trois lots',title:'Comparer une même grandeur',render:()=> <KqHarvestLots/>},
  {id:'records',label:'Carnet',title:'Des observations que l’on peut relire',render:()=> <KqHarvestRecords/>},
  {id:'trials',label:'Dossiers d’essai',title:'Distinguer différence et effet',render:()=> <KqHarvestTrials/>},
  {id:'plan',label:'Plan de comparaison',title:'Préparer une comparaison interprétable',render:()=> <KqHarvestPlan/>},
  {id:'advice',label:'Conseils à vérifier',title:'Éprouver l’intérêt d’un conseil',render:()=> <KqHarvestAdvice/>},
  {id:'workshop',label:'Atelier final',title:'Enquêter sur une baisse de qualité',render:()=> <KqHarvestWorkshop key={props.ownerId||'guest'} storageKey={`harvest-case:${props.ownerId||'guest'}:${HARVEST_VERSION}`} onOtherCourse={props.onOtherCourse}/>},
 ]} replaceLessonVisual renderVisual={lesson=>lesson.id==='harvest-outcomes-1'?<KqHarvestResults/>:lesson.id==='harvest-outcomes-2'||lesson.id.startsWith('harvest-units-')||lesson.id.startsWith('harvest-tradeoffs-')?<KqHarvestLots/>:lesson.id.startsWith('harvest-records-')||lesson.id==='harvest-limits-2'?<KqHarvestRecords/>:lesson.id==='harvest-trials-2'?<KqHarvestPlan/>:lesson.id.startsWith('harvest-trials-')||lesson.id.startsWith('harvest-before-after-')?<KqHarvestTrials/>:lesson.id.startsWith('harvest-handling-')||lesson.id==='harvest-tips-1'?<KqHarvestAdvice/>:null}
 renderActivity={(lesson,activityProps)=>lesson.id==='harvest-tips-2'?<KqHarvestWorkshop key={activityProps.storageKey} {...activityProps} onOtherCourse={props.onOtherCourse}/>:undefined}
 renderLessonTail={()=><div className={styles.links}><button type="button" onClick={()=>props.onPassageChange('harvest-lots')}>Comparer les trois lots</button><button type="button" onClick={()=>props.onPassageChange('harvest-advice')}>Examiner un conseil</button><button type="button" onClick={()=>props.onPassageChange('harvest-tips-2')}>Rejoindre l’atelier final</button></div>}/>;
}
