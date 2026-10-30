"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type MouseEvent } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "@/components/navigation/NavigationLink";
import { AppDialog } from "@/components/ui/AppDialog";
import { isRenderableImageSource } from "@/lib/image-source";
import { navigateAfterOverlays } from "@/lib/overlay-history";
import type { ContestBundleReceipt } from "@/lib/contest-bundle-rewards";
import styles from "./ContestBundleCardReveal.module.css";

const BACK = "/app/lottery/tcg-card-back-sylvain-v2.webp";
type Phase = "sealed" | "revealing" | "revealed";

/** Presentation only: the paid reward and random card already exist on the server. */
export function ContestBundleCardReveal(props: { receipt: ContestBundleReceipt; autoOpen?: boolean }) {
  return <CardReveal key={`${props.receipt.orderId}:${props.receipt.grantedAt}`} {...props} />;
}

function CardReveal({ receipt, autoOpen = false }: { receipt: ContestBundleReceipt; autoOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(false);
  const [phase, setPhase] = useState<Phase>("sealed");
  const [imageFailed, setImageFailed] = useState(false);
  const storageKey = `contest-bundle-revealed:${receipt.orderId}:${receipt.grantedAt}`;

  useEffect(() => {
    let alreadySeen = false;
    try { alreadySeen = localStorage.getItem(storageKey) === "1"; } catch { /* Storage is optional. */ }
    setSeen(alreadySeen);
    setPhase(alreadySeen ? "revealed" : "sealed");
    if (autoOpen && !alreadySeen) setOpen(true);
  }, [storageKey, autoOpen]);

  useEffect(() => {
    if (!open || phase !== "revealing") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finish = () => setPhase("revealed");
    const onPreference = () => { if (media.matches) finish(); };
    const timer = window.setTimeout(finish, media.matches ? 0 : 1100);
    media.addEventListener("change", onPreference);
    return () => { window.clearTimeout(timer); media.removeEventListener("change", onPreference); };
  }, [open, phase]);

  useEffect(() => {
    if (phase !== "revealed") return;
    setSeen(true);
    try { localStorage.setItem(storageKey, "1"); } catch { /* Never needed to keep the reward. */ }
  }, [phase, storageKey]);

  const close = () => {
    setOpen(false);
    if (phase === "revealing") setPhase("sealed");
  };
  const reveal = () => setPhase(window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "revealed" : "revealing");
  const revealed = phase === "revealed";
  const navigate = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigateAfterOverlays(() => router.push(href));
  };

  return <div className={styles.reward} data-contest-card-reward>
    <p>{seen ? <><strong>{receipt.card.name}</strong> · Buddie épique</> : "Ton Buddie épique est prêt à être découvert."}</p>
    <button type="button" className={styles.action} data-contest-card-open onClick={() => setOpen(true)}>
      <Sparkles size={18} aria-hidden="true" />{seen ? "Revoir ma carte" : "Découvrir ma carte épique"}
    </button>
    <AppDialog open={open} onClose={close} title="Ton Buddie épique" className={styles.dialog} bodyClassName={styles.body}
      dialogProps={{ "data-contest-card-reveal": true, "data-phase": phase }}>
      <p className={styles.context}>Le grand tour des fleurs concours est complété.</p>
      <div className={styles.stage} data-phase={phase} aria-hidden="true">
        <div className={styles.halo} />
        <div className={styles.card}>
          <div className={styles.back}><Image src={BACK} alt="" fill sizes="240px" loading="eager" /></div>
          <div className={styles.front}>
            {isRenderableImageSource(receipt.card.imageUrl) && !imageFailed
              ? <Image src={receipt.card.imageUrl} alt="" fill sizes="240px" loading="eager" className={styles.art} onError={() => setImageFailed(true)} />
              : <div className={styles.fallback}><Sparkles size={54} /><strong>{receipt.card.name}</strong><span>Buddie épique</span></div>}
          </div>
        </div>
        <Sparkles className={styles.sparkLeft} /><Sparkles className={styles.sparkRight} />
      </div>
      <div className={styles.result} role="status" aria-live="polite" aria-atomic="true">
        {revealed ? <><h3>{receipt.card.name}</h3><p>Buddie épique · ajouté à ta collection</p></>
          : <p>{phase === "revealing" ? "Ta carte se dévoile…" : "Une carte tirée au sort parmi les Buddies épiques."}</p>}
      </div>
      {revealed ? <>
        <p className={styles.packs}>{receipt.buddiesPacks} packs Buddies et {receipt.bottePacks} packs Botte du Chanvrier sont aussi crédités.</p>
        <Link href="/profil/collection" className={styles.action} onClick={event => navigate(event, "/profil/collection")}>Voir ma collection <ArrowRight size={18} aria-hidden="true" /></Link>
        <Link href="/arene/placard?view=shop" className={styles.secondary} onClick={event => navigate(event, "/arene/placard?view=shop")}>Ouvrir mes packs Botte du Chanvrier</Link>
      </> : <button type="button" className={styles.action} data-contest-card-turn onClick={phase === "revealing" ? () => setPhase("revealed") : reveal}>
        {phase === "revealing" ? "Passer l’animation" : "Révéler ma carte"}<Sparkles size={18} aria-hidden="true" />
      </button>}
      <p className={styles.saved}>Ta carte est déjà sauvegardée. Fermer cette fenêtre ne change pas le tirage.</p>
    </AppDialog>
  </div>;
}
