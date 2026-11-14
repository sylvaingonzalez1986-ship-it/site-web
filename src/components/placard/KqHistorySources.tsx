"use client";
import { createContext, useContext } from "react";
import type { HistoryBlock, HistoryEvidence, HistorySource } from "@/lib/kanab-quest-school-history-types";
import styles from "./KqSchoolHistory.module.css";

export const HISTORY_EVIDENCE_LABELS: Record<HistoryEvidence, string> = {
  observation: "Observation documentée", interpretation: "Interprétation ou hypothèse", experiment: "Résultat expérimental",
  clinical: "Observation clinique située", tradition: "Texte, témoignage ou tradition", fiction: "Exemple fictif", law: "Règle datée et située",
};
const accessLabels: Record<HistorySource['access'], string> = { "full-text": "Texte intégral consulté", abstract: "Résumé seulement", catalogue: "Notice consultée, document intégral non lu", "official-page": "Page de l’organisme consultée", excerpt: "Extrait consulté, document complet non lu", unavailable: "Document non relu lors de cette révision" };
const SourceContext = createContext<readonly HistorySource[]>([]);
export const KqCurriculumSourceProvider = SourceContext.Provider;
export function KqHistorySources({ ids, label = "Consulter les preuves" }: { ids: readonly string[]; label?: string }) {
  const catalog = useContext(SourceContext);
  const sources = [...new Set(ids)].map(id => catalog.find(source => source.id === id)).filter(source => source !== undefined);
  return sources.length ? <details className={styles.sources}><summary>{label} · {sources.length}</summary><ul>{sources.map(source => <li key={source.id}>
    <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
    <p>{source.author} · {source.organization} · {source.published}</p>
    <p><strong>{accessLabels[source.access]}</strong> · {source.documentKind}</p>
    <p><strong>Passage :</strong> {source.passage}</p>
    <p><strong>Limite :</strong> {source.limitation}</p>
    <small>Consulté le {source.verifiedAt}</small>
  </li>)}</ul></details> : null;
}
export function KqHistoryBlock({ block }: { block: HistoryBlock }) {
  return <div className={styles.evidenceBlock}><span className={styles.evidenceTag}>{HISTORY_EVIDENCE_LABELS[block.evidence]}</span><p>{block.text}</p><KqHistorySources ids={block.sourceIds}/></div>;
}
