"use client";
import Image from "next/image";
import { useState } from "react";
import type { HistoryLesson } from "@/lib/kanab-quest-school-history-types";
import { TERPENE_AROMA_FAMILIES } from "@/lib/kanab-quest-school-terpenes-visuals";
import { TERPENE_COMPOUNDS } from "@/lib/kanab-quest-school-terpenes";
import { KqBarChart } from "./KqVisuals";
import { KqHistorySources } from "./KqHistorySources";
import styles from "./KqSchoolTerpenes.module.css";

const point = (angle: number, radius: number) => [200 + radius * Math.cos(angle), 200 + radius * Math.sin(angle)];
export function KqTerpeneWheel({ onCompound }: { onCompound?: (id: string) => void }) {
  const [selected, setSelected] = useState(TERPENE_AROMA_FAMILIES[0].id);
  const group = TERPENE_AROMA_FAMILIES.find(item => item.id === selected)!;
  const related = TERPENE_COMPOUNDS.filter(item => item.detailLevel === "detailed" && item.aroma.families.includes(selected));
  return <section className={styles.visual} data-terpene-wheel aria-label="Roue des familles olfactives"><h4>Explorer les mots des odeurs</h4><p>Choisis une famille. Les secteurs ont la même taille pour faciliter la lecture : ils ne représentent pas des concentrations.</p><div className={styles.wheelLayout}>
    <svg className={styles.wheel} viewBox="0 0 400 400" role="group" aria-label="Neuf familles, également accessibles par les boutons nommés">
      {TERPENE_AROMA_FAMILIES.map((item,index) => { const start = -Math.PI / 2 + index * Math.PI * 2 / 9 + .025, end = start + Math.PI * 2 / 9 - .05; const a = point(start,180), b = point(end,180), c = point(end,77), d = point(start,77), label = point((start + end) / 2,128); return <g key={item.id} role="button" tabIndex={0} aria-label={`${index + 1}. ${item.label}`} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)} onKeyDown={event => { if(event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(item.id); } }}><path d={`M${a} A180 180 0 0 1 ${b} L${c} A77 77 0 0 0 ${d} Z`} fill={item.color} stroke={selected === item.id ? "#075c50" : "#172923"} strokeWidth={selected === item.id ? 5 : 1.5}/><text x={label[0]} y={label[1]} textAnchor="middle" dominantBaseline="central" fontSize="26">{index + 1}</text></g>; })}
      <text x="200" y="192" textAnchor="middle" fontSize="20">Décrire</text><text x="200" y="217" textAnchor="middle" fontSize="16">une perception</text>
    </svg><div><div className={styles.wheelChoices}>{TERPENE_AROMA_FAMILIES.map((item,index) => <button type="button" key={item.id} aria-pressed={item.id === selected} onClick={() => setSelected(item.id)}>{index + 1}. {item.label}</button>)}</div><div className={styles.wheelDetail} role="status"><Image src={`/placard/flavors-v1/${group.flavor}.webp`} alt="" width={70} height={70} unoptimized/><strong>{group.label}</strong><p>{group.examples}</p></div>{onCompound && related.length ? <details><summary>Des fiches à rapprocher de ces mots</summary><p>Ces rapprochements ne prouvent pas la composition d’une fleur qui aurait cette odeur.</p><div className={styles.wheelChoices}>{related.map(item => <button key={item.id} type="button" onClick={() => onCompound(item.id)}>{item.name}</button>)}</div></details> : null}</div>
  </div><p className={styles.sampleCaption}>Roue pédagogique de vocabulaire, sans classement médical et sans consommation réelle.</p></section>;
}

function ProfileComparison() {
  const [relative, setRelative] = useState(false), [answer, setAnswer] = useState<number>();
  return <section className={styles.visual} data-terpene-profiles><h4>Deux profils fictifs, deux façons de lire</h4><p>Simulation : même méthode et même base de masse sèche. Deux composés seulement sont représentés.</p><div className={styles.wheelChoices}><button type="button" aria-pressed={!relative} onClick={() => setRelative(false)}>Concentration · mg/g</button><button type="button" aria-pressed={relative} onClick={() => setRelative(true)}>Part des deux composés · %</button></div><div className={styles.profileGrid}>{["A","B"].map((name,index) => { const values = relative ? [60,40] : index ? [3,2] : [6,4]; return <div key={name}><KqBarChart title={`Profil ${name} · simulation`} scaleMax={relative ? 100 : 6} items={values.map((value,i) => ({ label: i ? "Myrcène" : "Limonène", value, displayValue: `${value} ${relative ? "% des deux composés" : "mg/g de matière sèche"}`, tone: i ? "gold" : "teal" }))}/><p className={styles.sampleCaption}>Somme de ces deux composés : {index ? 5 : 10} mg/g de matière sèche. Les autres constituants ne sont pas renseignés.</p></div>; })}</div><div className={styles.quizVisual}><p>Les proportions identiques suffisent-elles à prévoir la même odeur ?</p>{["Oui, les pourcentages donnent toute l’odeur.", "Non, les quantités absolues et les autres composés manquent à cette comparaison."].map((text,index) => <button key={text} type="button" aria-pressed={answer === index} onClick={() => setAnswer(index)}>{text}</button>)}{answer !== undefined ? <p role="status">{answer === 1 ? "Exact : " : "À revoir : "}60/40 décrit ici un sous-ensemble de deux composés. L’odeur implique aussi le passage dans l’air, les seuils olfactifs, la matrice et le mélange. Ces barres ne prédisent aucun effet sur la santé.</p> : null}</div></section>;
}

