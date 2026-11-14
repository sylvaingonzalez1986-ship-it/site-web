"use client";
import Image from "next/image";
import dynamic from 'next/dynamic';
import { useEffect, useId, useMemo, useRef, useState, type MouseEvent } from "react";
import { ArrowLeft, ArrowRight, Search, X } from "lucide-react";
import { CANNABIS_REFERENCE_TOPICS, loadCannabisReferenceCatalog, normalizeCannabisSearch as normalize } from "@/lib/kanab-quest-cannabis-reference";
import type { CannabisReferenceArticle, CannabisReferenceCatalog, CannabisReferenceTerm, CannabisTopicId } from "@/lib/kanab-quest-cannabis-reference-types";
import styles from "./KqSchoolEncyclopedia.module.css";
import { KqTerpeneCardDeck, KqTerpeneCardDialog } from './KqTerpeneCards';
import { TERPENE_CARDS } from '@/lib/kanab-quest-terpene-cards';
import { KqChapterHeading } from './KqChapterHeading';

const HistoryTimeline = dynamic(() => import('./KqHistoryTimeline').then(module => module.KqHistoryTimeline), { ssr: false, loading: () => <p role="status">Ouverture de la frise historique…</p> });

export type KqSchoolEncyclopediaProps = {
  onOpen: (courseId: string, passageId?: string) => void;
  initialShelfId?: string;
};
type View = "home" | "topic" | "index" | "glossary" | "search";
type LibraryState = { view: View; topicId?: CannabisTopicId; topicSection?: 'articles' | 'records'; query: string; letter: string; page: number; recordQuery: string; recordPage: number; returnTo?: string; scrollY?: number };
const STORAGE_KEY = "kq-cannabis-reference:v4";
const INITIAL: LibraryState = { view: "home", query: "", letter: "A", page: 1, recordQuery: "", recordPage: 1 };
const TOPIC_IDS: readonly string[] = CANNABIS_REFERENCE_TOPICS.map(topic => topic.id);
const LETTERS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "#"];
// Navigation vignettes reuse the existing botanical plates; article documents retain their own images and captions.
const ARTICLE_ARTWORK: Readonly<Record<string, string>> = {
  'ref-fleurs-fruits-graines': '/placard/school/botany/organs-v1.webp',
  'ref-trichomes': '/placard/school/course-molecules-v1.webp',
  'ref-cycle-vie': '/placard/school/botany/development-v1.webp',
  'ref-reproduction': '/placard/school/botany/staminate-v1.webp',
  'ref-photoperiode': '/placard/school/cultivation/greenhouse-v1.webp',
};
const firstLetter = (text: string) => { const letter = normalize(text).charAt(0).toUpperCase(); return /^[A-Z]$/.test(letter) ? letter : "#"; };
const articleHref = (id: string) => `?view=school&section=learn&module=reference&passage=${encodeURIComponent(id)}`;
const plainActivation = (event: MouseEvent<HTMLAnchorElement>) => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
const alphabetically = (a: CannabisReferenceArticle, b: CannabisReferenceArticle) => a.title.localeCompare(b.title, "fr");
function restore(initialShelfId?: string): LibraryState {
  const requestedTopic = initialShelfId && TOPIC_IDS.includes(initialShelfId) ? initialShelfId as CannabisTopicId : undefined;
  const fallback: LibraryState = requestedTopic ? { ...INITIAL, view: 'topic', topicId: requestedTopic } : INITIAL;
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null") as LibraryState | null;
    if (!value || !["home", "topic", "index", "glossary", "search"].includes(value.view)) return fallback;
    if (requestedTopic && value.topicId !== requestedTopic) return fallback;
    const topicId = value.topicId && TOPIC_IDS.includes(value.topicId) ? value.topicId : undefined;
    return { view: value.view === "topic" && !topicId ? "home" : value.view, topicId, topicSection: value.topicSection === 'records' ? 'records' : 'articles', query: typeof value.query === "string" ? value.query.slice(0, 200) : "", letter: LETTERS.includes(value.letter) ? value.letter : "A", page: Number.isInteger(value.page) && value.page > 0 ? value.page : 1, recordQuery: typeof value.recordQuery === "string" ? value.recordQuery.slice(0, 100) : "", recordPage: Number.isInteger(value.recordPage) && value.recordPage > 0 ? value.recordPage : 1, returnTo: typeof value.returnTo === "string" ? value.returnTo : undefined, scrollY: Number.isFinite(value.scrollY) ? Math.max(0, value.scrollY!) : 0 };
  } catch { return fallback; }
}
function remember(state: LibraryState) { try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* Browsing also works without session storage. */ } }

