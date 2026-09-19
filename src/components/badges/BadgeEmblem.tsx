import { LockKeyhole, type LucideIcon } from "lucide-react";
import styles from "./BadgeEmblem.module.css";

export type BadgeTone = "bronze" | "silver" | "gold" | "platinum" | "diamond";
export function BadgeEmblem({ icon: Icon, tone = "gold", rank = 1, unlocked = true, size = "sm", className = "" }: {
  icon: LucideIcon; tone?: BadgeTone; rank?: number; unlocked?: boolean; size?: "xs" | "sm" | "md"; className?: string;
}) {
  const marks = Math.max(1, Math.min(5, rank));
  return <span className={`${styles.emblem} ${className}`} data-badge-tone={tone} data-size={size} data-locked={!unlocked} aria-hidden="true">
    <svg viewBox="0 0 96 104" fill="none" focusable="false">
      <path className={styles.shadow} d="M48 7 85 21v31c0 23-19 40-37 49C30 92 11 75 11 52V21Z" />
      <path className={styles.shield} d="M48 3 85 17v31c0 23-19 40-37 49C30 88 11 71 11 48V17Z" />
      <path className={styles.inset} d="m48 10 30 12v26c0 19-14 34-30 42-16-8-30-23-30-42V22Z" />
      <path className={styles.laurel} d="M31 65c-9-8-12-17-10-28m2 14-6-4m8 11-7-2m11 8-7-1M65 65c9-8 12-17 10-28m-2 14 6-4m-8 11 7-2m-11 8 7-1" />
      <path className={styles.spark} d="m48 15 2 4 4 2-4 2-2 4-2-4-4-2 4-2Z" />
      <Icon x={30} y={29} width={36} height={36} strokeWidth={1.8} className={styles.symbol} />
      <path className={styles.rule} d="M33 70h30" />
      {Array.from({ length: marks }, (_, index) => <circle key={index} className={styles.mark} cx={48 + (index - (marks - 1) / 2) * 7} cy={78} r={2} />)}
      {!unlocked && <g><rect className={styles.lockPlate} x={64} y={71} width={25} height={25} rx={3} /><LockKeyhole x={69} y={76} width={15} height={15} className={styles.lock} strokeWidth={2} /></g>}
    </svg>
  </span>;
}
