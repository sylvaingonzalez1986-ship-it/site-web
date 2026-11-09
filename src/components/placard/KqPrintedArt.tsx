import Image from "next/image";
import styles from "./KqPrintedArt.module.css";

export type KqPrintedArtKind = "quarter" | "culture" | "harvest" | "warehouse" | "commerce" | "social" | "accounts" | "staff" | "collection" | "missions" | "card-shop" | "achievements" | "mailbox"
  | "help-team" | "help-plan" | "help-time" | "help-culture" | "help-workshop" | "help-travel" | "help-social" | "help-accounts" | "help-training" | "help-rest" | "help-care" | "help-quality" | "producer-support" | "culture-desk" | "mission-levels" | "mission-rewards";

/** Decorative printed vignettes. Labels, amounts and actions stay in accessible HTML. */
export function KqPrintedArt({ kind, className = "", sizes = "(max-width: 600px) 96px, 160px" }: { kind: KqPrintedArtKind; className?: string; sizes?: string }) {
  return <span className={`${styles.art} ${className}`} aria-hidden="true">
    <Image src={`/placard/ui/${kind}-${kind === "culture" || kind === "culture-desk" || kind === "mission-rewards" ? "v2" : "v1"}.webp`} alt="" width={kind === "culture-desk" ? 1536 : kind === "mission-levels" ? 768 : 512} height={512} sizes={sizes} />
  </span>;
}
