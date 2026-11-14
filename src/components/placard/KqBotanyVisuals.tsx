"use client";
import Image from "next/image";
import { useId, useState } from "react";
import { Leaf, Sprout, Flower2, Wind, CircleDot, Combine, PackageOpen, Hourglass, ArrowLeft, ArrowRight } from "lucide-react";
import type { HistoryLesson } from "@/lib/kanab-quest-school-history-types";
import { KqHistorySources } from "./KqHistorySources";
import styles from "./KqSchoolBotany.module.css";
import cycleStyles from "./KqBotanyVisuals.module.css";

const organs = [
  { label: "Racines", x: 50, y: 76, text: "Le réseau racinaire ancre la plante et participe à l’absorption d’eau et d’éléments minéraux. L’agrandissement ne donne pas une taille réelle." },
  { label: "Tige", x: 18, y: 56, text: "Elle porte feuilles et ramifications. Ses tissus assurent le transport ; les fibres libériennes sont situées vers la périphérie, à distinguer de la partie ligneuse." },
  { label: "Feuille composée", x: 53, y: 25, text: "Les folioles dentées se rejoignent au sommet d’un même pétiole : cette silhouette représente une feuille composée palmée, pas sept feuilles indépendantes." },
  { label: "Inflorescence", x: 85, y: 68, text: "Cet ensemble regroupe des fleurs et leurs structures associées. Une inflorescence n’est pas une seule grande fleur." },
] as const;
const specimens = [
  { id: "staminate", title: "Fleur staminale", description: "Cinq anthères portées par leurs filets, entourées de cinq pièces du périanthe. Les anthères produisent le pollen.", alt: "Illustration agrandie d’une fleur à cinq anthères pendantes, sans stigmate visible." },
  { id: "pistillate", title: "Fleur pistillée et bractée", description: "Deux branches stigmatiques émergent de l’enveloppe verte. Ce ne sont pas deux pistils. La bractée masque l’ovaire ; on ne voit pas l’ovaire sur cette vue externe.", alt: "Illustration agrandie d’une enveloppe verte portant deux branches stigmatiques pâles." },
  { id: "stipules", title: "Stipules au nœud", description: "Deux petites pièces vertes étroites se trouvent à la base du pétiole, de part et d’autre du bourgeon axillaire. Ce sont des stipules, pas des stigmates.", alt: "Nœud de tige : pétiole oblique, bourgeon axillaire central et deux petites stipules lancéolées à sa base." },
  { id: "achene", title: "Fruit sec et graine", description: "Le fruit entier contient une graine. La coupe conceptuelle montre un embryon à deux cotylédons, pas deux graines ; les enveloppes sont simplifiées.", alt: "Akène entier à gauche et coupe conceptuelle à droite, contenant une seule graine et ses deux cotylédons." },
] as const;

