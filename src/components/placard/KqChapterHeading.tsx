import type { ReactNode } from "react";
import { KqPrintedArt, type KqPrintedArtKind } from "./KqPrintedArt";
import styles from "./KqChapterHeading.module.css";

/** A chapter opening: the destination's illustration beside a readable HTML title. */
export function KqChapterHeading({ art, title, level = 2, titleId, children, actions, compact = false }: {
  art: KqPrintedArtKind;
  title: string;
  level?: 1 | 2;
  titleId?: string;
  children?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
}) {
  const Heading = level === 1 ? "h1" : "h2";
  return <header className={`${styles.heading} ${compact ? styles.compact : ""}`} data-kq-chapter={art}>
    <div className={styles.copy}>
      <Heading id={titleId} className={styles.title}>{title}</Heading>
      {children ? <div className={styles.description}>{children}</div> : null}
    </div>
    <KqPrintedArt kind={art} className={styles.illustration} sizes="(max-width: 600px) 96px, 205px" />
    {actions ? <div className={styles.actions}>{actions}</div> : null}
  </header>;
}
