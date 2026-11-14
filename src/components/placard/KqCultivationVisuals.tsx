"use client";
import Image from 'next/image';
import { useState } from 'react';
import { Sun, Leaf, Droplets, Lightbulb, CloudRain, Wrench } from 'lucide-react';
import { CULTIVATION_ENVIRONMENTS, CULTIVATION_MEDIA, CULTIVATION_HOTSPOTS } from '@/lib/kanab-quest-school-cultivation-visuals';
import { KqHistorySources } from './KqHistorySources';
import styles from './KqSchoolCultivation.module.css';

export function KqCultivationAxes() {
  const [environment,setEnvironment] = useState('greenhouse');
  const [medium,setMedium] = useState('substrate');
  return <section className={styles.tools} data-cultivation-axes>
    <div className={styles.axes}>
      <fieldset><legend>1. Où se trouve la plante ?</legend><div className={styles.axisOptions}>{CULTIVATION_ENVIRONMENTS.map(item=><button key={item.id} type="button" data-environment={item.id} aria-pressed={environment===item.id} onClick={()=>setEnvironment(item.id)}><strong>{item.label}</strong><small>{item.detail}</small></button>)}</div></fieldset>
      <fieldset><legend>2. Dans quoi sont les racines ?</legend><div className={styles.axisOptions}>{CULTIVATION_MEDIA.map(item=><button key={item.id} type="button" data-medium={item.id} aria-pressed={medium===item.id} onClick={()=>setMedium(item.id)}><strong>{item.label}</strong><small>{item.detail}</small></button>)}</div></fieldset>
    </div>
    <div className={styles.selection} role="status"><strong>{CULTIVATION_ENVIRONMENTS.find(item=>item.id===environment)?.label} + {CULTIVATION_MEDIA.find(item=>item.id===medium)?.label}</strong><p>Le premier choix ne détermine pas le second. Cette combinaison conceptuelle n’est ni une recommandation ni une preuve de viabilité.</p>{environment==='indoor'&&medium==='soil'?<p>Un local construit au-dessus d’un sol en place peut conserver la pleine terre. Un bac rempli de terre reste un volume séparé : son contenu ne suffit pas à le classer en pleine terre.</p>:null}{environment==='outdoor'&&medium==='water'?<p>Un système hors-sol exposé à l’extérieur doit aussi tenir compte de la pluie, des variations thermiques et des interruptions de service.</p>:null}</div>
    <p className={styles.caption}>« Hydroponie » peut inclure des systèmes avec substrat selon les auteurs. Ici, on décrit séparément le support racinaire, l’apport de solution et sa récupération.</p>
  </section>;
}

export function KqCultivationGreenhouse() {
  const [active,setActive] = useState<string>('plants');
  const point=CULTIVATION_HOTSPOTS.find(item=>item.id===active) ?? CULTIVATION_HOTSPOTS[0];
  return <section className={styles.tools} data-cultivation-greenhouse>
    <p>Explore six repères. Certains apportent de la vapeur ; d’autres redistribuent l’air, récupèrent l’eau ou portent de la condensation.</p>
    <figure>
      <div className={styles.scene}>
        <Image src="/placard/school/cultivation/greenhouse-v1.webp" width={1536} height={1024} sizes="(max-width:760px) 95vw, 1000px" alt="Serre pédagogique de chanvre : plantes en pots et en bac, vitre avec gouttes, ouvrant de toit, ventilateur intérieur, flaque au sol et cuve extérieure." unoptimized/>
        {CULTIVATION_HOTSPOTS.map((item,index)=><button className={styles.marker} style={{left:`${item.x}%`,top:`${item.y}%`}} key={item.id} data-greenhouse-point={item.id} type="button" aria-label={`${index+1}. ${item.label}`} aria-pressed={active===item.id} onClick={()=>setActive(item.id)}>{index+1}</button>)}
        {active==='glass'?<span className={styles.droplet} aria-hidden/>:null}
      </div>
      <figcaption className={styles.caption}>Illustration de synthèse dans la direction du Quartier. Les gouttes sont illustratives. Le bac ne permet pas de savoir si les racines touchent le sol du lieu ; aucune installation réelle n’est diagnostiquée.</figcaption>
    </figure>
    <div className={styles.choices} role="group" aria-label="Repères de la serre">{CULTIVATION_HOTSPOTS.map((item,index)=><button key={item.id} type="button" aria-pressed={active===item.id} onClick={()=>setActive(item.id)}>{index+1} · {item.label}</button>)}</div>
    <div className={styles.detail} role="status" data-greenhouse-detail={point.id}><h4>{point.label}</h4><strong>{point.role}</strong><p>{point.text}</p><p><strong>À examiner :</strong> {point.question}</p></div>
    <KqHistorySources ids={point.sourceIds}/>
  </section>;
}

export function KqCultivationLight() {
  return <figure className={styles.tools}><figcaption>Une source d’énergie, plusieurs contraintes</figcaption><div className={styles.diagram}>
    <div><Sun aria-hidden/><strong>Lumière naturelle</strong><p>Disponibilité liée au lieu, à la saison, aux nuages et à la couverture.</p></div>
    <div><Lightbulb aria-hidden/><strong>Lumière artificielle</strong><p>Apport pilotable, avec consommation électrique et chaleur à prendre en compte.</p></div>
    <div><Leaf aria-hidden/><strong>Photosynthèse</strong><p>La plante utilise l’énergie lumineuse pour fabriquer de la matière organique à partir de CO₂ et d’eau.</p></div>
  </div><p className={styles.caption}>Recevoir davantage de lumière ne garantit pas une augmentation proportionnelle de la croissance : les autres ressources et les limites biologiques comptent.</p></figure>;
}

export function KqCultivationResources() {
  return <figure className={styles.tools}><figcaption>Suivre les flux et le travail</figcaption><div className={styles.diagram}>
    <div><CloudRain aria-hidden/><strong>Entrées</strong><p>Pluie utile, prélèvements d’eau, énergie, matériaux.</p></div>
    <div><Droplets aria-hidden/><strong>Destinations</strong><p>Plante, évaporation, stockage, drainage et récupération : les volumes ne sont pas interchangeables.</p></div>
    <div><Wrench aria-hidden/><strong>Surveillance</strong><p>Observer, entretenir, réparer et gérer les pertes mobilise des compétences et du temps.</p></div>
  </div><p className={styles.caption}>Récupérer une partie d’un flux ne supprime ni tous les besoins ni tous les rejets. Un circuit commun peut aussi diffuser un problème.</p></figure>;
}
