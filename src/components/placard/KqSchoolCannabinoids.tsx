"use client";
import { FlaskConical, Microscope, Users } from "lucide-react";
import { CANNABINOID_CHAPTERS, CANNABINOID_SOURCES, CANNABINOID_TERMS, CANNABINOID_QUESTIONS, CANNABINOID_LESSON_ALIASES, CANNABINOID_VERSION, cannabinoidCompound } from "@/lib/kanab-quest-school-cannabinoids";
import { cannabinoidStudy } from "@/lib/kanab-quest-school-cannabinoids-studies";
import type { KqSchoolCurriculumData } from "@/lib/kanab-quest-school-curriculum";
import { KqSchoolCurriculum, type KqCurriculumProps } from "./KqSchoolCurriculum";
import { useKqCannabinoidsProgress } from "./useKqCannabinoidsProgress";
import { KqCannabinoidRegister } from "./KqCannabinoidRegister";
import { KqCannabinoidEvidence } from "./KqCannabinoidEvidence";
import { KqCannabinoidNetwork } from "./KqCannabinoidNetwork";
import { KqHistorySources } from "./KqHistorySources";
import styles from "./KqSchoolCannabinoids.module.css";
const data: KqSchoolCurriculumData = {
  id:"cannabinoids", label:"Cannabinoïdes", version:CANNABINOID_VERSION, chapters:CANNABINOID_CHAPTERS, sources:CANNABINOID_SOURCES, terms:CANNABINOID_TERMS, questions:CANNABINOID_QUESTIONS, aliases:CANNABINOID_LESSON_ALIASES,
  hero:{src:"/placard/school/course-evidence-v1.webp",alt:"Planche de chanvre et documents d’observation scientifique.",title:"Des transformations aux preuves",introduction:"Explore les molécules, suis leurs transformations et apprends à distinguer un mécanisme d’un bénéfice démontré.",caption:"Illustration de synthèse de l’école ; les données et leurs limites se lisent dans le registre et les études."},
  searchPlaceholder:"CBGA, récepteur, placebo, cohorte…",quizExplanation:"Dix questions, une dans chacun des dix chapitres.",contextTitle:"Le cadre de la preuve",
  contextLabels:{who:"Objet étudié",where:"Modèle ou population",uses:"Question",transformations:"Transformations",evidence:"Preuves et limites",labourAndTrade:"Produits et interprétation"},
};
export function KqSchoolCannabinoids(props: KqCurriculumProps) {
  const progress=useKqCannabinoidsProgress(props.ownerId);
  return <KqSchoolCurriculum {...props} data={data} progress={progress} replaceLessonVisual
    extraTabs={[
      {id:"register",label:"Registre",title:"Les cannabinoïdes documentés",accepts:id=>id.startsWith("compound-")&&Boolean(cannabinoidCompound(id)),render:()=> <KqCannabinoidRegister passageId={props.focusSectionId} onPassage={props.onPassageChange}/>},
      {id:"network",label:"Réseau",title:"Des voies différentes",render:()=> <KqCannabinoidNetwork onPassage={props.onPassageChange}/>},
      {id:"evidence",label:"Preuves et études",title:"Ce que les études permettent de dire",accepts:id=>id.startsWith("study-")&&Boolean(cannabinoidStudy(id)),render:()=> <KqCannabinoidEvidence passageId={props.focusSectionId} onPassage={props.onPassageChange}/>},
    ]}
    renderVisual={lesson=>{
      if (/cannabinoids-(biosynthesis|acid-forms|aging|metabolism)-/.test(lesson.id)) return <KqCannabinoidNetwork key={lesson.id} initialProcess={lesson.id.includes("acid-forms")?"decarboxylation":lesson.id.includes("aging")?"oxidation":lesson.id.includes("metabolism")?"metabolism":"biosynthesis"} onPassage={props.onPassageChange}/>;
      if (/cannabinoids-(reading-studies|clinical-evidence)-/.test(lesson.id)) return <figure><figcaption>{lesson.visual.title}</figcaption><ol className={styles.models}><li><FlaskConical aria-hidden/><strong>Identité et mécanisme</strong><p>Molécule analysée, cible, système expérimental.</p></li><li><Microscope aria-hidden/><strong>Modèle et mesure</strong><p>Cellule, animal ou humain : vérifier ce qui est réellement mesuré.</p></li><li><Users aria-hidden/><strong>Comparaison clinique</strong><p>Population, formulation, comparateur, résultat et incertitude.</p></li></ol><button type="button" onClick={()=>props.onPassageChange("cannabinoids-evidence")}>Explorer les fiches d’études</button><KqHistorySources ids={lesson.visual.sourceIds}/></figure>;
      return undefined;
    }}
    renderLessonTail={lesson=><div className={styles.choices}><button type="button" onClick={()=>props.onPassageChange("cannabinoids-register")}>Consulter le registre</button>{lesson.id.startsWith("cannabinoids-biosynthesis")?<button type="button" onClick={()=>props.onOtherCourse("plant","botany-observation-2")}>Revoir les trichomes en Botanique</button>:null}{lesson.id.startsWith("cannabinoids-receptors")?<button type="button" onClick={()=>props.onOtherCourse("molecules","terpenes-claims-1")}>Comparer avec les discours sur les terpènes</button>:null}</div>}/>;
}