export function KqSchoolEncyclopedia({ onOpen, initialShelfId }: KqSchoolEncyclopediaProps) {
  const [state, setState] = useState<LibraryState>(() => restore(initialShelfId));
  const [catalog, setCatalog] = useState<CannabisReferenceCatalog>();
  const [terpeneCard, setTerpeneCard] = useState<{ id: string; ids: readonly string[] }>();
  const [error, setError] = useState(false), [retry, setRetry] = useState(0);
  const content = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null), recordHeading = useRef<HTMLHeadingElement>(null);
  const returnTarget = useRef({ id: state.returnTo, y: state.scrollY });
  const focusNext = useRef(false);
  const titleId = useId(), searchId = useId(), recordSearchId = useId();
  const { view, topicId, query, letter, page, recordQuery, recordPage } = state;
  const isHistory = view === 'topic' && topicId === 'history';
  useEffect(() => { let current = true; void loadCannabisReferenceCatalog().then(value => { if (current) setCatalog(value); }, () => { if (current) setError(true); }); return () => { current = false; }; }, [retry]);
  useEffect(() => { remember(state); }, [state]);
  useEffect(() => {
    const hub = content.current;
    const shellHeader = hub?.closest("[data-placard-view]")?.querySelector<HTMLElement>("#placard-content > header");
    const updateOffset = () => hub?.style.setProperty("--reference-scroll-offset", `${(shellHeader?.getBoundingClientRect().height || 0) + 16}px`);
    updateOffset();
    const observer = shellHeader ? new ResizeObserver(updateOffset) : undefined;
    if (shellHeader) observer?.observe(shellHeader);
    return () => observer?.disconnect();
  }, []);
  useEffect(() => {
    if (!catalog) return;
    if (returnTarget.current.id) {
      const { id, y } = returnTarget.current;
      const target = [...(content.current?.querySelectorAll<HTMLElement>("[data-reference-entry]") || [])].find(element => element.dataset.referenceEntry === id);
      if (target) requestAnimationFrame(() => { const disclosure = target.closest('details'); if (disclosure) disclosure.open = true; target.focus({ preventScroll: true }); window.scrollTo({ top: y || 0, behavior: "instant" }); });
      returnTarget.current = { id: undefined, y: undefined };
    } else if (focusNext.current) {
      const heading = isHistory ? document.getElementById(titleId) : content.current?.querySelector<HTMLElement>("h3");
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); if (isHistory) window.scrollTo({ top: 0, behavior: 'instant' }); else heading.scrollIntoView({ block: "start", behavior: "instant" }); }
      focusNext.current = false;
    }
  }, [catalog, isHistory, state, titleId]);
  const articles = useMemo(() => [...(catalog?.articles || []), ...(catalog?.records || [])].sort(alphabetically), [catalog]);
  const indexed = useMemo(() => articles.map(article => ({ article, title: normalize(article.title), text: normalize([article.title, article.lead, ...(article.facts || []).flatMap(fact => [fact.label, fact.value]), ...article.sections.flatMap(section => [section.title, ...section.paragraphs])].join(" ")) })), [articles]);
  const words = normalize(query).split(" ").filter(Boolean);
  const matches = indexed.filter(item => words.length && words.every(word => item.text.includes(word))).sort((a, b) => {
    const rank = (item: typeof a) => item.title === normalize(query) ? 3 : item.title.includes(normalize(query)) ? 2 : words.every(word => item.title.includes(word)) ? 1 : 0;
    return rank(b) - rank(a) || alphabetically(a.article, b.article);
  }).map(item => item.article);
  const terms = useMemo(() => [...(catalog?.terms || [])].sort((a, b) => a.term.localeCompare(b.term, "fr")), [catalog]);
  const matchingTerms = terms.filter(term => words.length && words.every(word => normalize(`${term.term} ${term.definition}`).includes(word)));
  const topic = catalog?.topics.find(item => item.id === topicId);
  const topicArticles = catalog?.articles.filter(article => article.topicId === topicId) || [];
  const allTopicRecords = (catalog?.records || []).filter(article => article.topicId === topicId);
  const recordWords = normalize(recordQuery).split(" ").filter(Boolean);
  const topicRecords = (catalog?.records || []).filter(article => {
    if (article.topicId !== topicId) return false;
    if (!recordQuery.trim()) return true;
    const text = normalize([article.title, article.lead, ...(article.facts || []).flatMap(fact => [fact.label, fact.value]), ...article.sections.flatMap(section => [section.title, ...section.paragraphs])].join(" "));
    return recordWords.length > 0 && recordWords.every(word => text.includes(word));
  }).sort(alphabetically);
  const alphabetArticles = articles.filter(article => firstLetter(article.title) === letter);
  const alphabetTerms = terms.filter(term => firstLetter(term.term) === letter);
  const featured = catalog?.articles.find(article => article.id === "ref-cannabis-sativa") || catalog?.articles.find(article => article.topicId === "botany") || catalog?.articles[0];

  function navigate(next: Partial<LibraryState>) { focusNext.current = true; returnTarget.current = { id: undefined, y: undefined }; setState({ ...INITIAL, ...next }); }
  function openArticle(event: MouseEvent<HTMLAnchorElement>, articleId: string, entryId = articleId) {
    if (!plainActivation(event)) return;
    event.preventDefault();
    if (articleId.startsWith('record-terpene-')) { setTerpeneCard({ id: articleId.slice(15), ids: TERPENE_CARDS.map(item => item.id) }); return; }
    remember({ ...state, returnTo: entryId, scrollY: window.scrollY }); onOpen("reference", articleId);
  }
  function topicLink(event: MouseEvent<HTMLAnchorElement>, id: CannabisTopicId) { if (plainActivation(event)) { event.preventDefault(); navigate({ view: "topic", topicId: id }); } }
  function articleList(items: readonly CannabisReferenceArticle[], showTopic = false, illustrated = false) {
    return <ul className={illustrated ? styles.articleGallery : styles.articleList}>{items.map(article => <li key={article.id}>
      {showTopic ? <span className={styles.meta}>{catalog?.topics.find(item => item.id === article.topicId)?.title}</span> : null}
      {illustrated ? <a href={articleHref(article.id)} data-reference-entry={article.id} onClick={event => openArticle(event, article.id)}><span className={styles.articleArt}><Image src={ARTICLE_ARTWORK[article.id] || article.image.src} alt="" width={600} height={400} sizes="(max-width: 600px) 100px, (max-width: 1000px) 200px, 280px" unoptimized/></span><span className={styles.articleCopy}><strong>{article.title}</strong><span className={styles.articleLead}>{article.lead}</span><span className={styles.articleAction}>{article.id.startsWith('record-') ? 'Ouvrir la fiche' : 'Lire l’article'}<ArrowRight size={16} aria-hidden/></span></span></a> : <><a href={articleHref(article.id)} data-reference-entry={article.id} onClick={event => openArticle(event, article.id)}>{article.title}</a><p>{article.lead}</p></>}
    </li>)}</ul>;
  }
  function termList(items: readonly CannabisReferenceTerm[]) {
    return <dl className={styles.terms}>{items.map(term => <div key={term.id}><dt><a href={articleHref(term.articleId)} data-reference-entry={`term-${term.id}`} onClick={event => openArticle(event, term.articleId, `term-${term.id}`)}>{term.term}</a></dt><dd>{term.definition}</dd></div>)}</dl>;
  }
  function pagination(total: number, isRecords = false) {
    const pages = Math.max(1, Math.ceil(total / 12)), current = Math.min(isRecords ? recordPage : page, pages);
    const change = (next: number) => { if (isRecords) { setState(previous => ({ ...previous, recordPage: next, returnTo: undefined })); requestAnimationFrame(() => { recordHeading.current?.focus({ preventScroll: true }); recordHeading.current?.scrollIntoView({ block: "start", behavior: "instant" }); }); } else { focusNext.current = true; setState(previous => ({ ...previous, page: next, returnTo: undefined })); } };
    return pages > 1 ? <nav className={styles.pagination} aria-label={isRecords ? "Pages des fiches" : "Pages de l’index"}><button type="button" disabled={current === 1} onClick={() => change(current - 1)}><ArrowLeft size={16} aria-hidden/>Précédente</button><span>{current} / {pages}</span><button type="button" disabled={current === pages} onClick={() => change(current + 1)}>Suivante<ArrowRight size={16} aria-hidden/></button></nav> : null;
  }
  function pageItems<T,>(items: readonly T[], current = page) { const safe = Math.min(current, Math.max(1, Math.ceil(items.length / 12))); return items.slice((safe - 1) * 12, safe * 12); }
  function alphabet(available: readonly string[]) {
    return <nav className={styles.alphabet} aria-label="Lettres de l’index">{LETTERS.map(initial => <button key={initial} type="button" disabled={!available.includes(initial)} aria-current={initial === letter ? "page" : undefined} onClick={() => navigate({ view, letter: initial })}>{initial}</button>)}</nav>;
  }

  return <section className={styles.library} aria-labelledby={titleId} data-school-encyclopedia data-reference-view={view}>
    <div className={styles.header}><KqChapterHeading art="school" title={isHistory ? 'Histoire et anecdotes' : 'Encyclopédie du cannabis'} titleId={titleId}/></div>
    {!isHistory ? <search className={styles.search} aria-label="Recherche encyclopédique"><label htmlFor={searchId}><Search size={19} aria-hidden/>Rechercher dans l’encyclopédie</label><div className={styles.inputRow}><input ref={input} id={searchId} type="search" autoComplete="off" maxLength={200} value={query} placeholder="Une plante, une molécule, une variété…" onChange={event => { returnTarget.current = { id: undefined, y: undefined }; setState({ ...INITIAL, view: event.target.value ? "search" : "home", query: event.target.value }); }}/>{query ? <button type="button" aria-label="Effacer la recherche" onClick={() => { setState(INITIAL); input.current?.focus(); }}><X size={18} aria-hidden/></button> : null}</div></search> : null}
    <nav className={styles.mainNav} aria-label="Navigation de l’encyclopédie"><button type="button" aria-current={view === "home" ? "page" : undefined} onClick={() => navigate({ view: "home" })}>{isHistory ? <ArrowLeft size={17} aria-hidden/> : null}Rubriques</button>{!isHistory ? <><button type="button" data-reference-index aria-current={view === "index" ? "page" : undefined} onClick={() => navigate({ view: "index" })}>Articles A–Z</button><button type="button" data-reference-glossary aria-current={view === "glossary" ? "page" : undefined} onClick={() => navigate({ view: "glossary" })}>Lexique A–Z</button></> : null}</nav>
    <div ref={content} className={styles.content} data-reference-content>
      {error ? <div role="alert"><p>L’encyclopédie n’a pas pu être chargée.</p><button type="button" onClick={() => { setError(false); setRetry(value => value + 1); }}>Réessayer</button></div> : !catalog ? <p role="status">Chargement des articles…</p> : <>
        {view === "home" ? <>
          <section className={styles.directory}><h3>Choisir une rubrique</h3><ul>{catalog.topics.map(item => <li key={item.id}><a href={`?view=school&section=learn&passage=library-theme-${item.id}`} onClick={event => topicLink(event, item.id)} data-reference-topic={item.id}><span className={styles.topicArt}><Image src={item.image} alt="" width={600} height={400} sizes="(max-width: 600px) 120px, (max-width: 1000px) 230px, 300px" unoptimized/></span><span className={styles.topicCopy}><strong>{item.title}</strong><span>{item.description}</span><span className={styles.topicAction}>Explorer<ArrowRight size={17} aria-hidden/></span></span></a></li>)}</ul></section>
          {featured ? <section className={styles.featured}><div><h3><a href={articleHref(featured.id)} data-reference-entry={featured.id} onClick={event => openArticle(event, featured.id)}>{featured.title}</a></h3><p>{featured.lead}</p><a href={articleHref(featured.id)} className={styles.readLink} onClick={event => openArticle(event, featured.id)}>Lire l’article<ArrowRight size={16} aria-hidden/></a></div><figure><Image src={featured.image.src} alt={featured.image.alt} width={600} height={400} sizes="(max-width: 700px) 140px, 300px" unoptimized/><figcaption>{featured.image.caption}</figcaption></figure></section> : null}
        </> : null}
        {view === "topic" && topic ? <>
          {topic.id !== 'terpenes' && topic.id !== 'history' ? <header className={styles.topicHeader}><div><h3>{topic.title}</h3><p>{topic.description}</p></div><Image src={topic.image} alt="" width={600} height={400} sizes="(max-width: 700px) 100px, 180px" unoptimized/></header> : null}
          {topic.id === 'history' ? <><HistoryTimeline/><details className={styles.topicReading}><summary>Articles de synthèse</summary>{articleList(topicArticles, false, true)}</details></> : topic.id === 'terpenes' ? <><KqTerpeneCardDeck onOpen={(id, ids) => setTerpeneCard({ id, ids })}/><details className={styles.topicReading}><summary>Comprendre les arômes · {topicArticles.length} articles</summary>{articleList(topicArticles, false, true)}</details></> : <>
            {allTopicRecords.length ? <nav className={styles.topicNav} aria-label={`Explorer ${topic.title}`}><button type="button" aria-current={state.topicSection !== 'records' ? 'page' : undefined} onClick={() => setState(previous => ({ ...previous, topicSection: 'articles', returnTo: undefined }))}>Articles · {topicArticles.length}</button><button type="button" aria-current={state.topicSection === 'records' ? 'page' : undefined} onClick={() => setState(previous => ({ ...previous, topicSection: 'records', returnTo: undefined }))}>Fiches de référence · {allTopicRecords.length}</button></nav> : null}
            {state.topicSection !== 'records' || !allTopicRecords.length ? articleList(topicArticles, false, true) : <section className={styles.records}><h3 ref={recordHeading} tabIndex={-1}>Fiches de référence</h3><label className={styles.recordSearch} htmlFor={recordSearchId}>Rechercher une fiche<input id={recordSearchId} type="search" value={recordQuery} maxLength={100} onChange={event => setState(previous => ({ ...previous, recordQuery: event.target.value, recordPage: 1, returnTo: undefined }))}/></label><p className={styles.meta} role="status">{topicRecords.length} fiche{topicRecords.length > 1 ? "s" : ""}</p>{articleList(pageItems(topicRecords, recordPage), false, true)}{!topicRecords.length ? <p>Aucune fiche ne correspond à ce mot.</p> : null}{pagination(topicRecords.length, true)}</section>}
          </>}
        </> : null}
        {view === "index" ? <section><h3>Articles A–Z</h3>{alphabet(articles.map(article => firstLetter(article.title)))}<p className={styles.count} role="status">{alphabetArticles.length} article{alphabetArticles.length > 1 ? "s" : ""} à la lettre {letter}.</p>{articleList(pageItems(alphabetArticles), true)}{pagination(alphabetArticles.length)}</section> : null}
        {view === "glossary" ? <section><h3>Lexique A–Z</h3>{alphabet(terms.map(term => firstLetter(term.term)))}<p className={styles.count} role="status">{alphabetTerms.length} définition{alphabetTerms.length > 1 ? "s" : ""} à la lettre {letter}.</p>{termList(pageItems(alphabetTerms))}{pagination(alphabetTerms.length)}</section> : null}
        {view === "search" ? <section data-reference-results><h3>Résultats pour « {query.trim()} »</h3><p className={styles.count} role="status">{matches.length} article{matches.length > 1 ? "s" : ""}{matchingTerms.length ? ` · ${matchingTerms.length} définition${matchingTerms.length > 1 ? "s" : ""}` : ""}</p>{articleList(pageItems(matches), true)}{pagination(matches.length)}{matchingTerms.length ? <section className={styles.definitions}><h3>Définitions</h3>{termList(matchingTerms.slice(0, 6))}{matchingTerms.length > 6 ? <p className={styles.meta}>Les autres définitions sont classées dans le lexique A–Z.</p> : null}</section> : null}{!matches.length && !matchingTerms.length ? <p>Aucun résultat pour ce terme. Essaie un autre mot ou consulte les rubriques.</p> : null}</section> : null}
      </>}
    </div>
    {terpeneCard ? <KqTerpeneCardDialog initialId={terpeneCard.id} ids={terpeneCard.ids} onClose={() => setTerpeneCard(undefined)} onRead={id => { remember({ ...state, returnTo: id, scrollY: window.scrollY }); onOpen('reference', id); }}/> : null}
  </section>;
}
