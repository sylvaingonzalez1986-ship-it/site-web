import { getKqEquipmentVisualTier } from "@/lib/kanab-quest-equipment-artwork";
import styles from "./KqEquipmentTierBadge.module.css";

export function KqEquipmentTierBadge({ level }: { level: number }) {
  const tier = getKqEquipmentVisualTier(level);
  return <span className={styles.frame} data-tier={tier}>
    <span className={styles.badge}>NIV. {level}{tier >= 5 ? <b aria-hidden="true">{tier === 10 ? "★★★" : "★"}</b> : null}</span>
    {tier >= 5 ? <span className={styles.console} aria-hidden="true"><i /><i /><i /></span> : null}
    {tier === 10 ? <span className={styles.crown} aria-hidden="true" /> : null}
  </span>;
}
