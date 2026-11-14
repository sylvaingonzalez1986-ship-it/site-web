"use client";
import Image from 'next/image';
import {useState} from 'react';
import {ArrowDown,ArrowUp,ArrowRight,Check} from 'lucide-react';
import {PRODUCTS_GROUPS,PRODUCTS_PLATE_POINTS,PRODUCTS_PROCESS_CARDS,PRODUCTS_LABEL_CLAIMS,PRODUCTS_IDENTITY_AXES} from '@/lib/kanab-quest-school-products-visuals';
import {PRODUCTS_FIBRE_STAGES} from '@/lib/kanab-quest-school-products-tools';
import {PRODUCTS_CHAPTERS} from '@/lib/kanab-quest-school-products-lessons';
import {KqHistorySources} from './KqHistorySources';
import styles from './KqSchoolProducts.module.css';

export function KqProductsPlate({onOpen}:{onOpen?:(id:string)=>void}) {
 const [active,setActive]=useState<string>('stem');
 const point=PRODUCTS_PLATE_POINTS.find(p=>p.id===active)??PRODUCTS_PLATE_POINTS[0];
 return <section className={styles.tool} data-products-plate><p>Pars d’une matière, puis examine ce qu’elle devient. Choisis un des six repères.</p><figure><div className={styles.scene}><Image src="/placard/school/products/plate-v1.webp" alt="Planche illustrée du chanvre : chènevis, huile et tourteau, tige et fibres, fil et tissu, chènevotte et matériau, échantillons et dossier." width={1536} height={1024} sizes="(max-width:760px) 95vw, 1100px" unoptimized/>{PRODUCTS_PLATE_POINTS.map((p,i)=><button type="button" key={p.id} data-products-point={p.id} className={styles.marker} style={{left:`${p.x}%`,top:`${p.y}%`}} aria-label={`${i+1}. ${p.label}`} aria-pressed={active===p.id} onClick={()=>setActive(p.id)}>{i+1}</button>)}</div><figcaption className={styles.caption}>Illustration de synthèse, sans échelle. Les spécimens ne prouvent ni composition, ni conformité, ni sécurité. Le brin végétal est illustratif ; il ne sert pas au diagnostic botanique.</figcaption></figure><div className={styles.choices} role="group" aria-label="Repères de la planche">{PRODUCTS_PLATE_POINTS.map((p,i)=><button type="button" key={p.id} aria-pressed={active===p.id} onClick={()=>setActive(p.id)}>{i+1} · {p.label}</button>)}</div><div className={styles.detail} role="status" data-products-point-detail={point.id}><h4>{point.label}</h4><p>{point.text}</p>{onOpen?<button type="button" onClick={()=>onOpen(point.lesson)}>Comprendre cette filière <ArrowRight size={16} aria-hidden/></button>:null}</div><KqHistorySources ids={point.sourceIds}/></section>;
}

export function KqProductsOverview({onOpen}:{onOpen:(id:string)=>void}) {
 return <><KqProductsPlate onOpen={onOpen}/><div className={styles.groups} data-products-groups>{PRODUCTS_GROUPS.map(group=><section className={styles.group} key={group.id}><h4><span>{group.letter}</span>{group.label}</h4><p><strong>{group.question}</strong></p><ul>{group.chapterIds.map(id=>{const chapter=PRODUCTS_CHAPTERS.find(c=>c.id===id);return chapter?<li key={id}><button type="button" onClick={()=>onOpen(chapter.lessons[0].id)}>{chapter.title}</button></li>:null;})}</ul><p>{group.next}</p></section>)}</div></>;
}

export function KqProductsProcesses() {
 const [active,setActive]=useState<string>('separation');
 const current=PRODUCTS_PROCESS_CARDS.find(p=>p.id===active)??PRODUCTS_PROCESS_CARDS[0];
 return <section className={styles.tool} data-products-processes><p>Ces opérations répondent à des objectifs différents. Elles peuvent se combiner ; les cartes ne représentent pas une recette ni un ordre obligatoire.</p><div className={styles.choices}>{PRODUCTS_PROCESS_CARDS.map(p=><button type="button" key={p.id} data-products-process={p.id} aria-pressed={p.id===active} onClick={()=>setActive(p.id)}>{p.title}</button>)}</div><div className={styles.detail} data-products-process-detail={current.id}><h4>{current.title}</h4><dl className={styles.facts}><div><dt>Point de départ</dt><dd>{current.input}</dd></div><div><dt>Ce qui change</dt><dd>{current.change}</dd></div><div><dt>Ce qui reste à établir</dt><dd>{current.result}</dd></div></dl><p>{current.examples}</p><p><strong>Limite :</strong> {current.limit}</p></div><KqHistorySources ids={current.sourceIds}/></section>;
}

