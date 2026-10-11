import styles from "./KqEquipmentTierBadge.module.css";

export function KqEquipmentTierBadge({ level, configuration }: { level: number; configuration?: number }) {
  const tier = level >= 7 ? 10 : level >= 4 ? 5 : 1;
  return <span className={styles.frame} data-tier={tier}>
    <span className={styles.badge}>NIV. {level}{configuration ? <b>Configuration {configuration}/3</b> : null}</span>
  </span>;
}
