"use client";
import { useState } from 'react';
import { CULTIVATION_SYSTEMS, CULTIVATION_CASES, CULTIVATION_BALANCE, CULTIVATION_GUIDE, simulateCultivationScenario, type CultivationAxis } from '@/lib/kanab-quest-school-cultivation-systems';
import { CULTIVATION_ENVIRONMENTS, CULTIVATION_MEDIA } from '@/lib/kanab-quest-school-cultivation-visuals';
import { KqCultivationAxes } from './KqCultivationVisuals';
import { KqHistorySources } from './KqHistorySources';
import { KqBarChart } from './KqVisuals';
import styles from './KqSchoolCultivation.module.css';

const axisLabels: Record<CultivationAxis,string> = { light:'Lumière',climate:'Climat',water:'Eau',nutrition:'Milieu racinaire',energy:'Énergie',work:'Travail et maintenance',risks:'Aléas et dépendances',quality:'Qualité mesurable',costs:'Investissement et fonctionnement',performance:'Rendement et régularité' };
const environmentLabel=(id:string)=>CULTIVATION_ENVIRONMENTS.find(item=>item.id===id)?.label ?? id;
const mediumLabel=(id:string)=>CULTIVATION_MEDIA.find(item=>item.id===id)?.label ?? id;
export function KqCultivationCompare() {
  const [left,setLeft]=useState('outdoor-soil'),[right,setRight]=useState('greenhouse-substrate');
  const systems=[CULTIVATION_SYSTEMS.find(item=>item.id===left)!,CULTIVATION_SYSTEMS.find(item=>item.id===right)!];
  return <section className={styles.tools} data-cultivation-compare>
    <KqCultivationAxes/>
    <h4>Comparer deux configurations</h4>
    <p>Chaque colonne décrit une configuration. Une serre tunnel non chauffée et une serre équipée d’un contrôle climatique ne forment pas un système unique.</p>
    <div className={styles.controls}>{(['left','right'] as const).map((side,index)=><label key={side}>Projet {index+1}<select data-compare-side={side} value={side==='left'?left:right} onChange={event=>(side==='left'?setLeft:setRight)(event.target.value)}>{CULTIVATION_SYSTEMS.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>)}</div>
    {left===right?<p role="status">Les deux colonnes décrivent le même système. Choisis une autre configuration pour comparer.</p>:null}
    <table className={styles.table}><caption>Compromis généraux ; le contexte et le cahier des charges restent déterminants.</caption><thead><tr><th scope="col">Critère</th>{systems.map((system,index)=><th scope="col" key={index}>{system.name}</th>)}</tr></thead><tbody>
      <tr><th scope="row">Deux axes</th>{systems.map((system,index)=><td key={index} data-label={system.name}>{environmentLabel(system.environment)} · {mediumLabel(system.medium)}</td>)}</tr>
      <tr><th scope="row">Configuration</th>{systems.map((system,index)=><td key={index} data-label={system.name}>{system.summary}</td>)}</tr>
      {(Object.entries(axisLabels) as [CultivationAxis,string][]).map(([axis,label])=><tr key={axis}><th scope="row">{label}</th>{systems.map((system,index)=><td key={index} data-label={system.name}>{system.traits[axis]}</td>)}</tr>)}
    </tbody></table>
    <div className={styles.facts}>{systems.map((system,index)=><div key={index}><h4>{system.name}</h4><details><summary>Atouts possibles et conditions</summary><ul>{system.advantages.map(text=><li key={text}>{text}</li>)}</ul></details><details><summary>Limites à examiner</summary><ul>{system.constraints.map(text=><li key={text}>{text}</li>)}</ul></details><KqHistorySources ids={system.sourceIds}/></div>)}</div>
  </section>;
}

export function KqCultivationCases({passageId,onPassage}:{passageId?:string;onPassage:(id:string)=>void}) {
  const dossier=CULTIVATION_CASES.find(item=>`case-${item.id}`===passageId);
  const fitLabels={coherent:'Choix cohérent',conditional:'Sous conditions', 'poor-fit':'Peu cohérent dans ce dossier'};
  return <section className={styles.tools} data-cultivation-cases>
    {dossier?<><button type="button" onClick={()=>onPassage('cultivation-cases')}>Tous les dossiers</button><article data-cultivation-case-detail={dossier.id}><h4>{dossier.title}</h4><p><strong>Dossier fictif.</strong> {dossier.scenario}</p><details open><summary>Contraintes annoncées</summary><ul>{dossier.constraints.map(text=><li key={text}>{text}</li>)}</ul></details><p>{dossier.question}</p><div className={styles.guide}>{dossier.options.map(option=>{const system=CULTIVATION_SYSTEMS.find(item=>item.id===option.systemId);return <article key={option.systemId}><h4>{system?.name ?? option.systemId}</h4><p><strong>{fitLabels[option.fit]}</strong></p><p>{option.explanation}</p><details><summary>Conditions à vérifier</summary><ul>{option.conditions.map(text=><li key={text}>{text}</li>)}</ul></details></article>;})}</div><KqHistorySources ids={dossier.sourceIds}/></article></>:<><p>Trois situations inventées pour raisonner sur des productions de chanvre autorisées. Les contraintes sont celles des dossiers ; elles ne décrivent pas toutes les exploitations d’une région.</p><ul className={styles.caseGrid}>{CULTIVATION_CASES.map(item=><li key={item.id}><h4>{item.title}</h4><p>{item.scenario}</p><button type="button" data-cultivation-case={item.id} onClick={()=>onPassage(`case-${item.id}`)}>Examiner ce dossier</button></li>)}</ul></>}
    <KqCultivationSimulation/>
  </section>;
}

type Choices=Parameters<typeof simulateCultivationScenario>[0];
export function KqCultivationSimulation() {
  const [choices,setChoices]=useState<Choices>({environment:'greenhouse',medium:'substrate',weather:'cool-humid',resources:'available',purpose:'education'});
  const result=simulateCultivationScenario(choices);
  const fields: {id:keyof Choices;label:string;options:readonly {id:string;label:string}[]}[]=[
    {id:'environment',label:'Environnement',options:CULTIVATION_ENVIRONMENTS},
    {id:'medium',label:'Milieu racinaire',options:CULTIVATION_MEDIA},
    {id:'weather',label:'Contexte météo fictif',options:[{id:'cool-humid',label:'Frais et humide'},{id:'hot-dry',label:'Chaud et sec'},{id:'mild',label:'Modéré'}]},
    {id:'resources',label:'Ressource contrainte',options:[{id:'water-limited',label:'Eau limitée'},{id:'energy-limited',label:'Énergie limitée'},{id:'available',label:'Disponibilité annoncée'}]},
    {id:'purpose',label:'Objectif du dossier',options:[{id:'fibre-seed',label:'Fibres et graines'},{id:'education',label:'Pédagogie'},{id:'research',label:'Recherche autorisée'}]},
  ];
  return <section className={styles.simulation} data-cultivation-simulation><h4>Changer le contexte</h4><p>Simulation qualitative fictive : elle fait apparaître des questions et des tensions. Elle ne prédit ni récolte, ni bénéfice, ni consommation précise.</p><div className={styles.controls}>{fields.map(field=><label key={field.id}>{field.label}<select data-simulation-field={field.id} value={choices[field.id]} onChange={event=>setChoices(current=>({...current,[field.id]:event.target.value}))}>{field.options.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select></label>)}</div>
    <div data-simulation-result aria-live="polite"><h4>{result.title}</h4><div className={styles.outcome}><div><h4>Mécanismes à considérer</h4><ul>{result.observations.map(text=><li key={text}>{text}</li>)}</ul></div><div><h4>Tensions du dossier</h4>{result.tensions.length?<ul>{result.tensions.map(text=><li key={text}>{text}</li>)}</ul>:<p>Aucune tension signalée par ces règles simplifiées ne vaut validation du projet.</p>}</div></div></div>
    <details open><summary>Hypothèses de la simulation</summary><ul>{result.assumptions.map(text=><li key={text}>{text}</li>)}</ul></details><div className={styles.limits}><strong>Limites</strong><ul>{result.limits.map(text=><li key={text}>{text}</li>)}</ul></div><KqHistorySources ids={result.sourceIds}/>
  </section>;
}

const metrics={energyKwh:{label:'Énergie consommée',unit:'kWh'},emissionsKgCo2e:{label:'Émissions associées',unit:'kg CO₂e'},energyPerKg:{label:'Énergie par unité produite',unit:'kWh/kg'},outputKg:{label:'Masse sèche du lot',unit:'kg'}};
export function KqCultivationBalance() {
  const [metric,setMetric]=useState<keyof typeof metrics>('energyKwh');
  const spec=metrics[metric];
  return <section className={styles.tools} data-cultivation-balance><p><strong>Bilan fictif de trois projets anonymes.</strong> Aucun projet A, B ou C ne représente automatiquement le plein champ, la serre ou l’intérieur.</p><p><strong>Périmètre :</strong> {CULTIVATION_BALANCE.boundary}</p><p><strong>Unité de comparaison :</strong> {CULTIVATION_BALANCE.functionalUnit}</p><div className={styles.choices} role="group" aria-label="Grandeur du bilan">{(Object.keys(metrics) as (keyof typeof metrics)[]).map(key=><button key={key} type="button" data-balance-metric={key} aria-pressed={metric===key} onClick={()=>setMetric(key)}>{metrics[key].label}</button>)}</div>
    <div data-balance-chart={metric}><KqBarChart title={`${spec.label} · ${spec.unit}`} items={CULTIVATION_BALANCE.rows.map((row,index)=>({label:row.label,value:row[metric],displayValue:`${row[metric].toLocaleString('fr-FR')} ${spec.unit}`,tone:index===1?'gold':'teal'}))}/></div>
    <details open><summary>Hypothèses et chiffres de départ</summary><ul>{CULTIVATION_BALANCE.assumptions.map(text=><li key={text}>{text}</li>)}</ul><table className={styles.table}><caption>Chaque colonne conserve son unité.</caption><thead><tr><th scope="col">Projet</th><th scope="col">Électricité (kWh)</th><th scope="col">Émissions (kg CO₂e)</th><th scope="col">Produit (kg)</th><th scope="col">Énergie (kWh/kg)</th></tr></thead><tbody>{CULTIVATION_BALANCE.rows.map(row=><tr key={row.id}><th scope="row">{row.label}</th><td data-label="Électricité (kWh)">{row.energyKwh}</td><td data-label="Émissions (kg CO₂e)">{row.emissionsKgCo2e}</td><td data-label="Produit (kg)">{row.outputKg}</td><td data-label="Énergie (kWh/kg)">{row.energyPerKg}</td></tr>)}</tbody></table></details>
    <p><strong>Facteurs fictifs :</strong> {CULTIVATION_BALANCE.rows.map(row=>`${row.label} : ${row.electricityFactorKgCo2ePerKwh.toLocaleString('fr-FR')} kg CO₂e/kWh`).join(' ; ')}.</p>
    <p>Le projet B consomme ici davantage d’électricité que A, mais les émissions calculées sont plus faibles avec son facteur fictif. Le résultat change avec le facteur et le périmètre retenus.</p><details><summary>Comprendre les calculs</summary><p>Émissions de l’électricité = kWh × facteur en kg CO₂e/kWh. Intensité énergétique = kWh ÷ kg de biomasse sèche du lot. Ces deux calculs ne mesurent pas la même chose.</p></details><div className={styles.limits}><strong>Ce que ce bilan ne dit pas</strong><ul>{CULTIVATION_BALANCE.limits.map(text=><li key={text}>{text}</li>)}</ul></div><KqHistorySources ids={CULTIVATION_BALANCE.sourceIds}/>
  </section>;
}

export function KqCultivationGuide({onPassage}:{onPassage:(id:string)=>void}) {
  return <section className={styles.tools} data-cultivation-guide><p>Commence par l’objectif, puis examine les contraintes. Un nom de système ne suffit pas à garantir une qualité, une rentabilité ou un impact environnemental.</p><div className={styles.guide}>{CULTIVATION_GUIDE.map(item=><article key={item.id}><h4>{item.title}</h4><p>{item.objective}</p><p><strong>Pistes à examiner :</strong> {item.systems.map(id=>CULTIVATION_SYSTEMS.find(system=>system.id===id)?.name ?? id).join(' ; ')}.</p><details><summary>Questions avant de décider</summary><ul>{item.questions.map(text=><li key={text}>{text}</li>)}</ul></details><p className={styles.limits}>{item.limits}</p><KqHistorySources ids={item.sourceIds}/></article>)}</div><h4>Relier les notions</h4><div className={styles.choices}><button type="button" onClick={()=>onPassage('cultivation-resources-1')}>Sol, eau et drainage</button><button type="button" onClick={()=>onPassage('cultivation-risks-1')}>Santé des plantes</button><button type="button" onClick={()=>onPassage('cultivation-performance-1')}>Qualité et débouché</button><button type="button" onClick={()=>onPassage('cultivation-decisions-2')}>Défendre un choix</button></div></section>;
}
