"use client";
import Image from "next/image";
import { Fragment, useEffect, useRef, type MouseEvent } from "react";
import { ChevronDown } from "lucide-react";
import type { CannabisReferenceArticle, CannabisReferenceTopic, CannabisTopicId } from "@/lib/kanab-quest-cannabis-reference-types";
import type { HistorySource } from "@/lib/kanab-quest-school-history-types";
import styles from "./KqCannabisArticle.module.css";
import { KqTerpeneArticleCard } from './KqTerpeneCards';
import { KqPrintedArt } from './KqPrintedArt';
import { cannabisArticleReferences } from '@/lib/kanab-quest-cannabis-citations';

export type KqCannabisArticleProps = {
  article: CannabisReferenceArticle;
  sources: readonly HistorySource[];
  relatedArticles: readonly CannabisReferenceArticle[];
  topic?: CannabisReferenceTopic;
  onOpenArticle: (id: string) => void;
  onOpenTopic: (id: CannabisTopicId) => void;
  onHome?: () => void;
};
const articleHref = (id: string) => `?view=school&section=learn&module=reference&passage=${encodeURIComponent(id)}`;
const plainActivation = (event: MouseEvent<HTMLAnchorElement>) => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
const topicNames: Record<CannabisTopicId, string> = { botany: "Botanique", diversity: "Variétés et génétique", history: "Histoire", cannabinoids: "Cannabinoïdes", terpenes: "Terpènes", cultivation: "Culture, sol et nutrition", health: "Maladies et ravageurs", products: "Usages et matériaux", quality: "Qualité et réglementation" };

