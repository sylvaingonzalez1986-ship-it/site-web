"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import { HISTORY_TERMS, HISTORY_SOURCES, HISTORY_LESSONS } from "@/lib/kanab-quest-school-history";
import { BOTANY_TERMS, BOTANY_SOURCES, BOTANY_LESSONS } from "@/lib/kanab-quest-school-botany";
import { TERPENE_TERMS, TERPENE_LESSON_SOURCES as TERPENE_SOURCES, TERPENE_CHAPTERS } from "@/lib/kanab-quest-school-terpenes-lessons";
import { CANNABINOID_TERMS, CANNABINOID_LESSON_SOURCES as CANNABINOID_SOURCES, CANNABINOID_CHAPTERS } from "@/lib/kanab-quest-school-cannabinoids-lessons";
import { CULTIVATION_TERMS, CULTIVATION_LESSON_SOURCES as CULTIVATION_SOURCES, CULTIVATION_CHAPTERS } from "@/lib/kanab-quest-school-cultivation-lessons";
import { HEALTH_TERMS, HEALTH_LESSON_SOURCES as HEALTH_SOURCES, HEALTH_CHAPTERS } from "@/lib/kanab-quest-school-health-lessons";
import { SOIL_TERMS, SOIL_LESSON_SOURCES as SOIL_SOURCES, SOIL_CHAPTERS } from "@/lib/kanab-quest-school-soil-lessons";
import { PRODUCTS_TERMS, PRODUCTS_LESSON_SOURCES as PRODUCTS_SOURCES, PRODUCTS_CHAPTERS } from "@/lib/kanab-quest-school-products-lessons";
import { HARVEST_TERMS, HARVEST_LESSON_SOURCES as HARVEST_SOURCES, HARVEST_CHAPTERS } from "@/lib/kanab-quest-school-harvest-lessons";
import { foldCurriculumText } from "@/lib/kanab-quest-school-curriculum";
import { KqCurriculumSourceProvider, KqHistorySources } from "./KqHistorySources";
import styles from "./KqSchoolGlossary.module.css";

const entries = [
  ...HISTORY_TERMS.map(term => ({ ...term, course: "history", label: "Histoire" })),
  ...BOTANY_TERMS.map(term => ({ ...term, course: "plant", label: "Botanique" })),
  ...TERPENE_TERMS.map(term => ({ ...term, course: "molecules", label: "Terpènes" })),
  ...CANNABINOID_TERMS.map(term => ({ ...term, course: "evidence", label: "Cannabinoïdes" })),
  ...CULTIVATION_TERMS.map(term => ({ ...term, course: "genetics", label: "Modes de culture" })),
  ...HEALTH_TERMS.map(term => ({ ...term, course: "biodiversity", label: "Santé des plantes" })),
  ...SOIL_TERMS.map(term => ({ ...term, course: "uses", label: "Sol et nutrition" })),
  ...PRODUCTS_TERMS.map(term => ({ ...term, course: "profiles", label: "Produits et qualité" })),
  ...HARVEST_TERMS.map(term => ({ ...term, course: "prevention", label: "Récolte et comparaison" })),
].sort((a,b) => a.term.localeCompare(b.term,"fr"));
const sources = [...HISTORY_SOURCES, ...BOTANY_SOURCES, ...TERPENE_SOURCES, ...CANNABINOID_SOURCES, ...CULTIVATION_SOURCES, ...HEALTH_SOURCES, ...SOIL_SOURCES, ...PRODUCTS_SOURCES, ...HARVEST_SOURCES];
const lessons = [...HISTORY_LESSONS, ...BOTANY_LESSONS, ...TERPENE_CHAPTERS.flatMap(chapter => chapter.lessons), ...CANNABINOID_CHAPTERS.flatMap(chapter => chapter.lessons), ...CULTIVATION_CHAPTERS.flatMap(chapter => chapter.lessons), ...HEALTH_CHAPTERS.flatMap(chapter => chapter.lessons), ...SOIL_CHAPTERS.flatMap(chapter => chapter.lessons), ...PRODUCTS_CHAPTERS.flatMap(chapter => chapter.lessons), ...HARVEST_CHAPTERS.flatMap(chapter => chapter.lessons)];
export function KqSchoolGlossary({ focusTermId, onOpen }: { focusTermId?: string; onOpen: (course: string, passage: string) => void }) {
  const [query, setQuery] = useState("");
  const term = entries.find(item => item.id === focusTermId);
  const filtered = entries.filter(item => foldCurriculumText(`${item.term} ${item.definition}`).includes(foldCurriculumText(query)));
  return <KqCurriculumSourceProvider value={sources}>
    <section className={styles.glossary} data-school-glossary>
      {term ? <article className={styles.entry} data-school-term={term.id}>
        <h2>{term.term}</h2>
        <p className={styles.definition}>{term.definition}</p>
        <p className={styles.context}>{term.label}</p>
        <KqHistorySources ids={term.sourceIds} label="Sources de cette définition"/>
        <section className={styles.related} aria-label="Articles liés">
          <h3>Pour comprendre en contexte</h3>
          <div>{term.lessonIds.map(id => {
            const lesson = lessons.find(item => item.id === id);
            return lesson ? <button key={id} type="button" onClick={() => onOpen(term.course, id)}>{lesson.title}</button> : null;
          })}</div>
        </section>
      </article> : <>
        <h2>Le lexique du chanvre</h2>
        <label className={styles.search}><Search size={18} aria-hidden/><span>Retrouver un mot</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Un terme ou une notion…"/></label>
        <p className={styles.context} role="status">{filtered.length} termes</p>
        <dl className={styles.entries}>{filtered.map(item => <div key={item.id}>
          <dt><button type="button" onClick={() => onOpen(item.course, item.id)}>{item.term}</button></dt>
          <dd>{item.label}</dd>
        </div>)}</dl>
        {!filtered.length ? <p>Aucune entrée trouvée ; essaie un autre terme.</p> : null}
      </>}
    </section>
  </KqCurriculumSourceProvider>;
}