function Anatomy({ sourceIds }: { sourceIds: readonly string[] }) {
  const [selected, setSelected] = useState(0); const [labels, setLabels] = useState(true);
  return <figure className={styles.plate} data-botany-anatomy><figcaption>Quatre repères pour lire la plante</figcaption>
    <button type="button" aria-pressed={!labels} onClick={() => setLabels(value => !value)}>{labels ? "Observer sans les légendes" : "Afficher les légendes"}</button>
    <div className={styles.plateImage}><Image src="/placard/school/course-plant-v1.webp" alt="Planche botanique de chanvre avec quatre repères numérotés : réseau souterrain, axe vertical, organe palmé et groupe de structures florales." width={1200} height={800} unoptimized/><div className={styles.plateMarkers}>{organs.map((organ, index) => <button key={organ.label} type="button" style={{ left: `${organ.x}%`, top: `${organ.y}%` }} aria-label={`Repère ${index + 1}${labels ? ` : ${organ.label}` : ""}`} aria-pressed={selected === index} onClick={() => setSelected(index)}>{index + 1}</button>)}</div></div>
    {labels ? <><ol className={styles.plateLegend}>{organs.map((organ, index) => <li key={organ.label}><button type="button" aria-pressed={selected === index} onClick={() => setSelected(index)}>{index + 1}. {organ.label}</button></li>)}</ol><div className={styles.plateDetail} role="status"><strong>{selected + 1}. {organs[selected].label}</strong><p>{organs[selected].text}</p></div></> : <p role="status">Nomme les quatre repères, puis compare tes réponses aux légendes. L’exercice de la leçon vérifie les associations.</p>}
    <p className={styles.plateCaption}>Illustration synthétique, agrandissements à des échelles différentes. La silhouette ne permet pas d’identifier un cultivar ou son effet.</p><KqHistorySources ids={sourceIds}/>
  </figure>;
}
function Specimens({ sourceIds, observation = false }: { sourceIds: readonly string[]; observation?: boolean }) {
  const [revealed, setRevealed] = useState(!observation);
  return <section className={styles.plate} data-botany-specimens><h4>{observation ? "Que peut-on observer ici ?" : "Distinguer les petites structures"}</h4>{observation ? <p>Classe les structures visibles. Une fleur ne suffit pas à déterminer l’expression de toutes les fleurs d’une plante, ni ses chromosomes.</p> : null}
    <div className={styles.specimenGrid}>{specimens.filter(item => !observation || item.id !== "achene").map((item, index) => <figure key={item.id}><Image src={`/placard/school/botany/${item.id}-v1.webp`} alt={revealed ? item.alt : `Observation ${String.fromCharCode(65 + index)} : ${item.id === "staminate" ? "organes pendants groupés" : item.id === "pistillate" ? "enveloppe verte et deux filaments saillants" : "jonction entre tige et pétiole avec un bourgeon"}.`} width={768} height={512} unoptimized/><figcaption><strong>{observation ? `${String.fromCharCode(65 + index)} · ` : ""}{revealed ? item.title : "À observer"}</strong>{revealed ? <p>{item.description}{observation && item.id === "stipules" ? " Ici, l’observation est insuffisante pour attribuer un type floral." : ""}</p> : null}</figcaption></figure>)}</div>
    {observation ? <><figure className={styles.uncertainImage}><Image src="/placard/school/botany/stipules-v1.webp" alt="Observation D, simulation volontairement floue d’une jonction de tige : les structures florales ne sont pas discernables." width={768} height={512} unoptimized/><figcaption><strong>D · Vue volontairement dégradée</strong><p>{revealed ? "Observation insuffisante : demander une vue nette, localisée et accompagnée du contexte. Le flou n’est pas un caractère sexuel." : "Quelles informations manquent pour conclure ?"}</p></figcaption></figure><button type="button" aria-expanded={revealed} onClick={() => setRevealed(value => !value)}>{revealed ? "Masquer les repères" : "Comparer avec les observations expliquées"}</button></> : null}
    <p className={styles.plateCaption}>Planches synthétiques relues pour les caractères représentés. Coupes simplifiées, sans échelle commune ; elles ne remplacent pas des photographies diagnostiques d’un échantillon réel.</p><KqHistorySources ids={sourceIds}/>
  </section>;
}
function StemAndHairs({ kind }: { kind: "stem" | "hairs" }) {
  return <figure className={styles.plate}>{kind === "stem" ? <><svg viewBox="0 0 300 220" role="img" aria-label="Coupe conceptuelle de tige : fibres libériennes vers la périphérie, bois plus interne et moelle centrale."><circle cx="150" cy="110" r="88" fill="#91aa78" stroke="#173d2c" strokeWidth="2"/><circle cx="150" cy="110" r="66" fill="#d2aa64" stroke="#173d2c"/><circle cx="150" cy="110" r="28" fill="#fff4dc"/>{Array.from({length:12},(_,i)=><circle key={i} cx={150+76*Math.cos(i*Math.PI/6)} cy={110+76*Math.sin(i*Math.PI/6)} r="7" fill="#f8eac2" stroke="#173d2c"/>)}<text x="150" y="115" textAnchor="middle" fontSize="14">Moelle</text><text x="150" y="70" textAnchor="middle" fontSize="16">Bois</text></svg><figcaption>Les petits groupes clairs représentent les fibres libériennes, à l’extérieur du bois. Schéma de position, proportions non mesurées.</figcaption><KqHistorySources ids={["bf-fibres-2016"]}/></> : <><svg viewBox="0 0 300 220" role="img" aria-label="Comparaison d’un poil simple pointu et d’un trichome glandulaire avec tête sécrétrice."><path d="M20 180H280" stroke="#2f775c" strokeWidth="12"/><path d="M70 178Q83 140 95 50Q108 135 105 178" fill="#b3c68d" stroke="#2f775c" strokeWidth="3"/><path d="M206 175V97H224V175" fill="#b3c68d" stroke="#2f775c" strokeWidth="3"/><circle cx="215" cy="77" r="27" fill="#e3bd6d" stroke="#2f775c" strokeWidth="3"/><text x="90" y="212" textAnchor="middle" fontSize="16">Poil simple</text><text x="215" y="212" textAnchor="middle" fontSize="16">Glande</text></svg><figcaption>Deux formes conceptuelles de trichomes. Une image de glande ne mesure ni teneur ni effet.</figcaption><KqHistorySources ids={["bf-trichomes-2020", "bf-cfia-2021"]}/></>}</figure>;
}
const cycle = [
  { title: "Graine", icon: CircleDot, detail: "Embryon et réserves" }, { title: "Germination", icon: Sprout, detail: "Reprise du développement" },
  { title: "Développement végétatif", icon: Leaf, detail: "Racines, tiges et feuilles" }, { title: "Floraison", icon: Flower2, detail: "Organes reproducteurs" },
  { title: "Pollinisation", icon: Wind, detail: "Transfert du pollen" }, { title: "Fécondation", icon: Combine, detail: "Fusion des gamètes" },
  { title: "Fruit et graine", icon: PackageOpen, detail: "Développement après fécondation" }, { title: "Sénescence", icon: Hourglass, detail: "Vieillissement de la plante annuelle" },
];

