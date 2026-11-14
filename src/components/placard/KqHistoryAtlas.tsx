"use client";
import { useState } from "react";
import { HISTORY_EVENTS, HISTORY_ROUTES } from "@/lib/kanab-quest-school-history";
import type { HistoryRegion, HistoryUse } from "@/lib/kanab-quest-school-history-types";
import { KqHistorySources, HISTORY_EVIDENCE_LABELS } from "./KqHistorySources";
import land from "./KqHistoryMap.land.json";
import styles from "./KqSchoolHistory.module.css";

const regions: Record<HistoryRegion, string> = { global: "Monde / comparaisons", "central-asia": "Asie centrale et steppes", "east-asia": "Asie orientale", "south-asia": "Asie méridionale", "middle-east": "Moyen-Orient", africa: "Afrique", europe: "Europe", brittany: "France et Bretagne", americas: "Amériques" };
const uses: Record<HistoryUse, string> = { plant: "Présence de la plante", fibre: "Fibres et textiles", food: "Alimentation", ritual: "Pratiques sociales et rituelles", medicine: "Usages et recherche médicaux", science: "Sciences et savoirs", policy: "Politiques et règles", industry: "Industrie et débouchés" };
const dateKinds = { object: "Datation d’un objet / site", event: "Événement ou période", publication: "Publication", "effective-law": "Entrée en vigueur" };
const point = (lon: number, lat: number) => ({ x: (lon + 180) / 360 * 900, y: (90 - lat) / 180 * 450 });
export function KqHistoryAtlas({ mode, onLesson }: { mode: "timeline" | "map"; onLesson: (id: string) => void }) {
  const [region, setRegion] = useState(""); const [use, setUse] = useState(""); const [selectedId, setSelectedId] = useState("");
  const filter = (item: { region: string; uses: readonly string[] }) => (!region || item.region === region) && (!use || item.uses.includes(use));
  const events = HISTORY_EVENTS.filter(filter); const routes = HISTORY_ROUTES.filter(filter);
  const selected = routes.find(route => route.id === selectedId) ?? routes[0];
  const start = selected ? point(selected.from.lon, selected.from.lat) : null;
  const end = selected ? point(selected.to.lon, selected.to.lat) : null;
  return <section className={styles.atlas} aria-label={mode === "timeline" ? "Frise historique filtrable" : "Carte des circulations"}>
    <div className={styles.filters}><label>Région<select value={region} onChange={event => setRegion(event.target.value)}><option value="">Toutes les régions</option>{Object.entries(regions).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><label>Usage<select value={use} onChange={event => setUse(event.target.value)}><option value="">Tous les usages</option>{Object.entries(uses).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><button type="button" onClick={() => { setRegion(""); setUse(""); }}>Tout afficher</button></div>
    <p role="status">{mode === "timeline" ? `${events.length} repères` : `${routes.length} liaisons`} pour ces filtres.</p>
    {mode === "timeline" ? <><p className={styles.caption}>Les repères sont classés par date ; l’espacement n’est pas proportionnel au temps écoulé. Chaque repère précise la nature de sa date.</p><ol className={styles.timeline}>{events.map(event => <li key={event.id}>
      <span className={styles.date}>{event.dateLabel}</span><span className={styles.evidenceTag}>{dateKinds[event.dateKind]}</span><h4>{event.title}</h4><p>{event.summary}</p><p><strong>{HISTORY_EVIDENCE_LABELS[event.evidence]}.</strong> {event.uncertainty}</p><p className={styles.caption}>{regions[event.region]} · {event.uses.map(id => uses[id]).join(" · ")}</p><KqHistorySources ids={event.sourceIds}/><button type="button" onClick={() => onLesson(event.lessonId)}>Lire la leçon liée</button>
    </li>)}</ol>{!events.length ? <p>Aucun repère documenté pour cette combinaison. Cela ne prouve pas l’absence d’usage.</p> : null}</> : <>
      <figure className={styles.map}><svg viewBox={land.viewBox} role="img" aria-labelledby="history-map-title history-map-desc"><title id="history-map-title">Liaisons historiques sélectionnées</title><desc id="history-map-desc">{selected ? `${selected.from.label} vers ${selected.to.label}. ${selected.period}. ${selected.certainty === "hypothesis" ? "Hypothèse représentée en pointillés." : "Lien documenté, tracé schématique."} ${selected.limitation}` : "Choisis un lien dans la liste pour en consulter les preuves."}</desc><rect width="900" height="450" fill="#edf3e9"/>{land.paths.map((path, index) => <path key={index} d={path} fill="#e8d8ae" stroke="#718b78" strokeWidth=".6"/>)}{selected && start && end ? <><path d={`M${start.x},${start.y} Q${(start.x + end.x) / 2},${Math.min(start.y, end.y) - 45} ${end.x},${end.y}`} fill="none" stroke="#00695f" strokeWidth="4" strokeDasharray={selected.certainty === "hypothesis" ? "10 8" : undefined}/><circle cx={start.x} cy={start.y} r="7" fill="#fff7e6" stroke="#172923" strokeWidth="2"/><circle cx={end.x} cy={end.y} r="7" fill="#d99030" stroke="#172923" strokeWidth="2"/></> : null}</svg><figcaption>Fond géographique actuel : Natural Earth, domaine public. Positions approximatives ; les arcs indiquent des liens entre lieux, pas des itinéraires reconstitués. Pointillés : hypothèse de circulation.</figcaption></figure>
      <div className={styles.routeButtons} aria-label="Choisir une circulation">{routes.map(route => <button key={route.id} type="button" aria-pressed={selected?.id === route.id} onClick={() => setSelectedId(route.id)}>{route.title}<small>{route.period} · {route.certainty === "hypothesis" ? "Hypothèse" : "Lien documenté"}</small></button>)}</div>
      {selected ? <article className={styles.routeDetail}><h4>{selected.title}</h4><p><strong>{selected.from.label} → {selected.to.label}</strong> · {selected.period}</p><p>{selected.explanation}</p><p><strong>Limite :</strong> {selected.limitation}</p><KqHistorySources ids={selected.sourceIds}/><button type="button" onClick={() => onLesson(selected.lessonId)}>Revenir aux preuves du cours</button></article> : <p>Aucune circulation documentée pour ces filtres. La carte ne prétend pas recenser tous les échanges.</p>}
    </>}
  </section>;
}
