"use client";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Sparkles, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { isRenderableImageSource } from "@/lib/image-source";
import { rarityLabels } from "@/lib/lottery-card-ui";
import { useBoosterSound } from "@/hooks/useBoosterSound";
import type { ScratchResult } from "@/types/lottery";
import { PackSwipeCut } from "./PackSwipeCut";
import styles from "./PackOpening.module.css";

type Phase = "idle" | "opening" | "cards" | "recap" | "error";
type Card = ScratchResult["cards"][number];
const COLORS = { common: "#bde5c7", silver: "#c0e5ff", gold: "#ffd252", epic: "#d598ff", legendary: "#ffaf48" };
const FREQUENCIES = { common: 330, silver: 392, gold: 440, epic: 554, legendary: 660 };
const BACK = "/app/lottery/tcg-card-back.png";
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function CardFace({ card }: { card: Card }) {
  return <div className={styles.cardFace}>
    <div className={styles.cardArt}>{isRenderableImageSource(card.imageUrl)
      ? <Image src={card.imageUrl} alt="" fill sizes="(max-width: 700px) 65vw, 320px" className={styles.art} />
      : <Sparkles aria-hidden="true" />}</div>
    <div className={styles.cardCaption}><span>{card.isBonus ? "Bonus" : rarityLabels[card.rarity]} · #{card.cardNumber}</span><strong>{card.name}</strong><small>{card.isBonus ? "Bon à choisir" : card.ownedCount > 1 ? `Doublon ×${card.ownedCount}` : "Nouvelle carte"}</small></div>
  </div>;
}

