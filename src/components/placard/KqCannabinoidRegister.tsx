"use client";
import { useState } from "react";
import { CANNABINOID_COMPOUNDS, CANNABINOID_CORPUS, cannabinoidCompound, foldCannabinoidName } from "@/lib/kanab-quest-school-cannabinoids";
import { cannabinoidStudiesFor } from "@/lib/kanab-quest-school-cannabinoids-studies";
import { KqHistorySources } from "./KqHistorySources";
import styles from "./KqSchoolCannabinoids.module.css";
export const CAN_FAMILY_LABELS = { thc: "Famille THC", cbd: "Famille CBD", cbg: "Famille CBG", cbc: "Famille CBC", cbn: "Famille CBN", thcv: "Famille THCV", cbdv: "Famille CBDV", "other-phyto": "Autres phytocannabinoïdes", endocannabinoid: "Endocannabinoïdes", emerging: "Composés émergents" };
const formLabels = { acidic: "Forme acide", neutral: "Forme neutre", "lipid-mediator": "Médiateur lipidique" };
const originLabels = { phytocannabinoid: "Présence végétale étudiée", endocannabinoid: "Produit par l’organisme", semisynthetic: "Hémisynthèse possible", synthetic: "Synthèse possible" };
export const CAN_OCCURRENCE_LABELS = { identified: "Identité établie dans la matrice citée", "reported-limited": "Signalement limité", "artifact-possible": "Artefact possible", "not-established": "Présence non établie", "commercial-product": "Produit fabriqué", endogenous: "Présence endogène" };
const modelLabels = { analytical: "Analyse chimique", "plant-enzyme": "Enzyme végétale", cell: "Cellules ou récepteurs", animal: "Animal", human: "Humain", surveillance: "Surveillance" };
export function KqCannabinoidRegister({ passageId, onPassage }: { passageId?: string; onPassage: (id: string) => void }) {
  const [query,setQuery] = useState(""), [family,setFamily] = useState(""), [form,setForm] = useState("");
  const compound = passageId?.startsWith("compound-") ? cannabinoidCompound(passageId) : undefined;
  const words = foldCannabinoidName(query).split(" ").filter(Boolean);
  const rows = CANNABINOID_COMPOUNDS.filter(item => (!family || item.family === family) && (!form || item.form === form) && words.every(word => foldCannabinoidName([item.id,item.name,...item.synonyms].join(" ")).includes(word)));
  return <div className={styles.register} data-cannabinoid-register>
    {compound ? <article className={styles.compound} data-cannabinoid-compound={compound.id}>
      <div className={styles.header}><div><h2>{compound.name}</h2><p>{CAN_FAMILY_LABELS[compound.family]} · {formLabels[compound.form]}</p></div><div>{compound.originCategories.map(origin=><div className={styles.badge} key={origin}>{originLabels[origin]}</div>)}</div></div>
      <p className={styles.entryIntro}>{compound.identity.statement}</p><p className={styles.limits}>{compound.identity.distinction}</p>
      <section className={styles.entrySection} data-cannabinoid-human><h3>Ce que l’on sait chez l’humain</h3><p>{compound.humanEvidence.statement}</p><p className={styles.limits}>{compound.humanEvidence.limitation}</p><KqHistorySources ids={compound.humanEvidence.sourceIds}/>
      </section>
      {cannabinoidStudiesFor(compound.id).length ? <details className={styles.entryDetails}><summary>Études sur cette molécule · {cannabinoidStudiesFor(compound.id).length}</summary><div className={styles.choices}>{cannabinoidStudiesFor(compound.id).map(study=><button key={study.id} type="button" onClick={()=>onPassage(`study-${study.id}`)}>{study.title}</button>)}</div></details> : null}
      <section className={styles.entrySection} data-cannabinoid-risks><h3>Risques et signaux</h3><ul>{compound.risks.map(item=><li key={item}>{item}</li>)}</ul><details className={styles.entryDetails}><summary>Ce qui reste inconnu</summary><ul>{compound.unknowns.map(item=><li key={item}>{item}</li>)}</ul></details><KqHistorySources ids={compound.sourceIds}/></section>
      <details className={styles.entryDetails}><summary>Identité, synonymes et produit</summary><dl className={styles.facts}><div><dt>Identité et synonymes</dt><dd>{compound.synonyms.join(" · ") || "Aucun synonyme ajouté."}<KqHistorySources ids={compound.identity.sourceIds}/></dd></div><div><dt>Procédé et produit</dt><dd>Le nom identifie une molécule. Il ne suffit pas à connaître son origine, les autres constituants ou les impuretés d’un produit. Lire les preuves ci-dessous pour chaque matrice.</dd></div></dl></details>
      <details className={styles.entryDetails}><summary>Où l’identité est-elle documentée ?</summary>{compound.occurrence.map((item,index)=><div className={styles.evidence} key={index}><strong>{CAN_OCCURRENCE_LABELS[item.status]}</strong><p>{item.matrix} · {item.statement}</p><p className={styles.limits}>{item.limitation}</p><small>{item.locator}</small><KqHistorySources ids={item.sourceIds}/></div>)}</details>
      <details className={styles.entryDetails}><summary>Mécanismes étudiés</summary>{compound.mechanisms.map((item,index)=><div className={styles.evidence} key={index}><strong>{modelLabels[item.model]}</strong><p>{item.statement}</p><p className={styles.limits}>{item.limitation}</p><KqHistorySources ids={item.sourceIds}/></div>)}</details>
      <div className={styles.choices}><button type="button" onClick={()=>onPassage("cannabinoids-network")}>Explorer les transformations</button><button type="button" onClick={()=>onPassage("cannabinoids-evidence")}>Comparer les preuves</button><button type="button" onClick={()=>onPassage("cannabinoids-register")}>Tous les cannabinoïdes</button></div>
    </article> : <>
      <h2 className={styles.inventoryTitle}>Les cannabinoïdes</h2>
      <p>Une identité chimique, une présence naturelle et une composition commerciale sont trois informations à vérifier séparément.</p>
      <div className={styles.controls}><label>Nom ou synonyme<input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Anandamide, THCA, delta-9…"/></label></div><details className={styles.entryDetails}><summary>Affiner la recherche{family || form ? " · filtres actifs" : ""}</summary><div className={styles.controls}><label>Famille<select value={family} onChange={event=>setFamily(event.target.value)}><option value="">Toutes les familles</option>{Object.entries(CAN_FAMILY_LABELS).map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label><label>Forme<select value={form} onChange={event=>setForm(event.target.value)}><option value="">Toutes les formes</option>{Object.entries(formLabels).map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label></div></details>
      <p role="status">{rows.length} fiches. Ce registre est un corpus sélectionné, pas une liste exhaustive.</p><ul className={styles.results}>{rows.map(item=><li key={item.id}><button type="button" data-cannabinoid-result={item.id} onClick={()=>onPassage(`compound-${item.id}`)}><strong>{item.name}</strong><small>{CAN_FAMILY_LABELS[item.family]}</small><span className={styles.badge}>{formLabels[item.form]}</span></button></li>)}</ul>{!rows.length?<p>Aucune fiche ne correspond. Ce résultat ne prouve pas l’absence de la molécule.</p>:null}
    <div className={styles.counts}><span><strong>{CANNABINOID_COMPOUNDS.length}</strong> fiches moléculaires</span><span>Corpus vérifié le {CANNABINOID_CORPUS.checkedAt}</span></div>
    <details><summary>Périmètre du registre et limites</summary><p>{CANNABINOID_CORPUS.scope}</p>{[...CANNABINOID_CORPUS.inclusionRules,...CANNABINOID_CORPUS.exclusions,...CANNABINOID_CORPUS.limitations].map(item=><p key={item}>{item}</p>)}<KqHistorySources ids={CANNABINOID_CORPUS.sourceIds}/></details>
    </>}
  </div>;
}
