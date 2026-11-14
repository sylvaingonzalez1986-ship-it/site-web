"use client";
import { HEALTH_CHAPTERS,HEALTH_SOURCES,HEALTH_TERMS,HEALTH_QUESTIONS,HEALTH_VERSION,HEALTH_LESSON_ALIASES } from '@/lib/kanab-quest-school-health';
import type { KqSchoolCurriculumData } from '@/lib/kanab-quest-school-curriculum';
import { KqSchoolCurriculum,type KqCurriculumProps } from './KqSchoolCurriculum';
import { useKqHealthProgress } from './useKqHealthProgress';
import { KqHealthAtlas,KqHealthPhotos,KqHealthEphy,KqHealthObservation,KqHealthStrategy,KqHealthEvidence } from './KqHealthTools';
import styles from './KqSchoolHealth.module.css';
const data:KqSchoolCurriculumData={id:'health',label:'Enquêter sur la santé des plantes',version:HEALTH_VERSION,chapters:HEALTH_CHAPTERS,sources:HEALTH_SOURCES,terms:HEALTH_TERMS,questions:HEALTH_QUESTIONS,aliases:HEALTH_LESSON_ALIASES,
  hero:{src:'/placard/school/course-evidence-v1.webp',alt:'Illustration pédagogique du chanvre dans le Quartier.',title:'Observer avant de conclure',introduction:'Explore les signes, demande des observations et justifie une réponse proportionnée. Certaines enquêtes se terminent par un diagnostic non confirmé.',caption:'Décor illustré du jeu. Les photographies de référence sont séparées, créditées et accompagnées de leurs limites.'},
  searchPlaceholder:'Flétrissement, racines, auxiliaire, oïdium…',quizExplanation:'Dix questions couvrent les huit chapitres, avec deux questions de révision supplémentaires.',contextTitle:'Le contexte de l’enquête',contextLabels:{who:'Qui observe ?',where:'Région et système',uses:'Objectif',transformations:'Processus',evidence:'Preuves',labourAndTrade:'Surveillance et travail'}};
const investigations=[['health-observation-1','Comparer des photographies','Décrire avant de nommer.'],['health-observation-2','Demander un indice','Choisir des observations utiles.'],['health-causes-2','Confronter les hypothèses','Accepter ce qui reste incertain.'],['health-allies-1','Auxiliaire ou ravageur ?','Examiner le stade et l’interaction.'],['health-ipm-1','Ordonner la protection intégrée','Intervenir de façon proportionnée.'],['health-ipm-2','Lire un usage autorisé','Vérifier cible, portée et restrictions.']];
export function KqSchoolHealth(props:KqCurriculumProps) {
  const progress=useKqHealthProgress(props.ownerId);
  return <KqSchoolCurriculum {...props} data={data} progress={progress} extraTabs={[
    {id:'atlas',label:'Atlas',title:'Reconnaître les indices',accepts:id=>id.startsWith('health-atlas-'),render:()=> <KqHealthAtlas passageId={props.focusSectionId} onPassage={props.onPassageChange}/>},
    {id:'photos',label:'Photographies',title:'Des documents à examiner',render:()=> <KqHealthPhotos/>},
    {id:'investigations',label:'Enquêtes',title:'Enquêter et justifier',render:open=><div className={styles.investigations}>{investigations.map(([id,title,text])=><button key={id} type="button" onClick={()=>open(id)}><strong>{title}</strong><span>{text}</span></button>)}</div>},
    {id:'authorization',label:'Usage autorisé',title:'Vérifier une fiche réglementaire',render:()=> <KqHealthEphy/>},
  ]} replaceLessonVisual renderVisual={lesson=>lesson.id==='health-observation-1'?<KqHealthPhotos/>:lesson.id==='health-causes-2'?<KqHealthPhotos initialId="experiment" ids={['rot','experiment']}/>:lesson.id==='health-pests-1'?<KqHealthPhotos initialId="aphids" ids={['aphids']}/>:lesson.id==='health-pathogens-1'?<KqHealthPhotos initialId="powdery" ids={['powdery','rot']}/>:lesson.id==='health-ipm-1'?<KqHealthStrategy/>:lesson.id==='health-ipm-2'?<KqHealthEphy/>:lesson.id==='health-causes-1'||lesson.id==='health-verification-1'?<KqHealthEvidence/>:null}
    renderActivity={(lesson,activityProps)=>lesson.id==='health-observation-2'?<KqHealthObservation key={activityProps.storageKey} lesson={lesson} {...activityProps}/>:undefined}
    renderLessonTail={()=><div className={styles.links}><button type="button" onClick={()=>props.onPassageChange('health-atlas')}>Consulter l’atlas</button><button type="button" onClick={()=>props.onOtherCourse('genetics','cultivation-climate-1')}>Humidité et condensation</button><button type="button" onClick={()=>props.onOtherCourse('plant','botany-anatomy-1')}>Racines et organes</button><button type="button" onClick={()=>props.onOtherCourse('uses','soil-nutrients-1')}>Sol et nutrition</button></div>}/>;
}