export function KqCannabisArticle({ article, sources, relatedArticles, topic, onOpenArticle, onOpenTopic, onHome }: KqCannabisArticleProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const sectionId = (id: string) => `cannabis-${article.id}-${id}`;
  const { references, numbers } = cannabisArticleReferences(article, sources);
  const related = relatedArticles.filter(item => item.id !== article.id);
  const showImage = !article.diagram || Boolean(article.image.kind);
  const showInfobox = showImage || Boolean(article.facts?.length);
  useEffect(() => {
    const title = heading.current;
    const articleElement = title?.closest("article");
    const shellHeader = title?.closest("[data-placard-view]")?.querySelector<HTMLElement>("#placard-content > header");
    const updateOffset = () => articleElement?.style.setProperty("--reference-scroll-offset", `${(shellHeader?.getBoundingClientRect().height || 0) + 16}px`);
    updateOffset();
    const focusPassage = () => {
      let anchor: HTMLElement | null = null;
      try { anchor = document.getElementById(decodeURIComponent(window.location.hash.slice(1))); } catch { /* An invalid fragment falls back to the article title. */ }
      const target = anchor && articleElement?.contains(anchor) ? anchor : title;
      const aliasHeading = target?.hasAttribute('data-reference-anchor') ? target.closest('section')?.querySelector<HTMLElement>('h3') : undefined;
      const focusTarget = target?.querySelector<HTMLElement>('h3') || aliasHeading || target;
      if (focusTarget) { focusTarget.tabIndex = -1; focusTarget.focus({ preventScroll: true }); }
      (target === title ? articleElement : target)?.scrollIntoView({ block: "start", behavior: "instant" });
    };
    const frame = requestAnimationFrame(focusPassage);
    window.addEventListener('hashchange', focusPassage);
    const observer = shellHeader ? new ResizeObserver(updateOffset) : undefined;
    if (shellHeader) observer?.observe(shellHeader);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('hashchange', focusPassage); observer?.disconnect(); };
  }, [article.id]);
  function referenceLinks(ids: readonly string[]) {
    return <sup className={styles.citations}>{[...new Set(ids.map(id => numbers.get(id)))].map(number =>
      number ? <a key={number} href={`#${sectionId(`reference-${number}`)}`} aria-label={`Référence ${number}`}>[{number}]</a> : null
    )}</sup>;
  }
  function openArticle(event: MouseEvent<HTMLAnchorElement>, id: string) {
    if (!plainActivation(event)) return;
    event.preventDefault(); onOpenArticle(id);
  }
  const contents = <nav aria-label="Sommaire de l’article"><ol>
    {article.sections.map(section => <li key={section.id}><a href={`#${sectionId(section.id)}`}>{section.title}</a></li>)}
    {related.length ? <li><a href={`#${sectionId("related")}`}>Articles connexes</a></li> : null}
    <li><a href={`#${sectionId("references")}`}>Références</a></li>
  </ol></nav>;
  const diagram = article.diagram;
  const diagramAfter = diagram?.afterSectionId || article.sections[0]?.id;
  const diagramFigure = diagram ? <figure className={styles.diagram} data-reference-diagram={diagram.kind} aria-labelledby={sectionId('diagram-title')}>
    <figcaption id={sectionId('diagram-title')}><strong>{diagram.title}</strong></figcaption>
    <ol className={styles.diagramNodes}>{diagram.nodes.map((node, index) => <li key={index}>
      <strong>{node.label}</strong>
      {node.carbonAtoms ? <span className={styles.carbonAtoms} role="img" aria-label={`${node.carbonAtoms} atomes de carbone`}>
        {Array.from({ length: node.carbonAtoms }, (_, atom) => <span key={atom} aria-hidden="true">C</span>)}
      </span> : null}
      <p>{node.detail}</p>
    </li>)}</ol>
    <p className={styles.diagramCaption}>{diagram.caption}{referenceLinks(diagram.sourceIds)}</p>
  </figure> : null;

  return <article className={styles.article} data-cannabis-article={article.id}>
    <nav className={styles.breadcrumb} aria-label="Fil d’Ariane">
      <a className={styles.libraryLink} href="?view=school&section=learn" onClick={event => { if (onHome && plainActivation(event)) { event.preventDefault(); onHome(); } }}>
        <KqPrintedArt kind="school-library" className={styles.libraryMark} sizes="72px"/>Encyclopédie
      </a>
      <span aria-hidden>›</span>
      <a href={`?view=school&section=learn&passage=library-theme-${article.topicId}`} onClick={event => { if (plainActivation(event)) { event.preventDefault(); onOpenTopic(article.topicId); } }}>{topic?.title || topicNames[article.topicId]}</a>
    </nav>
    <h2 ref={heading} tabIndex={-1} className={styles.title}>{article.title}</h2>
    <div className={styles.layout}>
      <aside className={styles.contents}><h3>Sommaire</h3>{contents}</aside>
      <div className={styles.body}>
        <details className={styles.mobileContents}><summary>Sommaire<ChevronDown size={18} aria-hidden/></summary>{contents}</details>
        <div className={`${styles.introduction} ${showInfobox ? '' : styles.textIntroduction} ${showImage && article.image.kind ? styles.documentaryIntroduction : ''}`}>
          <p className={styles.lead}>{article.lead}</p>
          {showInfobox ? <aside className={styles.infobox}>
            {showImage ? <figure><Image data-scientific-drawing={article.image.kind === 'diagram' ? 'true' : undefined} src={article.image.src} alt={article.image.alt} width={600} height={400} sizes="(max-width: 760px) 90vw, 500px" unoptimized/><figcaption>{article.image.caption}{article.image.author ? <span className={styles.imageCredits}>{article.image.author}</span> : null}<span className={styles.imageCredits}><a href={article.image.src} target="_blank" rel="noreferrer">Voir l’image en grand (nouvel onglet)</a>{article.image.sourceUrl ? <a href={article.image.sourceUrl} target="_blank" rel="noreferrer">Source</a> : null}{article.image.licenseUrl ? <a href={article.image.licenseUrl} target="_blank" rel="noreferrer">{article.image.license || 'Licence du visuel'}</a> : null}</span></figcaption></figure> : null}
            {article.facts?.length ? <dl>{article.facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl> : null}
          </aside> : null}
        </div>
        {article.id.startsWith('record-terpene-') ? <details className={styles.aromaCard}><summary>Carte d’arômes</summary><KqTerpeneArticleCard id={article.id.slice(15)} onRead={onOpenArticle}/></details> : null}
        {article.sections.map(section => <Fragment key={section.id}><section id={sectionId(section.id)} className={styles.section} aria-labelledby={sectionId(`${section.id}-title`)}>
          {section.anchorIds?.map(id => <span key={id} id={sectionId(id)} className={styles.legacyAnchor} data-reference-anchor aria-hidden="true"/>)}
          <h3 id={sectionId(`${section.id}-title`)}>{section.title}</h3>
          {section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}{index === section.paragraphs.length - 1 ? referenceLinks(section.sourceIds) : null}</p>)}
          {section.details ? <details className={styles.furtherReading}>
            <summary>{section.details.title}</summary>
            {section.details.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}{index === section.details!.paragraphs.length - 1 ? referenceLinks(section.details!.sourceIds) : null}</p>)}
          </details> : null}
        </section>{section.id === diagramAfter || section.anchorIds?.includes(diagramAfter || '') ? diagramFigure : null}</Fragment>)}
        {related.length ? <section id={sectionId("related")} className={styles.related}><h3>Articles connexes</h3><ul>{related.map(item => <li key={item.id}><a href={articleHref(item.id)} onClick={event => openArticle(event, item.id)}>{item.title}</a></li>)}</ul></section> : null}
        <section id={sectionId("references")} className={styles.references} aria-labelledby={sectionId("references-title")}>
          <h3 id={sectionId("references-title")}>Références</h3>
          <ol>{references.map((source, index) => <li key={source.id} id={sectionId(`reference-${index + 1}`)}>
            <span>{source.author || source.organization}{source.published ? ` (${source.published})` : ""}. </span><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
            {source.organization && source.organization !== source.author ? <span>. {source.organization}.</span> : null}
            {source.verifiedAt && source.access !== 'unavailable' ? <span> Consulté le {source.verifiedAt}.</span> : null}
            {source.passage || source.access !== "full-text" || source.limitation ? <details><summary>Notice de la référence</summary><p>{source.access === "unavailable" ? "Document non relu lors de cette révision." : source.access === "abstract" ? "Résumé consulté." : source.access === "catalogue" ? "Notice de catalogue consultée." : source.access === "excerpt" ? "Extrait consulté." : source.access === "official-page" ? "Page officielle consultée." : "Texte intégral consulté."}</p>{source.passage ? <p>{source.passage}</p> : null}{source.limitation ? <p>{source.limitation}</p> : null}</details> : null}
          </li>)}</ol>
        </section>
      </div>
    </div>
  </article>;
}
