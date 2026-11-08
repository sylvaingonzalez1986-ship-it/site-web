"use client";

import { useId, useState, type ReactNode } from "react";
import { KqPrintedArt, type KqPrintedArtKind } from "./KqPrintedArt";
import styles from "./KqHelpDashboard.module.css";

/** Compact, readable rules inside existing disclosures; values remain real HTML. */
export function KqHelpDashboard({ children }: { children: ReactNode }) {
  return <div className={styles.dashboard} data-help-dashboard>{children}</div>;
}

export function KqHelpGrid({ items, art = "help-plan" }: { art?: KqPrintedArtKind; items: { label: string; value: ReactNode; detail?: ReactNode; icon?: ReactNode; art?: KqPrintedArtKind }[] }) {
  return <dl className={styles.grid} data-help-facts>{items.map((item, index) => <div className={styles.fact} key={`${item.label}-${index}`}>
    <dt><KqPrintedArt kind={item.art ?? art} className={styles.factArt} sizes="128px" /><span className={styles.factLabel}>{item.label}</span></dt>
    <dd><strong className={styles.value}>{item.value}</strong>{item.detail ? <span className={styles.caption}>{item.detail}</span> : null}</dd>
  </div>)}</dl>;
}

export function KqHelpSteps({ steps, art = "help-plan" }: { art?: KqPrintedArtKind; steps: { label: string; detail?: ReactNode; icon?: ReactNode; art?: KqPrintedArtKind }[] }) {
  return <div className={styles.stepFrame}><ol className={styles.steps} data-help-steps data-step-columns={steps.length === 4 ? 2 : Math.min(3, steps.length)}>{steps.map((step, index) => <li key={`${step.label}-${index}`}>
    <KqPrintedArt kind={step.art ?? art} className={styles.stepArt} sizes="128px" />
    <div><strong><span className={styles.stepMarker} aria-hidden="true">{index + 1}</span>{step.label}</strong>{step.detail ? <span className={styles.caption}>{step.detail}</span> : null}</div>
  </li>)}</ol></div>;
}

export function KqHelpNote({ children, art }: { children: ReactNode; art?: KqPrintedArtKind }) {
  return <div className={`${styles.note} ${art ? styles.illustratedNote : ""}`}>{art ? <KqPrintedArt kind={art} sizes="112px" /> : null}<div>{children}</div></div>;
}

/** All landmarks stay visible; only the selected explanation opens. */
export function KqHelpTopics({ label, topics }: { label: string; topics: { id: string; label: string; value: string; art: KqPrintedArtKind; content: ReactNode }[] }) {
  const [selected, setSelected] = useState(topics[0]?.id);
  const id = useId();
  const active = topics.some(topic => topic.id === selected) ? selected : topics[0]?.id;
  return <div className={styles.topics} data-help-topics>
    <div className={styles.topicButtons} role="group" aria-label={label}>{topics.map(topic => <button type="button" key={topic.id} id={`${id}-${topic.id}-button`} aria-controls={`${id}-${topic.id}-panel`} aria-pressed={active === topic.id} onClick={() => setSelected(topic.id)} data-help-topic={topic.id}>
      <KqPrintedArt kind={topic.art} className={styles.topicArt} sizes="(max-width: 500px) 96px, 128px" />
      <span>{topic.label}</span><small>{topic.value}</small>
    </button>)}</div>
    {topics.map(topic => <section key={topic.id} id={`${id}-${topic.id}-panel`} aria-labelledby={`${id}-${topic.id}-button`} hidden={active !== topic.id} className={styles.topicPanel} data-help-topic-panel={topic.id}>{topic.content}</section>)}
  </div>;
}