function DevelopmentCrop({ region }: { region: "seed" | "germination" | "vegetative" }) {
  const crop = region === "seed" ? { width: "400%", left: "0%", alt: "Akène de chanvre agrandi : ce fruit sec contient la graine." }
    : region === "germination" ? { width: "400%", left: "-100%", alt: "Début de germination : une radicule sort des enveloppes." }
      : { width: "200%", left: "-100%", alt: "Deux observations indépendantes : plantule à deux cotylédons et premières feuilles simples dentées, puis jeune plante à feuilles palmées." };
  return <div className={`${cycleStyles.developmentCrop} ${region === "vegetative" ? cycleStyles.vegetativeCrop : ""}`}>
    <Image src="/placard/school/botany/development-v1.webp" alt={crop.alt} width={1600} height={800} unoptimized style={{ width: crop.width, left: crop.left }} />
  </div>;
}

function CycleObservation({ index }: { index: number }) {
  if (index < 3) return <figure className={cycleStyles.observation}>
    <DevelopmentCrop region={index === 0 ? "seed" : index === 1 ? "germination" : "vegetative"}/>
    <figcaption>{index === 0 ? "L’enveloppe visible est celle du fruit : la graine est à l’intérieur." : index === 1 ? "Observer la radicule, sans déduire un délai de germination." : "Plantule et jeune plante : deux observations, sans échelle commune."}</figcaption>
  </figure>;
  if (index === 3) return <div className={cycleStyles.flowerPair}>{specimens.slice(0, 2).map(item => <figure key={item.id}><Image src={`/placard/school/botany/${item.id}-v1.webp`} alt={item.alt} width={768} height={512} unoptimized/><figcaption>{item.title}</figcaption></figure>)}</div>;
  if (index === 4) return <figure className={cycleStyles.observation}>
    <svg className={cycleStyles.symbol} viewBox="0 0 360 210" role="img" aria-label="Schéma conceptuel : le pollen est transféré vers un stigmate ; la fécondation est une autre étape.">
      <circle cx="64" cy="88" r="21" fill="#e9b45b" stroke="#173d2c" strokeWidth="3"/><circle cx="58" cy="83" r="3" fill="#173d2c"/><circle cx="71" cy="94" r="3" fill="#173d2c"/>
      <path d="M108 88H235M221 75l14 13-14 13" fill="none" stroke="#087b70" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M286 149V99M286 99Q258 72 264 45M286 99Q313 71 310 45" fill="none" stroke="#577d43" strokeWidth="7" strokeLinecap="round"/>
      <text x="64" y="185" textAnchor="middle">Pollen</text><text x="285" y="185" textAnchor="middle">Stigmate</text>
    </svg><figcaption>Transfert du pollen ; formes simplifiées, sans échelle.</figcaption>
  </figure>;
  if (index === 5) return <figure className={cycleStyles.observation}>
    <svg className={cycleStyles.symbol} viewBox="0 0 360 210" role="img" aria-label="Deux gamètes puis leur fusion : représentation conceptuelle de la fécondation, distincte du transfert du pollen.">
      <circle cx="51" cy="87" r="19" fill="#e9b45b" stroke="#173d2c" strokeWidth="3"/><circle cx="108" cy="87" r="25" fill="#a0c4b5" stroke="#173d2c" strokeWidth="3"/>
      <path d="M157 87H221M207 74l14 13-14 13" fill="none" stroke="#087b70" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="284" cy="87" r="37" fill="#f8eac2" stroke="#173d2c" strokeWidth="3"/><circle cx="278" cy="87" r="12" fill="#e9b45b"/><circle cx="290" cy="87" r="12" fill="#a0c4b5"/>
      <text x="80" y="172" textAnchor="middle">Deux gamètes</text><text x="284" y="172" textAnchor="middle">Fusion</text>
    </svg><figcaption>Un schéma de principe, sans anatomie détaillée.</figcaption>
  </figure>;
  if (index === 6) return <figure className={cycleStyles.observation}><Image className={cycleStyles.specimen} src="/placard/school/botany/achene-v1.webp" alt={specimens[3].alt} width={768} height={512} unoptimized/><figcaption>Akène et coupe conceptuelle : un fruit, une graine.</figcaption></figure>;
  return <figure className={cycleStyles.observation}><div className={cycleStyles.ageSymbol}><Hourglass size={104} strokeWidth={1.5} aria-hidden/><span>Vieillissement</span></div><figcaption>Symbole de sénescence ; aucune durée n’est représentée.</figcaption></figure>;
}

