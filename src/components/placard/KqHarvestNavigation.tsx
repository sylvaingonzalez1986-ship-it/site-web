"use client";

import styles from "./PlacardPlayerShell.module.css";

/** Shared navigation around the player's jury, including the story's local jury. */
export function KqHarvestNavigation({ onOpenHarvests }: { onOpenHarvests: (section: "overview" | "storage") => void }) {
  return <nav className={styles.localNav} aria-label="Parcours des récoltes">
    <button type="button" onClick={() => onOpenHarvests("overview")}>Toutes mes récoltes</button>
    <span aria-current="page">Jury &amp; duels</span>
    <button type="button" onClick={() => onOpenHarvests("storage")}>Stockage &amp; affinage</button>
  </nav>;
}
