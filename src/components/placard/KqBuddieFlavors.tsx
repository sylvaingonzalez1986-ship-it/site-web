import Image from "next/image";
import { getKqBuddieFlavors, KQ_FLAVORS, type KqFlavorCode } from "@/lib/kanab-quest-buddie-flavors";
import styles from "./KqBuddieFlavors.module.css";

type Props = { compact?: boolean } & (
  | { varietyCode: string; flavorCodes?: never }
  | { flavorCodes: readonly [KqFlavorCode, KqFlavorCode]; varietyCode?: never }
);

/** Shared by cultivation cards and client requests so each taste keeps one visual identity. */
export function KqBuddieFlavors({ varietyCode, flavorCodes, compact = false }: Props) {
  const flavors = flavorCodes
    ? flavorCodes.map((code) => KQ_FLAVORS[code])
    : getKqBuddieFlavors(varietyCode);
  if (!flavors.length) return null;

  return <ul className={styles.flavors} data-compact={compact || undefined} aria-label={flavorCodes ? "Les deux arômes recherchés" : "Les deux goûts de cette variété"}>
    {flavors.map((flavor) => <li key={flavor.code} className={styles.flavor}>
      <Image src={flavor.image} alt="" width={80} height={80} sizes={compact ? "40px" : "64px"} />
      <span>{flavor.label}</span>
    </li>)}
  </ul>;
}
