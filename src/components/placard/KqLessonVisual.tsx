"use client";
import Image from "next/image";
import {useState} from "react";
import {ArrowRight, Eye} from "lucide-react";
import type {HistoryVisual} from "@/lib/kanab-quest-school-history-types";
import type {KqSchoolCurriculumData} from "@/lib/kanab-quest-school-curriculum";
import {KqHistorySources} from "./KqHistorySources";
import styles from "./KqSchoolJourney.module.css";

/** A concept diagram: positions and node sizes encode no quantitative data. */
export function KqLessonVisual({visual,hero}:{visual:HistoryVisual;hero:KqSchoolCurriculumData['hero']}) {
 const [selected,setSelected]=useState(0);
 const node=visual.nodes[selected];
 const choose=(index:number)=>setSelected(index);
 return <figure className={styles.visual} data-learning-visual={visual.kind}>
  <div className={styles.visualArt}><Image src={hero.src} alt={hero.alt} width={1200} height={800} sizes="(max-width:700px) 95vw, 40vw" unoptimized/><details><summary>À propos de l’image</summary><p>{hero.caption}</p></details></div>
  <div className={styles.visualBoard}>
   <figcaption>{visual.title}</figcaption>
   <p className={styles.hint}><Eye size={16} aria-hidden/>Touche un repère pour l’explorer.</p>
   <ol className={styles.concepts} data-kind={visual.kind}>{visual.nodes.map((item,index)=><li key={index}>
    <button type="button" aria-pressed={selected===index} aria-controls="learning-node-detail" onClick={()=>choose(index)} data-learning-node={index}>
     <span className={styles.nodeNumber}>{index+1}</span><span>{item.label}</span>
    </button>
    {visual.kind==='chain'&&index<visual.nodes.length-1?<ArrowRight className={styles.connector} aria-hidden/>:null}
   </li>)}</ol>
   {node?<div id="learning-node-detail" className={styles.nodeDetail} role="status" aria-live="polite" aria-atomic="true"><strong>{node.label}</strong><p>{node.detail}</p></div>:null}
   <details className={styles.visualNotes}><summary>Lire le schéma et ses limites</summary><p>{visual.caption}</p><ul>{visual.nodes.map((item,index)=><li key={index}><strong>{item.label} :</strong> {item.detail}</li>)}</ul><KqHistorySources ids={visual.sourceIds}/></details>
  </div>
 </figure>;
}
