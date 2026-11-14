"use client";
import Image from "next/image";
import { useState } from "react";
import { TERPENE_COMPOUNDS, TERPENE_CORPUS, foldTerpeneName, terpeneCompound } from "@/lib/kanab-quest-school-terpenes";
import { TERPENE_BUDDY_LINKS } from "@/lib/kanab-quest-school-terpenes-buddy-links";
import { TERPENE_AROMA_FAMILIES, TERPENE_FAMILY_LABELS, TERPENE_IDENTIFICATION_LABELS, TERPENE_MODEL_LABELS } from "@/lib/kanab-quest-school-terpenes-visuals";
import { KQ_BUDDIES } from "@/lib/kanab-quest-game";
import { KqHistorySources } from "./KqHistorySources";
import styles from "./KqSchoolTerpenes.module.css";

type Props = { passageId?: string; onPassage: (id: string) => void; onLesson: (id: string) => void; onBuddy: (code: string, passage: string) => void };
export function KqTerpeneEncyclopedia({ passageId, onPassage, onLesson, onBuddy }: Props) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("detailed"), [family, setFamily] = useState(""), [aroma, setAroma] = useState(""), [proof, setProof] = useState("");
  const compound = passageId?.startsWith("compound-") ? terpeneCompound(passageId) : undefined;
  const words = foldTerpeneName(query).split(" ").filter(Boolean);
  const filtered = TERPENE_COMPOUNDS.filter(item => (!level || item.detailLevel === level) && (!family || item.family === family)
    && (!aroma || item.aroma.families.some(value => value === aroma)) && (!proof || item.identification.level === proof)
    && words.every(word => foldTerpeneName([item.name, ...item.synonyms, item.id].join(" ")).includes(word))).sort((a,b) => a.name.localeCompare(b.name,"fr"));
  const detailed = TERPENE_COMPOUNDS.filter(item => item.detailLevel === "detailed").length;
  return <div className={styles.encyclopedia} data-terpene-encyclopedia>
    {compound ? <article className={styles.compound} data-terpene-compound={compound.id}>
      <div className={styles.compoundHeader}><div><h2>{compound.name}</h2><p>{TERPENE_FAMILY_LABELS[compound.family]}</p><small>{compound.detailLevel === "detailed" ? "Fiche détaillée" : "Entrée de l’inventaire complémentaire"} · {TERPENE_IDENTIFICATION_LABELS[compound.identification.level]}</small></div><div className={styles.aromaBadges}>{compound.aroma.families.slice(0,3).map(id => { const group = TERPENE_AROMA_FAMILIES.find(item => item.id === id)!; return <figure key={id}><Image src={`/placard/flavors-v1/${group.flavor}.webp`} alt="" width={64} height={64} unoptimized/><figcaption>{group.label}</figcaption></figure>; })}</div></div>
      <p className={styles.entryIntro}>{compound.aroma.description}</p><p className={styles.limits}>{compound.aroma.limitations}</p><KqHistorySources ids={compound.aroma.sourceIds}/>
      {compound.biology.some(item => item.model === "human") ? <section className={styles.entrySection} data-terpene-human><h3>Ce que l’on sait chez l’humain</h3>{compound.biology.filter(item => item.model === "human").map((item,index) => <div key={index}><p>{item.statement}</p><p className={styles.limits}>{item.limitations}</p><KqHistorySources ids={item.sourceIds}/></div>)}</section> : null}
      <section className={styles.entrySection}><h3>Identification et présence</h3><p>{compound.identification.statement}</p><KqHistorySources ids={compound.identification.sourceIds}/>
      <details className={styles.entryDetails}><summary>Noms, méthodes et présence documentée</summary>
      <dl className={styles.facts}>
        <div><dt>Nom et synonymes</dt><dd>{compound.synonyms.length ? compound.synonyms.join(" · ") : "Pas de synonyme ajouté dans ce corpus."}<p>{compound.isomerNotes}</p></dd></div>
        <div><dt>Identification vérifiée</dt><dd><p>{compound.identification.methods.join(" · ")}</p><ul>{compound.identification.limitations.map(item => <li key={item}>{item}</li>)}</ul><KqHistorySources ids={compound.identification.sourceIds}/></dd></div>
        <div><dt>Présence documentée dans le cannabis</dt><dd>{compound.cannabisEvidence.map((item,index) => <div className={styles.sourceEvidence} key={index}><p>{item.statement}</p><small>{item.locator}</small><KqHistorySources ids={item.sourceIds}/></div>)}</dd></div>
      </dl></details></section>
      <details className={styles.entryDetails}><summary>Autres plantes et rôles biologiques étudiés</summary><h3>Présence dans d’autres plantes</h3>{compound.otherPlants.length ? compound.otherPlants.map((item,index) => <div key={index}><strong>{item.name}</strong><p>{item.statement}</p><KqHistorySources ids={item.sourceIds}/></div>) : <p>Aucun autre exemple vérifié pour cette entrée dans le corpus consulté.</p>}<h3>Ce que les expériences établissent</h3>{compound.biology.some(item => item.model !== "human") ? compound.biology.filter(item => item.model !== "human").map((item,index) => <div className={styles.sourceEvidence} key={index}><strong>{TERPENE_MODEL_LABELS[item.model]}</strong><p>{item.statement}</p><p className={styles.limits}>{item.limitations}</p><KqHistorySources ids={item.sourceIds}/></div>) : <p>{compound.biology.length ? "Les résultats humains documentés figurent plus haut sur cette fiche." : "Données insuffisantes dans ce corpus pour attribuer un rôle biologique particulier à ce composé."}</p>}<p>Une odeur et un effet biologique sont deux observations différentes. Un résultat cellulaire ou animal ne démontre pas un bénéfice chez l’humain.</p></details>
      {TERPENE_BUDDY_LINKS.some(link => link.compoundIds.includes(compound.id)) ? <details className={styles.entryDetails}><summary>Correspondances avec les fiches Buddy</summary><div className={styles.buddyList}>{TERPENE_BUDDY_LINKS.filter(link => link.compoundIds.includes(compound.id)).map(link => <div key={link.buddyCode}><strong>{KQ_BUDDIES.find(buddy => buddy.code === link.buddyCode)?.name ?? link.buddyCode}</strong><blockquote>{link.exactExcerpt}</blockquote><small>{link.attribution}</small><p>{link.limitation}</p><button type="button" onClick={() => onBuddy(link.buddyCode, `compound-${compound.id}`)}>Ouvrir la fiche, même sans la carte</button><KqHistorySources ids={link.sourceIds}/></div>)}</div></details> : null}
      <KqHistorySources ids={compound.sourceIds} label="Toutes les références de cette fiche"/>
      <nav className={styles.entryLinks} aria-label="Poursuivre la lecture"><button type="button" onClick={() => onLesson("terpenes-identification-1")}>Comprendre les méthodes d’identification</button><button type="button" onClick={() => onPassage("terpenes-encyclopedia")}>Tous les composés aromatiques</button></nav>
    </article> : <>
      <h2 className={styles.inventoryTitle}>Les composés aromatiques</h2>
      <div className={styles.controls}><label>Nom ou synonyme<input type="search" value={query} onChange={event => { setQuery(event.target.value); if(event.target.value.trim()) setLevel(""); }} placeholder="β-pinène, humulène, nérolidol…"/></label></div><details className={styles.entryDetails}><summary>Affiner la recherche{family || aroma || proof || level !== "detailed" ? " · filtres modifiés" : ""}</summary><div className={styles.controls}><label>Niveau de détail<select value={level} onChange={event => setLevel(event.target.value)}><option value="detailed">Fiches détaillées ({detailed})</option><option value="inventory">Inventaire complémentaire ({TERPENE_COMPOUNDS.length - detailed})</option><option value="">Tout le corpus ({TERPENE_COMPOUNDS.length})</option></select></label></div>
      <div className={styles.controls}><label>Famille chimique<select value={family} onChange={event => setFamily(event.target.value)}><option value="">Toutes les familles</option>{Object.entries(TERPENE_FAMILY_LABELS).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label><label>Description olfactive<select value={aroma} onChange={event => setAroma(event.target.value)}><option value="">Toutes les descriptions</option>{TERPENE_AROMA_FAMILIES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>Preuve d’identification<select value={proof} onChange={event => setProof(event.target.value)}><option value="">Tous les niveaux</option>{Object.entries(TERPENE_IDENTIFICATION_LABELS).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label></div>
      <p>Les filtres olfactifs décrivent des notes possibles, sans classer les effets.</p><button type="button" onClick={() => { setQuery(""); setLevel(""); setFamily(""); setAroma(""); setProof(""); }}>Afficher tout le corpus</button>
      </details><p role="status">{filtered.length} {level === "detailed" ? "fiches détaillées" : "entrées"} · Inventaire non exhaustif</p>
      <ul className={styles.results}>{filtered.map(item => <li key={item.id}><button type="button" onClick={() => onPassage(`compound-${item.id}`)} data-terpene-result={item.id}><strong>{item.name}</strong><small>{TERPENE_FAMILY_LABELS[item.family]}</small><span>{item.detailLevel === "detailed" ? "Fiche détaillée" : "Inventaire complémentaire"} · {TERPENE_IDENTIFICATION_LABELS[item.identification.level]}</span></button></li>)}</ul>
      {!filtered.length ? <p>Aucune entrée ne réunit ces critères. Cela ne prouve pas l’absence de ce composé dans la plante.</p> : null}
    <div className={styles.counts}><span><strong>{detailed}</strong> fiches détaillées</span><span><strong>{TERPENE_COMPOUNDS.length - detailed}</strong> entrées complémentaires</span><span>Corpus vérifié le {TERPENE_CORPUS.checkedAt}</span></div>
    <p>Ce corpus documenté ne constitue pas la liste complète des composés du cannabis. Certaines entrées restent des attributions provisoires, signalées sur leur fiche. Chaque résultat concerne les échantillons et la méthode cités.</p>
    <details className={styles.corpus} data-terpene-corpus><summary>Corpus étudié, règles et limites</summary><h3>{TERPENE_CORPUS.title}</h3><p>{TERPENE_CORPUS.scope}</p><p>Version : {TERPENE_CORPUS.version}.</p>{[
      ["Ce qui entre dans l’inventaire", TERPENE_CORPUS.inclusionRules], ["Gestion des noms et isomères", TERPENE_CORPUS.synonymRules], ["Ce qui est exclu", TERPENE_CORPUS.exclusions], ["Limites", TERPENE_CORPUS.limitations],
    ].map(([title, items]) => <div key={title as string}><h4>{title}</h4><ul>{(items as readonly string[]).map(item => <li key={item}>{item}</li>)}</ul></div>)}<KqHistorySources ids={TERPENE_CORPUS.sourceIds}/></details>
    </>}
  </div>;
}
