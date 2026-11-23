import Image from "next/image";
import styles from "./KqPrintedArt.module.css";

export type KqPrintedArtKind = "school" | "quarter" | "culture" | "harvest" | "warehouse" | "commerce" | "social" | "accounts" | "staff" | "collection" | "missions" | "card-shop" | "buddies-pack" | "buddies-cards" | "album-rewards" | "achievements" | "mailbox"
  | "help-team" | "help-plan" | "help-time" | "help-culture" | "help-workshop" | "help-travel" | "help-social" | "help-accounts" | "help-training" | "help-rest" | "help-care" | "help-quality" | "producer-support" | "culture-desk" | "mission-levels" | "mission-rewards" | "staff-production" | "school-library"
  | "culture-tab-play" | "culture-tab-care" | "culture-tab-cards" | "culture-tab-harvest" | "culture-tab-journal" | "culture-tab-rules"
  | "arena" | "menu" | "game-summary";

const menuDestinations = new Set<KqPrintedArtKind>([
  "quarter", "culture", "harvest", "commerce", "warehouse", "accounts",
  "staff", "social", "school", "missions", "card-shop",
]);

/** Decorative printed vignettes. Labels, amounts and actions stay in accessible HTML. */
export function KqPrintedArt({ kind, className = "", sizes = "(max-width: 600px) 96px, 160px", variant }: {
  kind: KqPrintedArtKind;
  className?: string;
  sizes?: string;
  variant?: "menu";
}) {
  if (kind === "arena" || kind === "menu" || kind === "game-summary" || (variant === "menu" && menuDestinations.has(kind))) {
    return <span className={`${styles.art} ${styles.menuArt} ${className}`} aria-hidden="true">
      <Image src={`/placard/ui/navigation/${kind}-v1.webp`} alt="" width={112} height={112} unoptimized />
    </span>;
  }
  if (kind === "school-library") return <span className={`${styles.art} ${className}`} aria-hidden="true">
    <Image src="/placard/school/isometric/library.webp" alt="" width={980} height={690} sizes={sizes} />
  </span>;
  if (kind === "buddies-pack") return <span className={`${styles.art} ${styles.squareArt} ${className}`} aria-hidden="true">
    <Image src="/app/lottery/sealed-booster-pack-sylvain-v3.webp" alt="" fill sizes={sizes} />
  </span>;
  if (kind === "buddies-cards") return <span className={`${styles.art} ${styles.squareArt} ${styles.cardFan} ${className}`} aria-hidden="true">
    {[0, 1, 2].map(index => <Image key={index} src="/app/lottery/tcg-card-back-sylvain-v2.webp" alt="" width={1024} height={1536} sizes={sizes} />)}
  </span>;
  if (kind === "album-rewards") return <span className={`${styles.art} ${className}`} aria-hidden="true">
    <Image src="/placard/shop-item-gift-v2.webp" alt="" width={1254} height={1254} sizes={sizes} />
  </span>;
  const height = kind.startsWith("culture-tab-") ? 256 : 512;
  const width = kind === "culture-desk" || kind === "staff-production" ? 1536 : kind === "mission-levels" ? 768 : height;
  return <span className={`${styles.art} ${className}`} aria-hidden="true">
    <Image src={`/placard/ui/${kind}-${kind === "school" ? "v4" : kind === "culture" || kind === "culture-desk" || kind === "mission-rewards" ? "v2" : "v1"}.webp`} alt="" width={width} height={height} sizes={sizes} />
  </span>;
}
