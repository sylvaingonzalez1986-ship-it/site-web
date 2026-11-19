import type { ReactNode } from "react";
import styles from "./KqChapterHeading.module.css";

export function KqChapterHeading({ title, level = 2, titleId, children, actions, compact = false }: {
  title: string;
  level?: 1 | 2;
  titleId?: string;
  children?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
}) {
  const Heading = level === 1 ? "h1" : "h2";
  return <header className={`${styles.heading} ${compact ? styles.compact : ""}`} data-kq-chapter>
    <div className={styles.copy}>
      <Heading id={titleId} className={styles.title}>{title}</Heading>
      {children ? <div className={styles.description}>{children}</div> : null}
    </div>
    {actions ? <div className={styles.actions}>{actions}</div> : null}
  </header>;
}