function Cycle({ sourceIds }: { sourceIds: readonly string[] }) {
  const [selected, setSelected] = useState(0);
  const panelId = useId();
  const stage = cycle[selected];
  return <section className={cycleStyles.cycle} data-botany-cycle aria-label="Explorer les repères du cycle">
    <p className={cycleStyles.instruction}>Choisis un repère pour l’observer.</p>
    <div className={cycleStyles.explorer}>
      <nav className={cycleStyles.ring} aria-label="Les huit repères du cycle">
        <svg className={cycleStyles.connections} viewBox="0 0 320 320" aria-hidden="true"><circle cx="160" cy="160" r="118" fill="none" stroke="#b1b89a" strokeWidth="3" strokeDasharray="5 6"/></svg>
        <ol>{cycle.map((item, index) => { const angle = (index * 45 - 90) * Math.PI / 180; return <li key={item.title} style={{ left: `${50 + 37 * Math.cos(angle)}%`, top: `${50 + 37 * Math.sin(angle)}%` }}>
          <button type="button" className={cycleStyles.stageButton} aria-label={`${index + 1}. ${item.title}`} aria-pressed={selected === index} aria-controls={panelId} onClick={() => setSelected(index)} data-cycle-stage={index}><item.icon size={23} aria-hidden/><span>{index + 1}</span></button>
        </li>; })}</ol>
        <div className={cycleStyles.ringCenter}><span>Repère {selected + 1} / {cycle.length}</span><strong>{stage.title}</strong><small>Sans durée ni échelle</small></div>
      </nav>
      <div id={panelId} className={cycleStyles.activeStage} data-cycle-observation={selected}>
        <div className={cycleStyles.stageCopy} role="status" aria-live="polite"><h4>{stage.title}</h4><p>{stage.detail}</p></div>
        <CycleObservation index={selected}/>
      </div>
    </div>
    <div className={cycleStyles.controls}><button type="button" disabled={selected === 0} onClick={() => setSelected(value => value - 1)}><ArrowLeft size={18} aria-hidden/>Précédent</button><button type="button" disabled={selected === cycle.length - 1} onClick={() => setSelected(value => value + 1)}>Suivant<ArrowRight size={18} aria-hidden/></button></div>
    <details className={cycleStyles.limits}><summary>Ce que ce cycle simplifie</summary><p>Vue simplifiée d’un cycle avec reproduction sexuée réussie. Ces étapes peuvent se chevaucher entre organes ; une fleur non fécondée ne produit pas automatiquement une graine.</p><p>Les illustrations sont synthétiques et leurs agrandissements ne partagent pas une échelle. Les quatre observations du développement ne représentent pas la reproduction.</p><p>La photopériode est la durée relative du jour et de la nuit perçue par la plante. Son influence dépend du génotype et du stade ; aucun calendrier de culture n’est déduit ici.</p><KqHistorySources ids={sourceIds}/></details>
  </section>;
}
function Transmission({ sourceIds }: { sourceIds: readonly string[] }) {
  const [parentA, setParentA] = useState("Aa"), [parentB, setParentB] = useState("Aa");
  const combinations = [...parentA].flatMap(a => [...parentB].map(b => [a,b].sort().join("")));
  return <section className={styles.concept} data-botany-transmission><h4>Transmettre deux versions d’un gène</h4><p>Modèle fictif à un locus : A et a sont deux allèles. Chaque case est une combinaison possible, pas un programme de sélection ni une prédiction sur un cultivar.</p><div className={styles.conceptControls}><label>Génotype du parent 1<select value={parentA} onChange={event=>setParentA(event.target.value)}>{["AA","Aa","aa"].map(value=><option key={value}>{value}</option>)}</select></label><label>Génotype du parent 2<select value={parentB} onChange={event=>setParentB(event.target.value)}>{["AA","Aa","aa"].map(value=><option key={value}>{value}</option>)}</select></label></div><table className={styles.punnett}><caption>Combinaisons dans ce modèle mendélien simple</caption><thead><tr><th scope="col">Gamètes</th>{[...parentB].map((value,index)=><th key={index} scope="col">{value}</th>)}</tr></thead><tbody>{[...parentA].map((a,row)=><tr key={row}><th scope="row">{a}</th>{[...parentB].map((b,column)=><td key={column}>{[a,b].sort().join("")}</td>)}</tr>)}</tbody></table><p role="status">{["AA","Aa","aa"].map(value=>`${value} : ${combinations.filter(item=>item===value).length}/4`).join(" · ")} possibilités équiprobables dans les hypothèses de ce modèle.</p><p>Aa est hétérozygote à ce locus ; AA et aa sont homozygotes. Un caractère observable peut dépendre de plusieurs loci et du milieu : ce tableau ne suffit pas à prédire un phénotype ou un effet ressenti.</p><KqHistorySources ids={sourceIds}/></section>;
}
function FloralOrganization({ sourceIds }: { sourceIds: readonly string[] }) {
  const stem = (x: number, first: "male" | "female", mixed = false) => <g transform={`translate(${x},0)`}><path d="M0 175V62M0 113L-24 89M0 137L24 110" fill="none" stroke="#426f39" strokeWidth="5"/><path d="M-2 145Q-38 134-30 114Q-7 116-2 145M2 158Q37 148 30 130Q9 133 2 158" fill="#91aa78" stroke="#426f39"/>{(first === "male" ? [0,1] : []).map(i=><circle key={i} cx={i ? -24 : 0} cy={i ? 78 : 50} r="13" fill="#d6b36a" stroke="#172923" strokeWidth="2"/>)}{(first === "female" ? [0,1] : mixed ? [1] : []).map(i=><path key={i} d={`M${i ? 24 : 0} ${i ? 86 : 33}l13 16-13 16-13-16Z`} fill="#a0c4b5" stroke="#172923" strokeWidth="2"/>)}</g>;
  return <figure className={styles.concept} data-botany-organization><figcaption>À l’échelle d’une plante ou d’une fleur</figcaption><p>Symboles : cercle = fleur staminale ; losange = fleur pistillée. Ce schéma décrit une organisation, pas la forme réelle des fleurs.</p><div className={styles.specimenGrid}><figure><svg viewBox="0 0 300 210" role="img" aria-label="Dioécie : un individu portant des fleurs staminales et un autre portant des fleurs pistillées.">{stem(90,"male")}{stem(210,"female")}</svg><figcaption><strong>Dioécie</strong> · Deux individus distincts.</figcaption></figure><figure><svg viewBox="0 0 300 210" role="img" aria-label="Monoécie : fleurs staminales et fleurs pistillées distinctes sur le même individu.">{stem(150,"male",true)}</svg><figcaption><strong>Monoécie</strong> · Un individu, deux types de fleurs distinctes.</figcaption></figure><figure><svg viewBox="0 0 300 210" role="img" aria-label="Fleur bisexuée : étamines et pistil appartiennent à une même fleur."><ellipse cx="150" cy="100" rx="105" ry="65" fill="#fff5dd" stroke="#426f39" strokeWidth="3"/><circle cx="115" cy="100" r="16" fill="#d6b36a" stroke="#172923"/><path d="M183 78l18 22-18 22-18-22Z" fill="#a0c4b5" stroke="#172923"/><text x="150" y="188" textAnchor="middle" fontSize="18">Une même fleur</text></svg><figcaption><strong>Fleur bisexuée</strong> · Organes des deux fonctions dans une même unité florale ; dessin conceptuel.</figcaption></figure></div><KqHistorySources ids={sourceIds}/></figure>;
}
const lessonsWithBotanyVisual = new Set([
  "botany-anatomy-1", "botany-anatomy-2", "botany-life-cycle-1", "botany-life-cycle-2",
  "botany-sexual-expression-1", "botany-sexual-expression-2", "botany-observation-1", "botany-observation-2",
  "botany-genetics-1", "botany-genetics-2",
]);
export function hasBotanyVisual(lessonId: string): boolean { return lessonsWithBotanyVisual.has(lessonId); }
export function KqBotanyVisual({ lesson }: { lesson: HistoryLesson }) {
  if (lesson.id === "botany-anatomy-1") return <><Anatomy sourceIds={lesson.visual.sourceIds}/><StemAndHairs kind="stem"/></>;
  if (lesson.id === "botany-anatomy-2") return <Specimens sourceIds={lesson.visual.sourceIds}/>;
  if (lesson.id.startsWith("botany-life-cycle")) return <Cycle sourceIds={lesson.visual.sourceIds}/>;
  if (lesson.id === "botany-sexual-expression-1") return <FloralOrganization sourceIds={lesson.visual.sourceIds}/>;
  if (lesson.id === "botany-sexual-expression-2") return <Specimens sourceIds={lesson.visual.sourceIds}/>;
  if (lesson.id === "botany-observation-1") return <Specimens sourceIds={lesson.visual.sourceIds} observation/>;
  if (lesson.id === "botany-observation-2") return <StemAndHairs kind="hairs"/>;
  if (lesson.id.startsWith("botany-genetics")) return <Transmission sourceIds={lesson.visual.sourceIds}/>;
  return null;
}