export function KqProductsFibreChain() {
 const [active,setActive]=useState(PRODUCTS_FIBRE_STAGES[0].id);
 const [order,setOrder]=useState(()=>PRODUCTS_FIBRE_STAGES.map((_,i)=>i).reverse());
 const [checked,setChecked]=useState(false);
 const current=PRODUCTS_FIBRE_STAGES.find(p=>p.id===active)??PRODUCTS_FIBRE_STAGES[0];
 const correct=order.every((value,index)=>value===index);
 const move=(index:number,direction:number)=>{const next=[...order];[next[index],next[index+direction]]=[next[index+direction],next[index]];setOrder(next);setChecked(false);};
 return <section className={styles.tool} data-products-fibres><p>Une voie textile simplifiée. Les filières industrielles peuvent varier ; tous les produits à base de fibres ne passent pas par le tissage.</p><ol className={styles.chain}>{PRODUCTS_FIBRE_STAGES.map((stage,index)=><li key={stage.id}><button type="button" data-products-fibre-stage={stage.id} aria-pressed={active===stage.id} onClick={()=>setActive(stage.id)}><span>{index+1} · {stage.title}</span>{index<PRODUCTS_FIBRE_STAGES.length-1?<ArrowRight aria-hidden size={18}/>:<Check aria-hidden size={18}/>}</button></li>)}</ol><div className={styles.detail} data-products-fibre-detail={current.id}><h4>{current.title}</h4><dl className={styles.facts}><div><dt>Matière entrante</dt><dd>{current.input}</dd></div><div><dt>Fonction</dt><dd>{current.transformation}</dd></div><div><dt>Fractions obtenues</dt><dd>{current.outputs.join(' ; ')}</dd></div></dl><p>{current.limit}</p><details><summary>Ce qu’il faut contrôler</summary><ul>{current.controls.map(text=><li key={text}>{text}</li>)}</ul><KqHistorySources ids={current.sourceIds}/></details></div><details><summary>Reconstituer le parcours des fibres</summary><p>Remets les étapes dans l’ordre avec les flèches, au clavier ou au toucher. Cet entraînement ne verse pas de monnaie.</p><ol className={styles.order}>{order.map((value,index)=><li key={value} data-products-fibre-order={PRODUCTS_FIBRE_STAGES[value].id}><strong>{PRODUCTS_FIBRE_STAGES[value].title}</strong><div><button type="button" disabled={index===0} aria-label={`Monter : ${PRODUCTS_FIBRE_STAGES[value].title}`} onClick={()=>move(index,-1)}><ArrowUp size={18} aria-hidden/></button><button type="button" disabled={index===order.length-1} aria-label={`Descendre : ${PRODUCTS_FIBRE_STAGES[value].title}`} onClick={()=>move(index,1)}><ArrowDown size={18} aria-hidden/></button></div></li>)}</ol><button type="button" onClick={()=>setChecked(true)}>Vérifier le parcours des fibres</button>{checked?<p role="status">{correct?'Ce parcours textile est cohérent. Chaque étape a sa fonction et ses contrôles ; la matière n’est pas automatiquement adaptée au débouché.':`Repars de la préparation de la matière. Repères : ${PRODUCTS_FIBRE_STAGES.map(s=>s.title).join(' → ')}. Distingue notamment la formation du fil et l’entrecroisement des fils.`}</p>:null}</details></section>;
}

export function KqProductsLabels() {
 const [active,setActive]=useState<string>('solvent');const [revealed,setRevealed]=useState(false);
 const current=PRODUCTS_LABEL_CLAIMS.find(c=>c.id===active)??PRODUCTS_LABEL_CLAIMS[0];
 return <section className={styles.tool} data-products-labels><p>Six affirmations fictives à examiner. Le problème est le raisonnement ajouté au terme commercial.</p><div className={styles.choices}>{PRODUCTS_LABEL_CLAIMS.map((claim,index)=><button type="button" key={claim.id} data-products-claim={claim.id} aria-label={`Affirmation ${index+1}`} aria-pressed={active===claim.id} onClick={()=>{setActive(claim.id);setRevealed(false);}}>{index+1}</button>)}</div><blockquote className={styles.labelClaim}>{current.claim}</blockquote><button type="button" onClick={()=>setRevealed(!revealed)} aria-expanded={revealed}>{revealed?'Masquer l’analyse':'Examiner cette affirmation'}</button>{revealed?<div className={styles.feedback} data-products-claim-feedback={current.id}><strong>{current.conclusion}</strong><p>{current.why}</p><KqHistorySources ids={current.sourceIds}/></div>:null}</section>;
}

export function KqProductsIdentity() {
 const [active,setActive]=useState<string>('identity');const current=PRODUCTS_IDENTITY_AXES.find(p=>p.id===active)??PRODUCTS_IDENTITY_AXES[0];
 return <section className={styles.tool} data-products-identity><p>Naturel, hémisynthétique et synthétique renseignent l’origine ou la fabrication. Il faut examiner séparément ces cinq questions.</p><div className={styles.choices}>{PRODUCTS_IDENTITY_AXES.map(axis=><button type="button" key={axis.id} data-products-axis={axis.id} aria-pressed={active===axis.id} onClick={()=>setActive(axis.id)}>{axis.title}</button>)}</div><div className={styles.detail} role="status"><h4>{current.question}</h4><p>{current.limit}</p></div><KqHistorySources ids={['products-tool-hhc']}/></section>;
}
