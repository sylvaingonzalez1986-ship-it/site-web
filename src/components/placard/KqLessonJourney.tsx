"use client";
import {useRef,useState,type ReactNode} from "react";
import {ArrowLeft,ArrowRight,BookOpen,Check,Eye,Gamepad2} from "lucide-react";
import type {HistoryLesson} from "@/lib/kanab-quest-school-history-types";
import type {KqSchoolCurriculumData} from "@/lib/kanab-quest-school-curriculum";
import {getSchoolLearningArt} from "@/lib/kanab-quest-school-learning-art";
import {KqHistoryBlock} from "./KqHistorySources";
import {KqLessonVisual} from "./KqLessonVisual";
import styles from "./KqSchoolJourney.module.css";

type Phase='observe'|'understand'|'play';
const phases=[{id:'observe',label:'Observer',icon:Eye},{id:'understand',label:'Comprendre',icon:BookOpen},{id:'play',label:'Jouer',icon:Gamepad2}] as const;
function readPosition(key:string):{phase:Phase;idea:number}{
 try{const v=JSON.parse(sessionStorage.getItem(key)||'null');if(v&&phases.some(p=>p.id===v.phase)&&Number.isInteger(v.idea)&&v.idea>=0)return v;}catch{}
 return {phase:'observe',idea:0};
}
export function KqLessonJourney({lesson,hero,storageKey,customVisual,activity,read,busy,onRead,onNext,nextLabel}:{
 lesson:HistoryLesson;hero:KqSchoolCurriculumData['hero'];storageKey:string;customVisual?:ReactNode;activity:ReactNode;
 read:boolean;busy:boolean;onRead:()=>void;onNext:()=>void;nextLabel:string;
}){
 const [position,setPosition]=useState(()=>readPosition(storageKey));
 const [manipulate,setManipulate]=useState(false);
 const heading=useRef<HTMLDivElement>(null);
 const phase=position.phase,idea=Math.min(position.idea,Math.max(0,lesson.essential.length-1));
 const move=(next:Phase,nextIdea=idea)=>{
  const value={phase:next,idea:nextIdea};setPosition(value);
  try{sessionStorage.setItem(storageKey,JSON.stringify(value));}catch{}
  requestAnimationFrame(()=>{heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView({block:'start',behavior:'instant'});});
 };
 return <div className={styles.journey} data-learning-journey data-learning-phase={phase}>
  <nav className={styles.phaseNav} aria-label="Étapes de cette leçon">{phases.map((p,index)=><button key={p.id} type="button" aria-current={phase===p.id?'step':undefined} data-learning-phase-button={p.id} onClick={()=>move(p.id)}><p.icon size={21} aria-hidden/><span>{index+1}. {p.label}</span></button>)}</nav>
  <div ref={heading} tabIndex={-1} className={styles.stageHeading} aria-label={phase==='play'?lesson.activity.title:undefined}>{phase!=='play'?<h4>{phase==='observe'?lesson.question:'Une idée à la fois'}</h4>:null}</div>
  <section hidden={phase!=='observe'} data-learning-panel="observe">
   {customVisual?<div className={styles.visualSwitch}><button type="button" aria-pressed={!manipulate} onClick={()=>setManipulate(false)}>Les repères</button><button type="button" aria-pressed={manipulate} onClick={()=>setManipulate(true)}>Manipuler le schéma<ArrowRight size={16} aria-hidden/></button></div>:null}
   <div hidden={manipulate&&Boolean(customVisual)}><KqLessonVisual key={lesson.id} visual={lesson.visual} hero={getSchoolLearningArt(lesson,hero)}/></div>
   {customVisual?<div hidden={!manipulate} className={styles.manipulation} data-learning-manipulation>{customVisual}</div>:null}
   <div className={styles.nextAction}><button type="button" onClick={()=>move('understand')}>Comprendre ces repères<ArrowRight size={18} aria-hidden/></button></div>
  </section>
  <section hidden={phase!=='understand'} data-learning-panel="understand">
   <div className={styles.ideaProgress}><span>Idée {idea+1} / {lesson.essential.length}</span><div>{lesson.essential.map((_,index)=><button key={index} type="button" aria-label={`Lire l’idée ${index+1}`} aria-pressed={idea===index} onClick={()=>move('understand',index)}>{index+1}</button>)}</div></div>
   {lesson.essential[idea]?<div className={styles.ideaCard} data-learning-idea={idea}><KqHistoryBlock block={lesson.essential[idea]}/></div>:null}
   <div className={styles.ideaActions}><button type="button" disabled={idea===0} onClick={()=>move('understand',idea-1)}><ArrowLeft size={18} aria-hidden/>Précédente</button>{idea<lesson.essential.length-1?<button type="button" onClick={()=>move('understand',idea+1)}>Idée suivante<ArrowRight size={18} aria-hidden/></button>:<button type="button" onClick={()=>move('play')}>À toi de jouer<Gamepad2 size={18} aria-hidden/></button>}</div>
   <details className={styles.example}><summary>Voir un exemple</summary><KqHistoryBlock block={lesson.example}/></details>
   <div className={styles.readAction}><button type="button" disabled={busy||read} onClick={onRead}>{read?<Check size={17} aria-hidden/>:<BookOpen size={17} aria-hidden/>}{read?'Lecture enregistrée':'J’ai parcouru cette leçon'}</button></div>
  </section>
  <section hidden={phase!=='play'} data-learning-panel="play">
   {activity}
   <div className={styles.nextAction}><button type="button" onClick={onNext}>{nextLabel}<ArrowRight size={18} aria-hidden/></button></div>
  </section>
 </div>;
}
