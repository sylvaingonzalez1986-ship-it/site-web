"use client";
import { useState } from "react";
import { BOTANY_VARIETIES } from "@/lib/kanab-quest-school-botany";
import type { BotanyLineageStatus, BotanyVarietyDossier } from "@/lib/kanab-quest-school-botany-types";
import { KQ_BUDDIES } from "@/lib/kanab-quest-game";
import { KqHistorySources } from "./KqHistorySources";
import styles from "./KqSchoolBotany.module.css";

export const BOTANY_LINEAGE_LABELS: Record<BotanyLineageStatus, string> = {
  documented: "Parenté documentée", "breeder-claim": "Déclaration d’obtenteur", hypothesis: "Hypothèse",
};
function Pedigree({ dossier }: { dossier: BotanyVarietyDossier }) {
  const [selectedNode, setSelectedNode] = useState(dossier.nodes.at(-1)?.id ?? "");
  const [selectedEdge, setSelectedEdge] = useState(dossier.edges[0]?.id ?? "");
  const [filter, setFilter] = useState("");
  const edges = dossier.edges.filter(edge => !filter || edge.status === filter);
  const level = (id: string, seen = new Set<string>()): number => {
    if (seen.has(id)) return 0;
    const parents = dossier.edges.filter(edge => edge.childId === id);
    return parents.length ? 1 + Math.max(...parents.map(edge => level(edge.parentId, new Set([...seen, id])))) : 0;
  };
  const levels = dossier.nodes.map(node => level(node.id));
  const rows = Math.max(0, ...levels) + 1;
  const positions = dossier.nodes.map((node, index) => {
    const siblings = dossier.nodes.filter((_, peer) => levels[peer] === levels[index]);
    return { id: node.id, x: (siblings.findIndex(peer => peer.id === node.id) + 1) * 600 / (siblings.length + 1), y: 70 + levels[index] * 150 };
  });
  const edge = edges.find(item => item.id === selectedEdge) ?? edges[0];
  const node = dossier.nodes.find(item => item.id === selectedNode);
  return <section className={styles.pedigree} aria-label={`Arbre des filiations : ${dossier.title}`} data-botany-pedigree>
    <h4>Lire les filiations annoncées</h4>
    <p>Les flèches vont de l’ascendant annoncé vers le descendant. Un lien marqué « ascendance » ne précise pas les générations intermédiaires. Une déclaration commerciale ne constitue pas une vérification génétique. Les numéros renvoient aux noms sous l’arbre.</p>
    <label className={styles.filter}>Statut des liens<select value={filter} onChange={event => setFilter(event.target.value)}><option value="">Tous les statuts</option>{Object.entries(BOTANY_LINEAGE_LABELS).map(([id, label]) => <option key={id} value={id}>{label} ({dossier.edges.filter(item => item.status === id).length})</option>)}</select></label>
    <ul className={styles.legend}>{Object.entries(BOTANY_LINEAGE_LABELS).map(([id, label]) => <li key={id}><span data-line-status={id} aria-hidden/>{label}</li>)}</ul>
    <svg viewBox={`0 0 600 ${rows * 150}`} role="group" aria-label={`Schéma de ${dossier.title}, numéros expliqués dans la liste`}>
      <defs><marker id={`arrow-${dossier.id}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="#0a6a5e"/></marker></defs>
      {edges.map(item => { const start = positions.find(point => point.id === item.parentId), end = positions.find(point => point.id === item.childId); return start && end ? <path key={item.id} data-pedigree-edge={item.id} d={`M${start.x},${start.y + 42} C${start.x},${(start.y + end.y) / 2} ${end.x},${(start.y + end.y) / 2} ${end.x},${end.y - 47}`} fill="none" stroke="#0a6a5e" strokeWidth={edge?.id === item.id ? 5 : 3} strokeDasharray={item.status === "breeder-claim" ? "14 8" : item.status === "hypothesis" ? "3 8" : undefined} markerEnd={`url(#arrow-${dossier.id})`}/> : null; })}
      {dossier.nodes.map((item, index) => <g key={item.id} role="button" tabIndex={0} aria-label={`${index + 1}. ${item.label}`} aria-pressed={selectedNode === item.id} onClick={() => setSelectedNode(item.id)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedNode(item.id); } }} transform={`translate(${positions[index].x},${positions[index].y})`} className={styles.treeNode}><circle r="44" fill={selectedNode === item.id ? "#00695f" : "#fff5dd"} stroke="#172923" strokeWidth="3"/><text textAnchor="middle" dominantBaseline="central" fontSize="32" fontWeight="700" fill={selectedNode === item.id ? "#fff5dd" : "#172923"}>{index + 1}</text></g>)}
    </svg>
    <ol className={styles.nodeList}>{dossier.nodes.map(item => <li key={item.id}><button type="button" aria-pressed={selectedNode === item.id} onClick={() => setSelectedNode(item.id)}>{item.label}</button></li>)}</ol>
    {node ? <div className={styles.selectedNode} role="status"><strong>{node.label}</strong><p>{node.detail}</p></div> : null}
    <div className={styles.edgeList} aria-label="Consulter les preuves de chaque lien">{edges.map(item => <button key={item.id} type="button" aria-pressed={edge?.id === item.id} onClick={() => setSelectedEdge(item.id)}>{dossier.nodes.find(node => node.id === item.parentId)?.label} → {dossier.nodes.find(node => node.id === item.childId)?.label}<small>{item.relation === "ancestry" ? "Ascendance, générations non établies" : "Parent annoncé"} · {BOTANY_LINEAGE_LABELS[item.status]}</small></button>)}</div>
    {edge ? <article className={styles.edgeProof} data-botany-edge-proof><h5>{BOTANY_LINEAGE_LABELS[edge.status]}</h5>{edge.relation === "ancestry" ? <p><strong>Ascendance composée :</strong> ce lien ne décrit pas un parent immédiat ni un ordre de croisement démontré.</p> : null}<p><strong>Attribution :</strong> {edge.claimant}</p><p><strong>Période :</strong> {edge.period}</p><p>{edge.explanation}</p><p><strong>Limite :</strong> {edge.limitation}</p><KqHistorySources ids={edge.sourceIds}/></article> : <p role="status">Aucun lien de ce statut n’est établi dans ce dossier. L’absence de vérification ne prouve ni une parenté ni son impossibilité.</p>}
  </section>;
}

