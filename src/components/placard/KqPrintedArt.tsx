import Image from "next/image";
import styles from "./KqPrintedArt.module.css";

export type KqPrintedArtKind = "quarter" | "culture" | "harvest" | "warehouse" | "commerce" | "social" | "accounts" | "collection" | "missions" | "card-shop" | "achievements";

/** Decorative printed vignettes. Labels, amounts and actions stay in accessible HTML. */
export function KqPrintedArt({ kind, className = "", sizes = "(max-width: 600px) 96px, 160px" }: { kind: KqPrintedArtKind; className?: string; sizes?: string }) {
  return <span className={`${styles.art} ${className}`} aria-hidden="true">
    <Image src={`/placard/ui/${kind}-v1.webp`} alt="" width={512} height={512} sizes={sizes} />
  </span>;
}