export function PackOpeningAnimation({ packNumber, onOpen, onContinue, disabled = false, demo = false, compact = false }: {
  packNumber: string; onOpen: () => Promise<ScratchResult>; onContinue?: (result: ScratchResult) => void;
  disabled?: boolean; demo?: boolean; compact?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<ScratchResult | null>(null);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [attempt, setAttempt] = useState(0);
  const busy = useRef(false), mounted = useRef(true), skip = useRef(false), swiped = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gesture = useRef<{ x: number; y: number; id: number } | null>(null);
  const { enabled: soundEnabled, toggle: toggleSound, play } = useBoosterSound();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (timer.current) clearTimeout(timer.current); }; }, []);

  const beginOpening = async () => {
    if (busy.current || disabled || !["idle", "error"].includes(phase)) return;
    busy.current = true; skip.current = false;
    setError(""); setResult(null); setPhase("opening"); play(196);
    const started = performance.now();
    try {
      const next = await onOpen();
      if (!mounted.current) return;
      if (!next.cards?.length) throw new Error("Les cartes ne sont pas encore disponibles. Réessaie ce même booster.");
      setResult(next);
      const delay = skip.current || reducedMotion() ? 0 : Math.max(0, 1400 - (performance.now() - started));
      timer.current = setTimeout(() => { if (mounted.current) { setPhase("cards"); busy.current = false; } }, delay);
    } catch (cause) {
      if (!mounted.current) return;
      busy.current = false; setPhase("error"); setAttempt(value => value + 1);
      setError(cause instanceof Error ? cause.message : "Impossible d’ouvrir ce booster. Réessaie.");
    }
  };
  const reveal = useCallback(() => {
    if (phase !== "cards" || !result || revealed.includes(index)) return;
    setRevealed(values => values.includes(index) ? values : [...values, index]);
    play(FREQUENCIES[result.cards[index].rarity]);
  }, [index, phase, result, revealed, play]);
  const current = result?.cards[index], visible = revealed.includes(index), total = result?.cards.length ?? 0;
  const allRevealed = total > 0 && revealed.length === total;
  const rarity = visible && current ? current.rarity : "common";
  const go = (direction: number) => {
    if (direction > 0 && !visible) { reveal(); return; }
    setIndex(value => Math.max(0, Math.min(total - 1, value + direction)));
  };
  const endGesture = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = gesture.current; gesture.current = null;
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) { swiped.current = true; if (!visible) reveal(); else go(dx < 0 ? 1 : -1); }
  };
  useEffect(() => {
    if (!demo || phase !== "cards") return;
    const id = setTimeout(() => { if (!visible) reveal(); else if (index < total - 1) setIndex(index + 1); else setPhase("recap"); }, 1000);
    return () => clearTimeout(id);
  }, [demo, phase, index, total, visible, reveal]);
  const skipOpening = () => { skip.current = true; if (result) { if (timer.current) clearTimeout(timer.current); busy.current = false; setPhase("cards"); } };
  const recap = () => { setRevealed(result?.cards.map((_, i) => i) ?? []); setPhase("recap"); };
  const newCards = result?.cards.filter(card => !card.isBonus && card.ownedCount <= 1).length ?? 0;
  const duplicates = result?.cards.filter(card => !card.isBonus && card.ownedCount > 1).length ?? 0;

  return <div className={styles.experience} data-pack-phase={phase} data-rarity={rarity} data-revealed={visible || undefined} data-compact={compact || undefined} style={{ "--rarity": COLORS[rarity] } as CSSProperties}>
    <div className={styles.scenery} aria-hidden="true"><div className={styles.beams} /><div className={styles.floor} /><div className={styles.portal} /></div>
    <header className={styles.header}><div><span>Kanab Quest · Booster</span><p>{packNumber}</p></div><button type="button" className={styles.sound} aria-label="Son de l’ouverture" aria-pressed={soundEnabled} onClick={toggleSound}>{soundEnabled ? <Volume2 /> : <VolumeX />}<span>Son {soundEnabled ? "ON" : "OFF"}</span></button></header>

    {["idle", "opening", "error"].includes(phase) && <>
      <div className={styles.packStage}><div className={styles.packStack} aria-hidden="true"><i /><i /><i /></div><div className={styles.pack}><PackSwipeCut key={attempt} disabled={disabled || phase === "opening"} splitting={phase === "opening"} onThresholdReached={() => void beginOpening()} /></div>{phase === "opening" && <div className={styles.burst} aria-hidden="true" />}</div>
      <footer className={styles.controls}>
        <div aria-live="polite"><span className={styles.eyebrow}>{phase === "opening" ? "Le pack s’ouvre" : "À toi de jouer"}</span><h2>{phase === "opening" ? "Place aux surprises." : "Déchire. Découvre."}</h2><p>{phase === "opening" ? "Tes cartes arrivent…" : "Glisse sur le pack pour déchirer la fermeture."}</p></div>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {phase === "opening" ? <button className={styles.secondary} type="button" onClick={skipOpening}>Passer l’animation</button> : <button className={styles.primary} type="button" disabled={disabled} onClick={() => void beginOpening()}>{phase === "error" ? "Réessayer" : "Ouvrir le pack"}<ArrowRight aria-hidden="true" /></button>}
      </footer>
    </>}

    {phase === "cards" && current && result && <>
      <div className={styles.revealStage}>
        <div key={`${index}-${visible}`} className={styles.revealAura} data-active={visible || undefined} aria-hidden="true"><div className={styles.ring} />{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ "--particle": i } as CSSProperties} />)}</div>
        <button type="button" className={`${styles.arrow} ${styles.previous}`} disabled={index === 0} aria-label="Carte précédente" onClick={() => go(-1)}><ArrowLeft /></button>
        <div className={styles.cardStack} key={index}>
          {index < total - 1 && <><div className={styles.stackBack} aria-hidden="true" /><div className={styles.stackBack} aria-hidden="true" /></>}
          <button type="button" className={styles.cardButton} data-card-revealed={visible} aria-label={visible ? `${current.name}, ${rarityLabels[current.rarity]}` : `Révéler la carte ${index + 1}`}
            onPointerDown={event => { if (!event.isPrimary) return; swiped.current = false; gesture.current = { x: event.clientX, y: event.clientY, id: event.pointerId }; event.currentTarget.setPointerCapture(event.pointerId); }}
            onPointerUp={endGesture} onPointerCancel={() => { gesture.current = null; }}
            onPointerMove={event => { if (event.pointerType !== "mouse" || reducedMotion()) return; const rect = event.currentTarget.getBoundingClientRect(); event.currentTarget.style.setProperty("--tilt", `${((event.clientX - rect.left) / rect.width - .5) * 12}deg`); }}
            onPointerLeave={event => event.currentTarget.style.setProperty("--tilt", "0deg")}
            onClick={event => { const suppress = swiped.current && event.detail > 0; swiped.current = false; if (!suppress) reveal(); }}>
            <div className={styles.flipper}><div className={styles.cardBack} aria-hidden="true"><Image src={BACK} alt="" fill priority sizes="(max-width: 700px) 65vw, 320px" /><span>Touche pour révéler</span></div><div className={styles.cardFront} aria-hidden={!visible}><CardFace card={current} /><div className={styles.holo} aria-hidden="true" /></div></div>
          </button>
        </div>
        <button type="button" className={`${styles.arrow} ${styles.next}`} disabled={!visible || index === total - 1} aria-label="Carte suivante" onClick={() => go(1)}><ArrowRight /></button>
      </div>
      <footer className={styles.controls}>
        <div className={styles.verdict} aria-live="polite" aria-atomic="true"><span className={styles.eyebrow}>Carte {index + 1} / {total}</span><h2>{visible ? current.isBonus ? "Carte bonus !" : `${rarityLabels[current.rarity]}${["epic", "legendary"].includes(current.rarity) ? " !" : "."}` : "Qui se cache ici ?"}</h2><p>{visible ? current.name : "Touche la carte ou balaie pour la retourner."}</p></div>
        <nav className={styles.cardTrack} aria-label="Cartes du booster">{result.cards.map((card, i) => <button key={`${card.id}-${i}`} type="button" disabled={i > revealed.length} aria-current={i === index ? "step" : undefined} aria-label={`Carte ${i + 1}${revealed.includes(i) ? ", révélée" : ""}`} onClick={() => setIndex(i)} data-known={revealed.includes(i) || undefined}>{revealed.includes(i) ? "✦" : i + 1}</button>)}</nav>
        <div className={styles.actions}><button type="button" className={styles.primary} onClick={() => !visible ? reveal() : allRevealed ? setPhase("recap") : setIndex(index + 1)}>{!visible ? "Révéler la carte" : allRevealed ? "Voir mon butin" : "Carte suivante"}<ArrowRight aria-hidden="true" /></button>{!allRevealed && <button type="button" className={styles.secondary} onClick={recap}>Tout révéler</button>}</div>
      </footer>
    </>}

    {phase === "recap" && result && <div className={styles.recap}>
      <header><span className={styles.eyebrow}>Booster ouvert</span><h2>Ton butin.</h2><p>{newCards} nouvelle{newCards > 1 ? "s" : ""} · {duplicates} doublon{duplicates > 1 ? "s" : ""}</p></header>
      <div className={styles.loot}>{result.cards.map((card, i) => <button key={`${card.id}-${i}`} type="button" style={{ "--rarity": COLORS[card.rarity], "--order": i } as CSSProperties} onClick={() => { setIndex(i); setPhase("cards"); }} aria-label={`Revoir ${card.name}`}><CardFace card={card} /></button>)}</div>
      {result.bonusPrize && <p className={styles.bonus}><Sparkles aria-hidden="true" /> Bonus gagné : {result.bonusPrize.title}</p>}
      <p className={styles.collectionProgress}>Collection : {result.inventory.uniqueOwned}/{result.inventory.totalCards} cartes</p>
      {onContinue && <button type="button" className={styles.primary} onClick={() => onContinue(result)}>Ranger dans mon album <ArrowRight aria-hidden="true" /></button>}
      {demo && <button type="button" className={styles.secondary} onClick={() => { setPhase("idle"); setResult(null); setIndex(0); setRevealed([]); setAttempt(value => value + 1); }}>Rejouer la démo</button>}
    </div>}
  </div>;
}
