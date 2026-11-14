"use client";
import { CULTIVATION_CHAPTERS,CULTIVATION_SOURCES,CULTIVATION_TERMS,CULTIVATION_QUESTIONS,CULTIVATION_LESSON_ALIASES,CULTIVATION_VERSION } from '@/lib/kanab-quest-school-cultivation';
import { CULTIVATION_CASES } from '@/lib/kanab-quest-school-cultivation-systems';
import type { KqSchoolCurriculumData } from '@/lib/kanab-quest-school-curriculum';
import { KqSchoolCurriculum,type KqCurriculumProps } from './KqSchoolCurriculum';
import { useKqCultivationProgress } from './useKqCultivationProgress';
import { KqCultivationAxes,KqCultivationGreenhouse,KqCultivationLight,KqCultivationResources } from './KqCultivationVisuals';
import { KqCultivationCompare,KqCultivationCases,KqCultivationBalance,KqCultivationGuide } from './KqCultivationTools';
import { KqHistorySources } from './KqHistorySources';
import styles from './KqSchoolCultivation.module.css';
const data:KqSchoolCurriculumData={
  id:'cultivation',label:'Modes de culture',version:CULTIVATION_VERSION,chapters:CULTIVATION_CHAPTERS,sources:CULTIVATION_SOURCES,terms:CULTIVATION_TERMS,questions:CULTIVATION_QUESTIONS,aliases:CULTIVATION_LESSON_ALIASES,
  hero:{src:'/placard/school/cultivation/greenhouse-v1.webp',alt:'Serre pédagogique de chanvre dans le village du Quartier.',title:'Quel système pour quel objectif ?',introduction:'Compare les compromis, explore une serre et défends un choix adapté à un dossier précis.',caption:'Illustration de synthèse. Les dossiers et le petit bilan sont fictifs ; les principes sont sourcés.'},
  searchPlaceholder:'Serre, substrat, rosée, énergie, qualité…',quizExplanation:'Dix questions couvrant les huit chapitres, avec deux questions de révision supplémentaires.',contextTitle:'Le cadre de la comparaison',
  contextLabels:{who:'Acteurs et objectif',where:'Contexte',uses:'Débouché',transformations:'Mécanismes',evidence:'Preuves et limites',labourAndTrade:'Travail et économie'},
};
export function KqSchoolCultivation(props:KqCurriculumProps) {
  const progress=useKqCultivationProgress(props.ownerId);
  return <KqSchoolCurriculum {...props} data={data} progress={progress} replaceLessonVisual extraTabs={[
    {id:'compare',label:'Comparer',title:'Deux axes, plusieurs configurations',render:()=> <KqCultivationCompare/>},
    {id:'greenhouse',label:'La serre',title:'Explorer une serre',render:()=> <KqCultivationGreenhouse/>},
    {id:'cases',label:'Dossiers',title:'Des objectifs différents',accepts:id=>CULTIVATION_CASES.some(item=>`case-${item.id}`===id),render:()=> <KqCultivationCases passageId={props.focusSectionId} onPassage={props.onPassageChange}/>},
    {id:'balance',label:'Bilan',title:'Comparer des grandeurs comparables',render:()=> <KqCultivationBalance/>},
    {id:'guide',label:'Fiche de choix',title:'Quel système pour quel objectif ?',render:()=> <KqCultivationGuide onPassage={props.onPassageChange}/>},
  ]} renderVisual={lesson=>{
    const visual=lesson.id.startsWith('cultivation-axes-')?<KqCultivationAxes/>:lesson.id.startsWith('cultivation-light-')?<KqCultivationLight/>:lesson.id.startsWith('cultivation-climate-')?<KqCultivationGreenhouse/>:lesson.id.startsWith('cultivation-resources-')||lesson.id.startsWith('cultivation-risks-')?<KqCultivationResources/>:lesson.id==='cultivation-footprint-2'?<KqCultivationBalance/>:null;
    return visual?<div>{visual}<KqHistorySources ids={lesson.visual.sourceIds}/></div>:undefined;
  }} renderLessonTail={lesson=><div className={styles.choices}><button type="button" onClick={()=>props.onOtherCourse('uses','soil-rhizosphere-1')}>Sol et racines</button><button type="button" onClick={()=>props.onPassageChange('cultivation-guide')}>Fiche de choix</button>{lesson.id.startsWith('cultivation-performance-')||lesson.id.startsWith('cultivation-decisions-')?<button type="button" onClick={()=>props.onPassageChange('cultivation-cases')}>Examiner les dossiers</button>:null}{lesson.id.startsWith('cultivation-resources-')?<button type="button" onClick={()=>props.onOtherCourse('plant','botany-anatomy-1')}>Revoir les organes en Botanique</button>:null}</div>}/>;
}
