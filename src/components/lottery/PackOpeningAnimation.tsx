"use client";

import Image from "next/image";
import { gsap } from "gsap";
import { ArrowLeft, ArrowRight, Crown, Diamond, MoveHorizontal, Sparkles, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { isRenderableImageSource } from "@/lib/image-source";
import { hasModernBuddieArtwork } from "@/lib/buddie-artwork";
import { rarityLabels } from "@/lib/lottery-card-ui";
import { useBoosterSound } from "@/hooks/useBoosterSound";
import type { LotteryCardRarity, ScratchResult } from "@/types/lottery";
import { PackSwipeCut } from "./PackSwipeCut";
import { BuddieCard } from "./BuddieCard";
import styles from "./PackOpening.module.css";

type Phase = "idle" | "opening" | "cards" | "recap" | "error";
type Motion = "ready" | "revealing" | "revealed" | "exiting";
type Card = ScratchResult["cards"][number];
const BACK = "/app/lottery/tcg-card-back-sylvain-v2.webp";
const REACTIONS: Record<LotteryCardRarity, { color: string; anticipation: number; settle: number; particles: number; caption: string }> = {
  common: { color: "#bbdfca", anticipation: .1, settle: .46, particles: 0, caption: "La collection s’agrandit" },
  silver: { color: "#c4e8ff", anticipation: .18, settle: .6, particles: 8, caption: "Un éclat d’argent" },
  gold: { color: "#ffdb79", anticipation: .28, settle: .78, particles: 16, caption: "Une pépite dans ton pack" },
  epic: { color: "#d6acff", anticipation: .42, settle: 1, particles: 22, caption: "Une découverte épique" },
  legendary: { color: "#ffce79", anticipation: .58, settle: 1.35, particles: 28, caption: "Un moment de légende" },
};
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isBuddieCard = (card: Card) => !card.isBonus && hasModernBuddieArtwork(card.code);
const pullStatus = (card: Card) => card.ownedCount > 1 ? `Doublon ×${card.ownedCount}` : "Nouvelle carte";

function CardFace({ card, eager = false }: { card: Card; eager?: boolean }) {
  if (isBuddieCard(card)) return <BuddieCard code={card.code} name={card.name} rarity={card.rarity} cardNumber={card.cardNumber} imageUrl={card.imageUrl} priority={eager} sizes="(max-width: 700px) 65vw, 320px" />;
  return <div className={styles.cardFace}>
    <div className={styles.cardArt}>{isRenderableImageSource(card.imageUrl)
      ? <Image src={card.imageUrl} alt="" fill loading={eager ? "eager" : "lazy"} sizes="(max-width: 700px) 65vw, 320px" className={styles.art} />
      : <Sparkles aria-hidden="true" />}</div>
    <div className={styles.cardCaption}><span>{card.isBonus ? "Bonus" : rarityLabels[card.rarity]} · #{card.cardNumber}</span><strong>{card.name}</strong><small>{card.isBonus ? "Bon à choisir" : pullStatus(card)}</small></div>
  </div>;
}

function RevealEffects({ rarity }: { rarity: LotteryCardRarity }) {
  const reaction = REACTIONS[rarity];
  return <div className={styles.revealFx} data-tier={rarity} aria-hidden="true">
    <div className={styles.bloom} /><div className={styles.shockwave} /><div className={styles.shockwaveSecond} />
    <div className={styles.rays} /><div className={styles.orbit} /><div className={styles.orbitSecond} />
    <div className={styles.constellation} />
    {Array.from({ length: reaction.particles }, (_, i) => {
      const angle = (i * 137.508) * Math.PI / 180;
      const distance = 100 + (i % 5) * 25;
      return <i key={i} className={styles.particle} style={{ "--dx": `${Math.cos(angle) * distance}px`, "--dy": `${Math.sin(angle) * distance}px`, "--delay": `${(i % 4) * 35}ms`, "--spin": `${i * 37}deg` } as CSSProperties} />;
    })}
  </div>;
}

/** One persistent stage and one owned timeline keep the pack-to-card handoff continuous. */
export function PackOpeningAnimation({ packNumber, onOpen, onContinue, disabled = false, demo = false, compact = false }: {
  packNumber: string; onOpen: () => Promise<ScratchResult>; onContinue?: (result: ScratchResult) => void;
  disabled?: boolean; demo?: boolean; compact?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const mounted = useRef(true), openingBusy = useRef(false), motionBusy = useRef(false), animationDone = useRef(false);
  const resultRef = useRef<ScratchResult | null>(null);
  const known = useRef(new Set<number>());
  const request = useRef(0);
  const gesture = useRef<{ x: number; y: number; id: number } | null>(null);
  const swiped = useRef(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [motion, setMotion] = useState<Motion>("ready");
  const [result, setResult] = useState<ScratchResult | null>(null);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const [effect, setEffect] = useState<{ index: number; rarity: LotteryCardRarity } | null>(null);
  const { enabled: soundEnabled, toggle: toggleSound, playOpening, playReveal, playAdvance } = useBoosterSound();
  const select = useCallback((selector: string) => root.current?.querySelector<HTMLElement>(selector) ?? null, []);
  const animate = useCallback(() => {
    timeline.current?.kill();
    const next = gsap.timeline({ defaults: { ease: "power3.out" } });
    timeline.current = next;
    return next;
  }, []);

  useEffect(() => {
    mounted.current = true;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finish = () => { if (media.matches) timeline.current?.progress(1); };
    media.addEventListener("change", finish);
    return () => { mounted.current = false; timeline.current?.kill(); media.removeEventListener("change", finish); };
  }, []);

  const finishOpening = useCallback(() => {
    if (!mounted.current || !animationDone.current || !resultRef.current) return;
    openingBusy.current = false;
    motionBusy.current = false;
    setWaiting(false); setPhase("cards"); setMotion("ready");
  }, []);

  const beginOpening = async () => {
    if (openingBusy.current || disabled || !["idle", "error"].includes(phase)) return;
    openingBusy.current = true;
    animationDone.current = false;
    const run = ++request.current;
    resultRef.current = null;
    known.current.clear();
    setRevealed([]); setIndex(0); setError(""); setResult(null); setEffect(null); setWaiting(false); setPhase("opening");
    const rig = select("[data-pack-rig]"), deck = select("[data-card-rig]"), top = select("[data-foil-top]"), body = select("[data-foil-body]");
    const light = select("[data-opening-light]");
    playOpening();
    const done = () => { animationDone.current = true; if (!resultRef.current) setWaiting(true); finishOpening(); };
    if (reducedMotion()) {
      gsap.set(rig, { autoAlpha: 0 }); gsap.set(deck, { autoAlpha: 1, x: 0, y: 0, scale: 1, rotation: 0 });
      done();
    } else {
      const tl = animate();
      tl.set(deck, { autoAlpha: 1, scale: .78, y: 36, rotation: -4 })
        .to(rig, { scale: 1.035, rotation: -2, y: -5, duration: .24 }, 0)
        .to(top, { xPercent: 74, yPercent: -27, rotation: 21, duration: .64, ease: "power2.inOut" }, .18)
        .to(top, { opacity: 0, duration: .3 }, .52)
        .fromTo(light, { opacity: 0, scale: .65 }, { opacity: .65, scale: 1.12, duration: .55 }, .25)
        .to(body, { yPercent: 80, rotation: 12, opacity: 0, duration: .85, ease: "power2.in" }, .47)
        .to(deck, { y: -27, scale: .95, rotation: 2, duration: .72, ease: "power2.inOut" }, .45)
        .to(deck, { y: 0, scale: 1, rotation: 0, duration: .55 }, 1.04)
        .to(light, { opacity: 0, scale: 1.5, duration: .65 }, .9)
        .set(rig, { autoAlpha: 0 }, 1.33)
        .call(done, [], 1.6);
    }
    try {
      const next = await onOpen();
      if (!mounted.current || request.current !== run) return;
      if (!next.cards?.length) throw new Error("Les cartes ne sont pas encore disponibles. Réessaie ce même booster.");
      resultRef.current = next; setResult(next); finishOpening();
    } catch (cause) {
      if (!mounted.current || request.current !== run) return;
      timeline.current?.kill();
      openingBusy.current = false; motionBusy.current = false;
      gsap.set([rig, top, body], { clearProps: "all" });
      gsap.set(deck, { autoAlpha: 0 }); gsap.set(light, { opacity: 0 });
      setWaiting(false); setPhase("error"); setAttempt(value => value + 1);
      setError(cause instanceof Error ? cause.message : "Impossible d’ouvrir ce booster. Réessaie.");
    }
  };

  const current = result?.cards[index];
  const visible = revealed.includes(index);
  const total = result?.cards.length ?? 0;
  const allRevealed = total > 0 && revealed.length === total;
  const rarity = visible && current ? current.rarity : "common";
  const locked = motion === "revealing" || motion === "exiting";

  const reveal = useCallback(() => {
    const card = resultRef.current?.cards[index];
    if (phase !== "cards" || !card || known.current.has(index) || motionBusy.current) return;
    motionBusy.current = true; setMotion("revealing");
    const rig = select("[data-card-rig]"), flip = select("[data-flipper]");
    const impact = () => {
      if (!mounted.current) return;
      known.current.add(index); setRevealed([...known.current]);
      setEffect({ index, rarity: card.rarity }); playReveal(card.rarity);
    };
    const settled = () => { motionBusy.current = false; if (mounted.current) setMotion("revealed"); };
    if (reducedMotion()) {
      gsap.set(flip, { rotationY: -180 }); impact(); settled(); return;
    }
    const reaction = REACTIONS[card.rarity];
    const hit = reaction.anticipation + .27;
    const tl = animate();
    tl.to(rig, { y: 7, scale: .96, duration: reaction.anticipation, ease: "power2.inOut" }, 0)
      .to(flip, { rotationY: -90, duration: .27, ease: "power2.in" }, reaction.anticipation)
      .call(impact, [], hit)
      .to(flip, { rotationY: -180, duration: .48, ease: "power3.out" }, hit)
      .to(rig, { y: -12, scale: card.rarity === "legendary" ? 1.065 : 1.025, duration: .35 }, hit)
      .to(rig, { y: 0, scale: 1, duration: reaction.settle, ease: "power2.inOut" }, hit + .25)
      .call(settled);
  }, [animate, index, phase, playReveal, select]);

  const goTo = useCallback((next: number) => {
    if (phase !== "cards" || motionBusy.current || next === index || next < 0 || next >= total || next > known.current.size) return;
    motionBusy.current = true; setMotion("exiting"); setEffect(null); playAdvance();
    const rig = select("[data-card-rig]"), flip = select("[data-flipper]");
    const direction = next > index ? -1 : 1;
    const swap = () => {
      setIndex(next);
      gsap.set(flip, { rotationY: known.current.has(next) ? -180 : 0 });
      const button = select("[data-card-revealed]");
      button?.style.setProperty("--tilt-x", "0deg"); button?.style.setProperty("--tilt-y", "0deg");
    };
    const settled = () => { motionBusy.current = false; if (mounted.current) setMotion(known.current.has(next) ? "revealed" : "ready"); };
    if (reducedMotion()) { swap(); settled(); return; }
    const tl = animate();
    tl.to(rig, { xPercent: direction * 82, y: -18, rotation: direction * 13, scale: .9, autoAlpha: 0, duration: .28, ease: "power2.in" })
      .call(swap)
      .set(rig, { xPercent: direction * -10, y: 18, rotation: direction * -3, scale: .94 })
      .to(rig, { xPercent: 0, y: 0, rotation: 0, scale: 1, autoAlpha: 1, duration: .46 })
      .call(settled);
  }, [animate, index, phase, playAdvance, select, total]);

  const skipOpening = () => {
    if (phase !== "opening") return;
    timeline.current?.progress(1);
    animationDone.current = true; finishOpening();
  };
  const recap = useCallback(() => {
    if (!resultRef.current || motionBusy.current) return;
    timeline.current?.kill(); setEffect(null);
    known.current = new Set(resultRef.current.cards.map((_, i) => i));
    setRevealed([...known.current]); setPhase("recap");
  }, []);
  const review = (next: number) => {
    setIndex(next); setEffect(null); setPhase("cards"); setMotion("revealed"); motionBusy.current = false;
    gsap.set(select("[data-flipper]"), { rotationY: -180 });
    gsap.set(select("[data-card-rig]"), { autoAlpha: 1, x: 0, xPercent: 0, y: 0, rotation: 0, scale: 1 });
  };
  const endGesture = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = gesture.current; gesture.current = null;
    if (!drag || drag.id !== event.pointerId || motionBusy.current) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.3) { swiped.current = true; if (!visible) reveal(); else goTo(index + (dx < 0 ? 1 : -1)); }
  };
  useEffect(() => {
    if (!demo || phase !== "cards" || locked) return;
    const timer = setTimeout(() => { if (!visible) reveal(); else if (index < total - 1) goTo(index + 1); else recap(); }, visible ? 1150 : 750);
    return () => clearTimeout(timer);
  }, [demo, phase, locked, visible, index, total, reveal, goTo, recap]);

  const newCards = result?.cards.filter(card => !card.isBonus && card.ownedCount <= 1).length ?? 0;
  const duplicates = result?.cards.filter(card => !card.isBonus && card.ownedCount > 1).length ?? 0;
  const idle = phase === "idle" || phase === "error";

  return <div ref={root} className={styles.experience} data-pack-phase={phase} data-card-motion={motion} data-rarity={rarity} data-revealed={visible || undefined} data-compact={compact || undefined} style={{ "--rarity": REACTIONS[rarity].color } as CSSProperties}>
    <div className={styles.scenery} aria-hidden="true"><div className={styles.spotlight} /><div className={styles.ambientRing} /><div className={styles.floor} /><div className={styles.dust} /></div>
    <header className={styles.header}><div><span>Kanab Quest</span><p>{packNumber}</p></div><button type="button" className={styles.sound} aria-label="Son de l’ouverture" aria-pressed={soundEnabled} onClick={toggleSound}>{soundEnabled ? <Volume2 /> : <VolumeX />}<span>Son {soundEnabled ? "ON" : "OFF"}</span></button></header>

    <div className={styles.stage} hidden={phase === "recap"}>
      <div className={styles.stageEyebrow} aria-hidden="true">{phase === "cards" ? `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")} · LA DÉCOUVERTE CONTINUE` : "UN PACK. DE NOUVELLES HISTOIRES."}</div>
      <div className={styles.openingLight} data-opening-light aria-hidden="true" />
      {effect && <RevealEffects key={effect.index} rarity={effect.rarity} />}
      <div className={styles.cardRig} data-card-rig>
        <div className={styles.stackBack} data-last={index >= total - 1 || undefined} aria-hidden="true" />
        <div className={styles.stackBack} data-last={index >= total - 1 || undefined} aria-hidden="true" />
        <button type="button" className={styles.cardButton} data-card-revealed={visible} disabled={phase !== "cards" || locked} tabIndex={phase === "cards" ? 0 : -1} aria-hidden={phase !== "cards"} aria-label={visible && current ? `${current.name}, ${rarityLabels[current.rarity]}` : `Révéler la carte ${index + 1}`}
          onPointerDown={event => { if (!event.isPrimary || motionBusy.current) return; swiped.current = false; gesture.current = { x: event.clientX, y: event.clientY, id: event.pointerId }; event.currentTarget.setPointerCapture(event.pointerId); }}
          onPointerUp={endGesture} onPointerCancel={() => { gesture.current = null; }}
          onPointerMove={event => { if (event.pointerType !== "mouse" || reducedMotion() || motionBusy.current || gesture.current) return; const rect = event.currentTarget.getBoundingClientRect(); event.currentTarget.style.setProperty("--tilt-y", `${((event.clientX - rect.left) / rect.width - .5) * 9}deg`); event.currentTarget.style.setProperty("--tilt-x", `${-((event.clientY - rect.top) / rect.height - .5) * 7}deg`); }}
          onPointerLeave={event => { event.currentTarget.style.setProperty("--tilt-x", "0deg"); event.currentTarget.style.setProperty("--tilt-y", "0deg"); }}
          onClick={event => { const suppress = swiped.current && event.detail > 0; swiped.current = false; if (!suppress) { if (!visible) reveal(); else if (index < total - 1) goTo(index + 1); } }}>
          <div className={styles.flipper} data-flipper>
            <div className={styles.cardBack} aria-hidden="true"><Image src={BACK} alt="" fill loading="eager" sizes="(max-width: 700px) 65vw, 320px" /></div>
            <div className={styles.cardFront} data-buddie={current && isBuddieCard(current) || undefined} aria-hidden={!visible}>{current && <CardFace card={current} eager />}<div key={effect?.index ?? "none"} className={styles.holo} data-active={Boolean(effect) || undefined} aria-hidden="true" /></div>
          </div>
        </button>
      </div>
      <div className={styles.packRig} data-pack-rig aria-hidden={!idle}>
        <div className={styles.packFloat}><PackSwipeCut key={attempt} disabled={disabled || !idle} splitting={phase === "opening"} onThresholdReached={() => void beginOpening()} /></div>
      </div>
      {phase === "cards" && <>
        <button type="button" className={`${styles.arrow} ${styles.previous}`} disabled={index === 0 || locked} aria-label="Carte précédente" onClick={() => goTo(index - 1)}><ArrowLeft /></button>
        <button type="button" className={`${styles.arrow} ${styles.next}`} disabled={!visible || index === total - 1 || locked} aria-label="Carte suivante" onClick={() => goTo(index + 1)}><ArrowRight /></button>
      </>}
      <div className={styles.stageHint} aria-hidden="true">{idle ? <><MoveHorizontal size={18} /> Glisse sur la fermeture</> : phase === "opening" ? <><span className={styles.loadingDot} />{waiting ? "Tes cartes arrivent…" : "Laisse la magie opérer"}</> : !visible ? "Touche la carte pour la découvrir" : motion === "revealed" && index < total - 1 ? "Glisse pour la carte suivante" : ""}</div>
    </div>

    <footer className={styles.controls} hidden={phase === "recap"}>
      <div className={styles.verdict} aria-live="polite" aria-atomic="true">
        <span className={styles.eyebrow}>{phase === "cards" ? visible && current ? REACTIONS[current.rarity].caption : `Carte ${index + 1} sur ${total}` : phase === "opening" ? "Le pack s’ouvre" : "À toi de jouer"}</span>
        <h2>{phase === "cards" ? visible && current ? <>{current.rarity === "legendary" ? <Crown /> : current.rarity === "silver" ? <Diamond /> : current.rarity !== "common" ? <Sparkles /> : null}{current.isBonus ? "Carte bonus !" : rarityLabels[current.rarity]}</> : "À toi de révéler." : phase === "opening" ? "Place aux surprises." : "Ouvre l’aventure."}</h2>
        <p>{phase === "cards" ? visible && current ? <>{current.name}<span className={styles.pullStatus}>{current.isBonus ? "Bonus" : pullStatus(current)}</span></> : "La prochaine carte t’attend." : phase === "opening" ? waiting ? "On attend tes cartes…" : "Chaque carte a son moment." : "Fais glisser ton doigt ou ouvre le pack."}</p>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {phase === "cards" && <nav className={styles.cardTrack} aria-label="Cartes du booster">{result?.cards.map((card, i) => <button key={`${card.id}-${i}`} type="button" disabled={locked || i > revealed.length} aria-current={i === index ? "step" : undefined} aria-label={`Carte ${i + 1}${revealed.includes(i) ? ", révélée" : ""}`} onClick={() => goTo(i)} data-known={revealed.includes(i) || undefined} style={revealed.includes(i) ? { "--dot": REACTIONS[card.rarity].color } as CSSProperties : undefined}><span /></button>)}</nav>}
      <div className={styles.actions}>
        {idle && <button className={styles.primary} type="button" disabled={disabled} onClick={() => void beginOpening()}>{phase === "error" ? "Réessayer" : "Ouvrir le pack"}<ArrowRight aria-hidden="true" /></button>}
        {phase === "opening" && <button className={styles.secondary} type="button" onClick={skipOpening}>Passer l’animation <ArrowRight size={16} /></button>}
        {phase === "cards" && <><button className={styles.primary} type="button" disabled={locked} onClick={() => !visible ? reveal() : allRevealed ? recap() : goTo(index + 1)}>{!visible ? "Révéler la carte" : allRevealed ? "Voir mon butin" : "Carte suivante"}<ArrowRight aria-hidden="true" /></button>{!allRevealed && <button className={styles.secondary} type="button" disabled={locked} onClick={recap}>Tout révéler</button>}</>}
      </div>
    </footer>

    {phase === "recap" && result && <div className={styles.recap}>
      <header><span className={styles.eyebrow}>La découverte est à toi</span><h2>Ton butin.</h2><p>{newCards} nouvelle{newCards > 1 ? "s" : ""} · {duplicates} doublon{duplicates > 1 ? "s" : ""}</p></header>
      <div className={styles.loot}>{result.cards.map((card, i) => <button key={`${card.id}-${i}`} type="button" data-buddie={isBuddieCard(card) || undefined} style={{ "--rarity": REACTIONS[card.rarity].color, "--order": i } as CSSProperties} onClick={() => review(i)} aria-label={`Revoir ${card.name}${isBuddieCard(card) ? `, ${pullStatus(card)}` : ""}`}><CardFace card={card} /><span className={styles.lootStatus}>{card.isBonus ? "Bonus" : pullStatus(card)}</span></button>)}</div>
      {result.bonusPrize && <p className={styles.bonus}><Sparkles aria-hidden="true" /> Bonus gagné : {result.bonusPrize.title}</p>}
      <p className={styles.collectionProgress}>Collection : {result.inventory.uniqueOwned}/{result.inventory.totalCards} cartes</p>
      {onContinue && <button type="button" className={styles.primary} onClick={() => onContinue(result)}>Ranger dans mon album <ArrowRight aria-hidden="true" /></button>}
      {demo && <button type="button" className={styles.secondary} onClick={() => { timeline.current?.kill(); resultRef.current = null; known.current.clear(); setPhase("idle"); setMotion("ready"); setResult(null); setIndex(0); setRevealed([]); setEffect(null); setAttempt(value => value + 1); gsap.set(select("[data-pack-rig]"), { clearProps: "all" }); gsap.set(select("[data-card-rig]"), { clearProps: "all" }); gsap.set(select("[data-flipper]"), { rotationY: 0 }); }}>Rejouer la démo</button>}
    </div>}
    {result?.cards[index + 1] && <div className={styles.preload} aria-hidden="true"><CardFace card={result.cards[index + 1]} eager /></div>}
  </div>;
}