export function KqBotanyDossiers({ passageId, onPassage, onLesson, onBuddy }: { passageId?: string; onPassage: (id: string) => void; onLesson: (id: string) => void; onBuddy: (code: string, passageId: string) => void }) {
  const dossier = BOTANY_VARIETIES.find(item => item.id === passageId) ?? BOTANY_VARIETIES[0];
  const [compareId, setCompareId] = useState(BOTANY_VARIETIES[1]?.id ?? "");
  const comparison = BOTANY_VARIETIES.find(item => item.id === compareId);
  const compareFields = [
    ["Origine revendiquée", "claimedOrigin"], ["Période documentée", "documentedPeriod"], ["Obtenteur déclaré", "declaredBreeder"],
    ["Parents annoncés", "announcedParents"], ["Variantes du récit", "variants"], ["Preuves", "evidence"], ["Inconnues", "unknowns"],
  ] as const;
  return <div className={styles.dossiers} data-botany-dossiers>
    <p>Un nom de variété est un point de départ pour l’enquête. Il ne garantit ni un génotype unique, ni une origine « pure », ni un effet ressenti.</p>
    <label className={styles.filter}>Choisir un dossier<select value={dossier.id} onChange={event => onPassage(event.target.value)}>{BOTANY_VARIETIES.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
    <article data-botany-dossier={dossier.id}><h4>{dossier.title}</h4><p>{dossier.claimedOrigin}</p>
      <Pedigree key={dossier.id} dossier={dossier}/>
      <details className={styles.comparison}><summary>Origines, récits concurrents et preuves du dossier</summary><dl className={styles.dossierFacts}>{compareFields.map(([label, key]) => <div key={key}><dt>{label}</dt><dd>{Array.isArray(dossier[key]) ? <ul>{(dossier[key] as readonly string[]).map((value, index) => <li key={index}>{value}</li>)}</ul> : dossier[key]}</dd></div>)}</dl><KqHistorySources ids={dossier.sourceIds} label="Documents de ce dossier"/></details>
      {dossier.buddyCodes.length ? <div className={styles.buddyLinks}><h4>Lire les fiches du jeu</h4>{dossier.buddyCodes.map(code => <button key={code} type="button" onClick={() => onBuddy(code, dossier.id)}>{KQ_BUDDIES.find(buddy => buddy.code === code)?.name ?? code} · lire la fiche</button>)}<p>Ces fiches restent accessibles sans posséder les cartes. Elles ne certifient pas le pedigree d’un échantillon.</p></div> : <p>Aucun Buddy correspondant n’est attribué à ce dossier.</p>}
      <div className={styles.buddyLinks}>{dossier.lessonIds.map(id => <button key={id} type="button" onClick={() => onLesson(id)}>Revoir les notions du cours</button>)}</div>
    </article>
    <details className={styles.comparison}><summary>Comparer avec une autre fiche</summary><label className={styles.filter}>Deuxième dossier<select value={compareId} onChange={event => setCompareId(event.target.value)}>{BOTANY_VARIETIES.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>{comparison ? <><p>Compare la précision et l’origine des informations ; un récit plus détaillé n’est pas nécessairement mieux démontré.</p><dl>{compareFields.map(([label, key]) => <div key={key}><dt>{label}</dt>{[dossier, comparison].map((item, index) => <dd key={index}><strong>{item.title}</strong><p>{Array.isArray(item[key]) ? (item[key] as readonly string[]).join(" · ") : item[key]}</p></dd>)}</div>)}</dl><KqHistorySources ids={comparison.sourceIds}/></> : null}</details>
  </div>;
}