function EvidenceLadder() {
  const [selected, setSelected] = useState(0);
  const items = [
    { title: "Présence", detail: "Un signal est attribué à un composé, avec une méthode et un niveau d’identification. Détecté n’est pas synonyme d’abondant." },
    { title: "Concentration", detail: "Une quantité rapportée à une masse ou un volume. Préciser l’unité, l’étalonnage, le lot et la base de mesure." },
    { title: "Seuil olfactif", detail: "Une perception étudiée dans un milieu et avec un protocole définis. Le seuil n’est pas une propriété sans conditions ni une frontière identique pour tous." },
    { title: "Contribution", detail: "La place du composé dans l’odeur du mélange doit être étudiée. Un pic majoritaire n’est pas automatiquement le principal responsable de l’arôme." },
  ];
  return <section className={styles.visual} data-terpene-evidence><h4>Quatre informations différentes</h4><ol className={styles.steps}>{items.map((item,index) => <li key={item.title}><span>{index + 1}</span><button type="button" aria-pressed={selected === index} onClick={() => setSelected(index)}>{item.title}</button></li>)}</ol><p role="status">{items[selected].detail}</p></section>;
}

function CarbonFamilies() {
  return <figure className={styles.visual} aria-label="Schéma des squelettes carbonés"><figcaption><strong>Compter les carbones du squelette</strong></figcaption><svg viewBox="0 0 420 200" className={styles.figure} role="img" aria-label="Monoterpènes : 10 carbones. Sesquiterpènes : 15 carbones. Blocs de cinq comme convention de lecture.">{[0,1].map(row => <g key={row}>{Array.from({length:row + 2},(_,i) => <g key={i}><rect x={20 + i * 100} y={20 + row * 94} width="80" height="52" rx="10" fill={row ? "#ead49c" : "#b2d1bc"} stroke="#172923"/><text x={60 + i * 100} y={52 + row * 94} textAnchor="middle">5 C</text></g>)}<text x="330" y={52 + row * 94}>{row ? "15 C" : "10 C"}</text><text x="20" y={94 + row * 94}>{row ? "Sesquiterpènes" : "Monoterpènes"}</text></g>)}</svg><p>Blocs symboliques pour lire une famille : ce dessin n’est ni une formule développée ni un assemblage d’isoprène libre. Une fonction oxygénée ajoute une autre information sur l’identité du composé.</p></figure>;
}

function PhysicalChanges() {
  const [selected, setSelected] = useState(0);
  const rows = [
    ["Volatilité", "Tendance à passer dans la phase gazeuse, sous des conditions définies. Elle n’est pas un seuil olfactif."],
    ["Évaporation", "Passage de molécules à la surface vers le gaz ; il peut se produire sans ébullition."],
    ["Ébullition", "Formation de vapeur dans le liquide lorsque les conditions de pression le permettent. Un point d’ébullition dépend de la pression."],
    ["Dégradation", "Transformation chimique : la molécule change. Un départ dans l’air n’implique pas à lui seul sa dégradation."],
  ];
  return <section className={styles.visual} data-terpene-changes><h4>Un départ ou une transformation ?</h4><div className={styles.wheelChoices}>{rows.map(([label],i) => <button key={label} type="button" aria-pressed={i === selected} onClick={() => setSelected(i)}>{label}</button>)}</div><p role="status">{rows[selected][1]}</p><p className={styles.sampleCaption}>Aucune température de vaporisation à déduire : ces notions décrivent des phénomènes physiques et chimiques.</p></section>;
}

export const hasTerpeneVisual = (id: string) => ["terpenes-vocabulary-1", "terpenes-profiles-1", "terpenes-identification-1", "terpenes-chemistry-1"].includes(id)
  || ["terpenes-mixtures-", "terpenes-classes-", "terpenes-transformation-"].some(prefix => id.startsWith(prefix));
export function KqTerpeneVisual({ lesson, onCompound }: { lesson: HistoryLesson; onCompound: (id: string) => void }) {
  let visual;
  if(lesson.id === "terpenes-vocabulary-1") visual = <KqTerpeneWheel onCompound={onCompound}/>;
  else if(lesson.id === "terpenes-profiles-1") visual = <ProfileComparison/>;
  else if(lesson.id.startsWith("terpenes-mixtures") || lesson.id === "terpenes-identification-1") visual = <EvidenceLadder/>;
  else if(lesson.id.startsWith("terpenes-classes") || lesson.id === "terpenes-chemistry-1") visual = <CarbonFamilies/>;
  else if(lesson.id.startsWith("terpenes-transformation")) visual = <PhysicalChanges/>;
  else return null;
  return <>{visual}<KqHistorySources ids={lesson.visual.sourceIds}/></>;
}
