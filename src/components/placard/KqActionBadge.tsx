import styles from "./KqActionBadge.module.css";

/** A count of verified choices, never a stock quantity or an unknown zero. */
export function KqActionBadge({ count, label }: { count: number | null | undefined; label?: string }) {
  if (typeof count !== "number" || !Number.isSafeInteger(count) || count <= 0) return null;
  const description = `${count} ${label ?? (count === 1 ? "action disponible" : "actions disponibles")}`;
  return <span className={styles.badge} data-action-count={count} title={description}>
    <span aria-hidden="true">{count}</span><span className={styles.srOnly}>{description}</span>
  </span>;
}
