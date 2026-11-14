"use client";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BookOpen, Check, Search, GraduationCap, ArrowLeft, ArrowRight } from "lucide-react";
import { searchCurriculum, type KqSchoolCurriculumData } from "@/lib/kanab-quest-school-curriculum";
import type { HistoryLesson } from "@/lib/kanab-quest-school-history-types";
import type { KqHistoryProgressState } from "@/lib/kanab-quest-school-history-outbox";
import type { KqSchoolHistoryProgressCommand } from "@/lib/kanab-quest-school-history-progress";
import { KQ_BUDDIES } from "@/lib/kanab-quest-game";
import { KqHistoryBlock, KqHistorySources, KqCurriculumSourceProvider } from "./KqHistorySources";
import { KqHistoryActivity } from "./KqHistoryActivity";
import styles from "./KqSchoolHistory.module.css";
import journey from "./KqSchoolJourney.module.css";
import { KqSchoolArticle } from "./KqSchoolArticle";

const Glossary = dynamic(() => import("./KqSchoolGlossary").then(module => module.KqSchoolGlossary), { loading: () => <p role="status">Ouverture du glossaire…</p> });
export type KqCurriculumProps = {
  ownerId?: string; focusSectionId?: string; onPassageChange: (id: string) => void; onQuiz: () => void;
  onReadBuddy: (code: string, passageId: string) => void; onOtherCourse: (id: string, passageId?: string) => void;
  onComplete: () => void; legacyRead: boolean; rewardLabel: string; quizDisabled: boolean;
  onOpenTheme?: () => void;
};
type ExtraTab = { id: string; label: string; title: string; accepts?: (passage: string) => boolean; render: (open: (id: string) => void) => ReactNode };
export type KqCurriculumActivityProps = { storageKey: string; completed?: boolean; busy: boolean; onComplete: () => void };
export function KqSchoolCurriculum({ data, progress, extraTabs = [], renderVisual, renderLessonTail, renderActivity, ...props }: KqCurriculumProps & {
  data: KqSchoolCurriculumData;
  progress: KqHistoryProgressState & { save: (delta: Partial<KqSchoolHistoryProgressCommand>) => Promise<void>; load: () => Promise<void> };
  extraTabs?: readonly ExtraTab[]; renderVisual?: (lesson: HistoryLesson) => ReactNode; renderLessonTail?: (lesson: HistoryLesson) => ReactNode;
  replaceLessonVisual?: boolean;
  renderActivity?: (lesson: HistoryLesson, activityProps: KqCurriculumActivityProps) => ReactNode;
}) {
  const { ownerId, focusSectionId, onPassageChange, onQuiz, onReadBuddy, onComplete, legacyRead, rewardLabel, quizDisabled } = props;
  const chapters = data.chapters, lessons = chapters.flatMap(chapter => chapter.lessons), terms = data.terms, sources = data.sources;
  const findLesson = (id: string) => lessons.find(lesson => lesson.id === (data.aliases[id] ?? id));
  const findChapter = (id: string) => chapters.find(chapter => chapter.lessons.some(lesson => lesson.id === id));
  const tabs = [{ id: "index", label: "Chapitres" }, ...extraTabs, { id: "glossary", label: "Glossaire" }, { id: "sources", label: "Sources" }];
  const [query, setQuery] = useState("");
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);
  const content = useRef<HTMLDivElement>(null);
  const lesson = focusSectionId ? findLesson(focusSectionId) : undefined;
  const chapter = lesson ? findChapter(lesson.id) : undefined;
  const checkpoint = chapters.find(item => item.checkpoint.id === focusSectionId);
  const nextChapter = checkpoint ? chapters[chapters.indexOf(checkpoint) + 1] : undefined;
  const term = terms.find(item => item.id === focusSectionId);
  const tab = term ? "glossary" : extraTabs.find(item => focusSectionId && item.accepts?.(focusSectionId))?.id ?? tabs.find(item => `${data.id}-${item.id}` === focusSectionId)?.id ?? "index";
  const extraTab = extraTabs.find(item => item.id === tab);
  const completed = progress.snapshot;
  const nextLesson = lesson ? lessons[lessons.findIndex(item => item.id === lesson.id) + 1] : undefined;
  const resume = completed?.resumeLessonId ? findLesson(completed.resumeLessonId) : undefined;
  const firstUnread = lessons.find(item => !completed?.lessonIds.includes(item.id)) ?? lessons[0];
  const results = searchCurriculum(query, lessons, terms);
  const complete = completed?.lessonIds.length === lessons.length && completed.checkpointIds.length === chapters.length;
  useEffect(() => { if (focusSectionId) { content.current?.focus({ preventScroll: true }); content.current?.closest('[data-school-curriculum]')?.scrollIntoView({ block: "start", behavior: "instant" }); } }, [focusSectionId]);
  const open = (id: string) => {
    const target = findLesson(id); onPassageChange(target?.id ?? id);
    if (target && completed) void progress.save({ resumeLessonId: target.id });
  };
  const sourcesOfLesson = lesson ? [...lesson.essential, lesson.example, ...lesson.deeper].flatMap(block => block.sourceIds) : [];
  const customVisual = lesson ? renderVisual?.(lesson) : null;
  const activityProps = lesson ? { storageKey: `kq-${data.id}-activity:${data.id === "history" ? "v1" : data.version}:${ownerId || "guest"}:${lesson.activity.id}`, completed: completed?.activityIds.includes(lesson.activity.id), busy: progress.busy || !completed, onComplete: () => void progress.save({ activityIds: [lesson.activity.id], resumeLessonId: lesson.id }) } : undefined;
  return <KqCurriculumSourceProvider value={sources}><section className={styles.history + " " + journey.course} data-school-history={data.id === "history" ? "" : undefined} data-school-botany={data.id === "botany" ? "" : undefined} data-school-terpenes={data.id === "terpenes" ? "" : undefined} data-school-cannabinoids={data.id === "cannabinoids" ? "" : undefined} data-school-cultivation={data.id === "cultivation" ? "" : undefined} data-school-health={data.id === "health" ? "" : undefined} data-school-soil={data.id === "soil" ? "" : undefined} data-school-products={data.id === "products" ? "" : undefined} data-school-harvest={data.id === "harvest" ? "" : undefined} data-school-curriculum={data.id}>
    <nav className={journey.topNav} aria-label={'Dans le thème '+data.label}>
      <button type="button" onClick={()=>props.onOpenTheme ? props.onOpenTheme() : onPassageChange(data.id+'-index')}><BookOpen size={18} aria-hidden/>{data.label}</button>
      <details className={journey.resources} key={focusSectionId||'index'} data-learning-resources><summary>Fiches et outils</summary>
        <div className={journey.resourceLinks}>{tabs.filter(item=>item.id!=='index').map(item=><button key={item.id} type="button" aria-current={!lesson&&!checkpoint&&tab===item.id?'page':undefined} onClick={()=>{setQuery('');onPassageChange(data.id+'-'+item.id);}}>{item.label}</button>)}</div>
        <label className={styles.search}><Search size={18} aria-hidden/><span>Rechercher une notion</span><input type="search" value={query} placeholder={data.searchPlaceholder} onChange={event=>setQuery(event.target.value)}/></label>
        {query.trim()?<div className={styles.searchResults}><p role="status">{results.length} résultats.</p>{results.map(result=><button key={result.id} type="button" onClick={()=>{setQuery('');open(result.id);}}><strong>{result.title}</strong><small>{result.kind==='term'?'Glossaire':'Leçon'}</small></button>)}{!results.length?<p>Essaie un autre mot.</p>:null}</div>:null}
      </details>
    </nav>
    {progress.error ? <div className={styles.error} role="alert"><p>{progress.error} Les contenus restent accessibles.</p><button type="button" disabled={progress.busy} onClick={() => void (completed && progress.waiting ? progress.save({}) : progress.load())}>Réessayer {progress.waiting ? "l’enregistrement" : "la connexion"}</button></div> : null}
    {progress.notice ? <p role="status">{progress.notice}</p> : null}
    {progress.waiting && !progress.error ? <div className={styles.pending} role="status"><p>{progress.busy ? "Enregistrement des étapes en cours…" : "Des étapes de lecture ou d’activité attendent encore leur enregistrement."}</p><button type="button" disabled={progress.busy || !completed} onClick={() => void progress.save({})}>Enregistrer les étapes en attente</button></div> : null}
    {!ownerId || !completed ? <p className={styles.caption}>Lecture et exercices libres. La progression détaillée sera disponible lorsque la connexion à l’école sera rétablie.</p> : null}
    <div ref={content} tabIndex={-1} className={styles.content}>
    {lesson && chapter ? <article data-history-lesson={data.id==='history'?lesson.id:undefined} data-curriculum-lesson={lesson.id}>
      <div className={journey.lessonHeading}><p>{chapter.title} · {lesson.minutes} min de lecture indicative</p></div>
      <h2 className={journey.lessonTitle}>{lesson.title}</h2>
      <KqSchoolArticle key={(ownerId||'guest')+lesson.id} lesson={lesson} hero={data.hero} customVisual={customVisual}
        activity={activityProps?(renderActivity?.(lesson,activityProps)??<KqHistoryActivity key={(ownerId||'guest')+lesson.activity.id} activity={lesson.activity} {...activityProps}/>):null}
        read={Boolean(completed?.lessonIds.includes(lesson.id))} busy={!completed||progress.busy}
        onRead={()=>void progress.save({lessonIds:[lesson.id],resumeLessonId:lesson.id})}
        chapterExercise={<button type="button" onClick={()=>onPassageChange(chapter.checkpoint.id)}>Faire le point sur le chapitre</button>}
        nextArticle={nextLesson?.title}
        onNext={()=>nextLesson&&open(nextLesson.id)}/>
      <details className={journey.more} data-learning-more><summary>Approfondir et relier les notions</summary>
        {lesson.deeper.map((block,index)=><KqHistoryBlock key={index} block={block}/>)}
        <details className={styles.context}><summary>{data.contextTitle}</summary><dl>{Object.entries(chapter.context).map(([key,value])=><div key={key}><dt>{data.contextLabels[key as keyof typeof data.contextLabels]}</dt><dd>{value}</dd></div>)}</dl></details>
        {lesson.glossaryIds.length?<div className={styles.related}><h4>Les mots utiles</h4>{lesson.glossaryIds.map(id=>{const item=terms.find(value=>value.id===id);return item?<button key={id} type="button" onClick={()=>onPassageChange(id)}>{item.term}</button>:null;})}</div>:null}
        {lesson.relatedLessonIds.length?<div className={styles.related}><h4>Relier les notions</h4>{lesson.relatedLessonIds.map(id=>{const item=findLesson(id);return item?<button key={id} type="button" onClick={()=>open(id)}>{item.title}</button>:null;})}</div>:null}
        {lesson.buddyCodes?.length?<div className={styles.related}><h4>Un repère dans le Quartier</h4>{lesson.buddyCodes.map(code=><button key={code} type="button" onClick={()=>onReadBuddy(code,lesson.id)}>{KQ_BUDDIES.find(buddy=>buddy.code===code)?.name??code} · lire la fiche</button>)}<p className={styles.caption}>La fiche du jeu est attribuée à son auteur ; elle ne remplace pas une preuve scientifique ou historique.</p></div>:null}
        {renderLessonTail?.(lesson)}
      </details>
      <KqHistorySources ids={[...sourcesOfLesson,...lesson.visual.sourceIds]} label="Sources de cet article et limites de consultation"/>
      {completed?<details className={journey.more}><summary>Mes lectures et exercices dans ce thème</summary><p>{completed.lessonIds.length}/{lessons.length} articles marqués comme lus · {completed.activityIds.length}/{lessons.length} activités enregistrées · {completed.checkpointIds.length}/{chapters.length} bilans enregistrés.</p>{legacyRead?<p>La lecture du thème est déjà enregistrée.</p>:complete?<button type="button" onClick={onComplete}>Marquer le thème terminé</button>:null}</details>:null}
    </article> : checkpoint ? <article data-history-checkpoint={data.id === "history" ? checkpoint.id : undefined} data-curriculum-checkpoint={checkpoint.id}><button type="button" onClick={() => onPassageChange(`${data.id}-index`)}><ArrowLeft size={17} aria-hidden/>Les chapitres</button><h3>{checkpoint.title}</h3><KqHistoryActivity key={`${ownerId}:${checkpoint.checkpoint.id}`} activity={checkpoint.checkpoint} storageKey={`kq-${data.id}-activity:${data.id === "history" ? "v1" : data.version}:${ownerId || "guest"}:${checkpoint.checkpoint.id}`} completed={completed?.checkpointIds.includes(checkpoint.checkpoint.id)} busy={progress.busy || !completed} onComplete={() => void progress.save({ checkpointIds: [checkpoint.checkpoint.id] })}/><div className={styles.related}>{checkpoint.lessons.map(item => <button key={item.id} type="button" onClick={() => open(item.id)}>Revoir : {item.title}</button>)}</div><div className={journey.nextAction}><button type="button" disabled={!nextChapter&&quizDisabled} onClick={()=>nextChapter?open(nextChapter.lessons[0].id):onQuiz()}>{nextChapter?'Chapitre suivant':'Jouer au quiz de synthèse'}<ArrowRight size={18} aria-hidden/></button></div></article> : <>
      {tab === "index" ? <>
        <div className={journey.hero}>
          <div><h3>{data.hero.title}</h3><p>{chapters.length} chapitres · {lessons.length} leçons</p></div>
          <Image src={data.hero.src} alt={data.hero.alt} width={1200} height={800} sizes="(max-width:700px) 100px, 30vw" unoptimized/>
          <div className={journey.heroActions}><button type="button" onClick={()=>open((resume??firstUnread).id)}>{resume?'Continuer mon parcours':'Commencer le parcours'}<ArrowRight size={18} aria-hidden/></button><button type="button" disabled={quizDisabled} onClick={onQuiz}>Jouer au quiz<GraduationCap size={18} aria-hidden/></button></div>
        </div>
        {completed?<div className={journey.metrics}><span><BookOpen size={20} aria-hidden/><strong>{completed.lessonIds.length}/{lessons.length}</strong> lectures</span><span><Check size={20} aria-hidden/><strong>{completed.activityIds.length}/{lessons.length}</strong> activités</span><span><GraduationCap size={20} aria-hidden/><strong>{completed.checkpointIds.length}/{chapters.length}</strong> bilans</span></div>:null}
        <p className={styles.caption}>{rewardLabel}</p>
        <div className={journey.chapterMap} data-learning-chapters>{chapters.map(item=>{
          const expanded=(expandedChapter??(resume?findChapter(resume.id)?.id:chapters[0].id))===item.id;
          const count=item.lessons.filter(part=>completed?.activityIds.includes(part.activity.id)).length;
          const verified=Boolean(completed?.checkpointIds.includes(item.checkpoint.id));
          return <article key={item.id} className={journey.chapter}>
            <button type="button" className={journey.chapterHeader} aria-expanded={expanded} aria-controls={item.id+'-lessons'} onClick={()=>setExpandedChapter(expanded?'':item.id)} data-learning-chapter={item.id}>
              <span>{verified?<Check size={28} aria-label="Bilan vérifié"/>:item.number}</span><span><strong>{item.title}</strong><small>{count}/{item.lessons.length} activités · {verified?'bilan vérifié':'bilan à jouer'}</small></span><span aria-hidden>{expanded?'−':'+'}</span>
            </button>
            <div id={item.id+'-lessons'} hidden={!expanded} className={journey.chapterBody}>
              <ul>{item.lessons.map(part=><li key={part.id}><button type="button" onClick={()=>open(part.id)}>{completed?.activityIds.includes(part.activity.id)?<Check size={18} aria-label="Activité enregistrée"/>:<BookOpen size={18} aria-hidden/>}{part.title}</button></li>)}</ul>
              <button type="button" onClick={()=>onPassageChange(item.checkpoint.id)}>{verified?'Rejouer le bilan':'Jouer le bilan'}</button>
              <details><summary>Les notions du chapitre</summary><p>{item.introduction}</p></details>
            </div>
          </article>;
        })}</div>
        <details className={journey.more}><summary>Le parcours et ses récompenses</summary><p>{data.hero.introduction}</p><p className={styles.caption}>{data.hero.caption}</p><p>{data.quizExplanation}</p><p>{rewardLabel}</p><p>Les activités ne versent pas de monnaie. Le plafond du quiz est conservé.</p>{legacyRead?<p>L’ancien cours reste acquis. Cette progression détaillée est distincte.</p>:null}{complete&&!legacyRead?<button type="button" onClick={onComplete}>Marquer le parcours terminé</button>:null}</details>
      </> : extraTab ? <>{((data.id==='terpenes'&&extraTab.id==='encyclopedia')||(data.id==='cannabinoids'&&extraTab.id==='register'))?null:<h2>{extraTab.title}</h2>}{extraTab.render(open)}</> : tab === "glossary" ? <Glossary key={term?.id || "all"} focusTermId={term?.id} onOpen={props.onOtherCourse}/> : <><h3>Documents et limites de consultation</h3><p>Une notice, un résumé et un document intégral ne donnent pas accès aux mêmes preuves. Chaque référence indique précisément ce qui a été consulté.</p><KqHistorySources ids={sources.map(source => source.id)} label="Références du parcours"/></>}
    </>}
    </div>
  </section></KqCurriculumSourceProvider>;
}
