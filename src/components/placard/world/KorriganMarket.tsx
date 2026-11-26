"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, ChevronDown, CircleHelp, Moon, PackageOpen, Sparkles, Sun } from "lucide-react";
import { AppDialog, useDialogNavigation } from "@/components/ui/AppDialog";
import { useCart } from "@/context/CartContext";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { createClientRequestKey } from "@/lib/client-request-key";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { KORRIGAN_MIN_VALUE_CENTS, KORRIGAN_ODDS, type KorriganDraw, type KorriganKind, type KorriganReaction, type KorriganState } from "@/lib/kanab-quest-korrigan";
import { useKqTutorialApi } from "../KqTutorialApiContext";
import styles from "./KorriganMarket.module.css";

const endpoint = "/api/arena/placard/korrigans";
const updateEvent = "kq:korrigan-updated";
const spinDuration = 1_150;
const outcomes = {
  loss: "Aucun gain",
  x5: "Mise ×5",
  x10: "Mise ×10",
  x50: "Mise ×50",
  epic: "Carte Buddie épique",
  botte: "Pack Botte du Chanvrier",
  buddie: "Pack Buddies",
} satisfies Record<KorriganKind, string>;
const rewardDestination = {
  loss: null, x5: "Caisse", x10: "Caisse", x50: "Caisse",
  epic: "Album Buddies", botte: "Maison des cartes · Botte du Chanvrier", buddie: "Maison des cartes · Buddies",
} satisfies Record<KorriganKind, string | null>;
const odds = Object.keys(outcomes) as KorriganKind[];
const gramsLabel = (grams: number) => `${grams.toLocaleString("fr-FR")} g`;
const timeLabel = (date: string) => new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris",
}).format(new Date(date));
const oddsLabel = (points: number) => (points / 10_000).toLocaleString("fr-FR", { style: "percent", maximumFractionDigits: 2 });

type Selection = { lotId: string; grams: number };
type Quote = Selection & { valueCents: number; eligible: boolean };
type SavedOffer = Selection & { requestId: string; expectedValueCents: number };
type DrawRequest = { sessionId: string; draw: number };
type Operation = { type: "read" }
  | { type: "quote"; selection: Selection }
  | { type: "offer"; offer: SavedOffer }
  | { type: "draw"; draw: DrawRequest; recoverAward?: boolean };
type Symbol = KorriganKind | "leaf";

function getSavedOffer(key: string | null): SavedOffer | null {
  if (!key || typeof window === "undefined") return null;
  try {
    const offer = JSON.parse(sessionStorage.getItem(key) ?? "null") as Partial<SavedOffer> | null;
    if (offer && typeof offer.requestId === "string" && typeof offer.lotId === "string"
      && Number.isSafeInteger(offer.grams) && Number.isSafeInteger(offer.expectedValueCents)) return offer as SavedOffer;
  } catch { /* Keep recovery available in memory when storage is disabled. */ }
  return null;
}

function reactionFor(kind: KorriganKind): KorriganReaction {
  if (kind === "loss") return "loss";
  return kind === "x50" || kind === "epic" ? "rare" : "reward";
}

function drawLabel(draw: KorriganDraw) {
  if (draw.moneyCents > 0) return formatKqCash(draw.moneyCents);
  return draw.itemLabel ?? outcomes[draw.kind];
}

const greetings = {
  welcome: [
    "Psst ! Fais-nous une offrande de fleurs sèches et je te laisse tirer trois fois le levier.",
    "Même si ma carte épique tombe ? Bon… marché conclu !",
  ],
  resume: ["Ah, te revoilà ! J’ai gardé ta place au levier.", "Et moi, j’ai gardé le compte de tes tirages !"],
  register: ["Attends un brin, j’ai ton offrande dans mon registre.", "Tourne la page, qu’on voie où on en était !"],
  resting: ["On a remisé le levier pour cette fois.", "Ton bilan, lui, est toujours là. Tu veux le revoir ?"],
} as const;

function KorriganLine({ bonnet, children, reaction }: { bonnet: "rouge" | "bleu"; children: string; reaction?: KorriganKind }) {
  return <p className={styles.speech} data-korrigan-speech={bonnet} data-korrigan-reaction={reaction}>
    <strong>Bonnet {bonnet}</strong>{" — "}{children}
  </p>;
}

function drawRemark(kind: KorriganKind) {
  if (kind === "loss") return "Rien dans le tiroir, cette fois. Même pas un bouton de mon gilet !";
  if (kind === "epic") return "Ma fameuse carte ! Marché conclu, elle est à toi.";
  if (kind === "botte" || kind === "buddie") return "Un paquet tout ficelé ! À toi de découvrir ce qu’il y a dedans.";
  return "Tu entends les pièces qui tintent ? C’est pour ta bourse !";
}

function ReelSymbol({ symbol }: { symbol: Symbol }) {
  if (symbol === "loss") return <Moon strokeWidth={2.6} />;
  return <><span className={styles.printedSymbol}>{symbol === "epic" && <Sparkles strokeWidth={2.6} />}</span>
    {symbol.startsWith("x") && <b>{symbol.replace("x", "×")}</b>}</>;
}

const reelSequence: Symbol[] = ["leaf", "x5", "botte", "x10", "buddie", "epic", "x50", "loss"];

function MarketMachine({ result, spinning, hasSession, completed, drawAction, waiting, onPull, onSkip }: {
  result?: KorriganDraw; spinning: boolean; hasSession: boolean; completed: number;
  drawAction?: string; waiting: boolean; onPull: () => void; onSkip: () => void;
}) {
  const resultKind = result?.kind;
  const symbols: Symbol[] = resultKind === "loss" ? ["leaf", "loss", "leaf"]
    : resultKind ? [resultKind, resultKind, resultKind] : ["leaf", "botte", "x5"];

  return <div className={styles.machineStation}>
    <div className={styles.machine} data-korrigan-machine data-spinning={spinning || undefined} data-settling={spinning && resultKind ? true : undefined} data-result={spinning ? undefined : resultKind}>
      <div className={styles.cabinet} aria-hidden="true">
        <div className={styles.reels}>
          {symbols.map((symbol, index) => <div className={styles.reel} data-reel={index + 1} key={index}>
            <span className={styles.face} data-symbol={symbol}><ReelSymbol symbol={symbol} /></span>
            {spinning && <div className={styles.shutter}><div className={styles.reelMotion}>
              {Array.from({ length: reelSequence.length + 1 }, (_, offset) => {
                const rolling = reelSequence[(index + offset) % reelSequence.length];
                return <span data-symbol={rolling} key={offset}><ReelSymbol symbol={rolling} /></span>;
              })}
            </div></div>}
          </div>)}
        </div>
        <span className={styles.lamps}>{[1, 2, 3].map(index => <i key={index} data-lit={index <= completed || undefined} />)}</span>
        <span className={styles.lever}><i /></span>
      </div>
      {drawAction && !spinning && <button type="button" className={`${styles.control} ${styles.primary} ${styles.drawAction}`}
        data-korrigan-next disabled={waiting} onClick={onPull}>{drawAction}</button>}
      {spinning && <button type="button" className={styles.control} data-korrigan-next onClick={onSkip}>Passer l’animation</button>}
    </div>
    {hasSession && <div className={styles.machineReadout}>{completed} / 3 tirages</div>}
    <div className={styles.result} role="status" aria-live="polite" aria-atomic="true">
      {spinning ? <span>Les rouleaux tournent…</span> : result ? <><strong>{outcomes[result.kind]}</strong>
        {result.pending ? <span>Remise en attente</span> : <>
          {drawLabel(result) !== outcomes[result.kind] && <span>{drawLabel(result)}</span>}
          <KorriganLine bonnet="bleu" reaction={result.kind}>{drawRemark(result.kind)}</KorriganLine>
        </>}</>
        : null}
    </div>
  </div>;
}

function EmptyStock({ onOpenStock }: { onOpenStock: () => void }) {
  const navigate = useDialogNavigation();
  return <div className={styles.emptyStock}>
    <PackageOpen size={26} aria-hidden="true" />
    <div><strong>Aucun lot de fleurs sèches disponible.</strong>
      <KorriganLine bonnet="rouge">Fouille dans tes récoltes ! Rapporte-nous des fleurs sèches en vrac, prêtes à la reprise.</KorriganLine></div>
    <button type="button" className={styles.control} onClick={() => navigate(onOpenStock)}>Voir mes récoltes <ArrowRight size={16} aria-hidden="true" /></button>
  </div>;
}

type MarketProps = { isNight: boolean; onClose: () => void; onOpenStock: () => void; onReaction: (reaction: KorriganReaction) => void };

export function KorriganMarket(props: MarketProps) {
  const api = useKqTutorialApi();
  const { user } = useCart();
  return <MarketVisit key={api.isTutorial ? "tutorial" : user?.id ?? "guest"} {...props} playerId={api.isTutorial ? null : user?.id ?? null} />;
}

function MarketVisit({ isNight, onClose, onOpenStock, onReaction, playerId }: MarketProps & { playerId: string | null }) {
  const api = useKqTutorialApi();
  const [open, setOpen] = useState(false);
  const active = open || isNight;
  const [state, setState] = useState<KorriganState | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [confirmation, setConfirmation] = useState<Quote | null>(null);
  const [choice, setChoice] = useState({ lotId: "", grams: "" });
  const recoveryKey = playerId ? `${updateEvent}:${playerId}:offer` : null;
  const signalKey = playerId ? `${updateEvent}:${playerId}` : updateEvent;
  const [savedOffer, setSavedOffer] = useState(() => getSavedOffer(recoveryKey));
  const recoveryOffer = useRef(savedOffer);
  const [drawRecovery, setDrawRecovery] = useState<DrawRequest | null>(null);
  const [pending, setPending] = useState<Operation["type"] | null>(null);
  const [error, setError] = useState("");
  const [spinningDraw, setSpinningDraw] = useState<number | null>(null);
  const spin = useRef<{ startedAt: number; timer?: number; result?: KorriganDraw } | null>(null);
  const latestDrawRequest = useRef<DrawRequest | null>(null);
  const mounted = useRef(false);
  const lock = useRef(false);
  const reread = useRef(false);
  const publishing = useRef(false);
  const snapshot = useRef<KorriganState | null>(null);
  const callbacks = useRef({ onClose, onReaction });
  const invitation = useRef<HTMLDialogElement>(null);
  const inviteButton = useRef<HTMLButtonElement>(null);
  const declineButton = useRef<HTMLButtonElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useBodyScrollLock(!open && isNight);
  useLayoutEffect(() => { callbacks.current = { onClose, onReaction }; }, [onClose, onReaction]);
  useLayoutEffect(() => {
    mounted.current = true;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    callbacks.current.onReaction("invite");
    return () => {
      mounted.current = false;
      window.clearTimeout(spin.current?.timer);
      if (opener?.isConnected) queueMicrotask(() => {
        if (!mounted.current && opener.isConnected && !opener.closest("[inert]")) opener.focus({ preventScroll: true });
      });
    };
  }, []);

  useLayoutEffect(() => {
    const dialog = invitation.current;
    if (open || !isNight || !dialog) return;
    dialog.showModal();
    inviteButton.current?.focus({ preventScroll: true });
    return () => { if (dialog.open) dialog.close(); };
  }, [isNight, open]);

  const saveOffer = useCallback((offer: SavedOffer | null) => {
    const previous = recoveryOffer.current;
    recoveryOffer.current = offer;
    if (mounted.current) setSavedOffer(offer);
    if (!recoveryKey) return;
    try {
      if (offer) sessionStorage.setItem(recoveryKey, JSON.stringify(offer));
      else if (previous && getSavedOffer(recoveryKey)?.requestId === previous.requestId) sessionStorage.removeItem(recoveryKey);
    } catch { /* The current visit retains its request key. */ }
  }, [recoveryKey]);

  const finishSpin = useCallback(() => {
    const current = spin.current;
    spin.current = null;
    window.clearTimeout(current?.timer);
    if (!mounted.current) return;
    setSpinningDraw(null);
    if (current?.result && !current.result.pending) callbacks.current.onReaction(reactionFor(current.result.kind));
  }, []);

  const perform = useCallback(async function perform(operation: Operation) {
    if (lock.current) {
      if (operation.type === "read") reread.current = true;
      return;
    }
    lock.current = true;
    setPending(operation.type);
    if (operation.type !== "read") setError("");
    let definitive = false;
    let payload: Record<string, unknown> | undefined;
    if (operation.type === "quote") payload = { action: "quote", ...operation.selection };
    if (operation.type === "offer") {
      saveOffer(operation.offer);
      const { lotId, grams, requestId, expectedValueCents } = operation.offer;
      payload = { action: "offer", lotId, grams, requestId, expectedValueCents };
    }
    if (operation.type === "draw") {
      latestDrawRequest.current = operation.draw;
      payload = { action: "draw", ...operation.draw };
      if (!operation.recoverAward && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        spin.current = { startedAt: performance.now() };
        setSpinningDraw(operation.draw.draw);
      }
    }

    const publish = () => {
      publishing.current = true;
      try {
        api.notify(updateEvent);
        if (!api.isTutorial) {
          try { localStorage.setItem(signalKey, createClientRequestKey()); } catch { /* Refocus also refreshes the market. */ }
        }
      } finally { publishing.current = false; }
    };
    const notifyChanges = (session: KorriganState["session"], previous: KorriganState["session"]) => {
      if (!session) return;
      const sameSession = session.id === previous?.id;
      const newDraws = session.draws.filter(draw => !draw.pending && (!sameSession
        || !previous?.draws.some(prior => prior.index === draw.index && !prior.pending)));
      if (!sameSession) api.notify("kq:storage-updated");
      if (!sameSession || newDraws.some(draw => draw.moneyCents > 0)) api.notify("kq:equipment-updated");
      if (newDraws.some(draw => draw.moneyCents > 0)) api.notify("kq:treasury-updated");
      if (newDraws.some(draw => draw.kind === "botte" || draw.kind === "epic" || draw.kind === "buddie")) api.notify("kq:collection-updated");
      if (newDraws.some(draw => draw.kind === "epic" || draw.kind === "buddie")) api.notify("kq:boosters-updated");
    };

    try {
      const response = await api.request(endpoint, payload ? {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      } : { cache: "no-store" });
      definitive = response.status >= 400 && response.status < 500 && ![408, 425, 429].includes(response.status);
      const next = await response.json().catch(() => null) as (KorriganState & { error?: string }) | null;
      if (!response.ok || !next || !Array.isArray(next.lots) || typeof next.serverNow !== "string") {
        throw new Error(next?.error || "Les Korrigans ne répondent pas. Réessaie dans un instant.");
      }
      const session = next.session;
      if (operation.type === "offer" && (!session || (session.requestId && session.requestId !== operation.offer.requestId))) {
        throw new Error("L’offrande reste à vérifier dans le registre.");
      }
      const previous = snapshot.current;
      snapshot.current = next;
      const waiting = recoveryOffer.current;
      const foundOffer = waiting && session?.requestId === waiting.requestId;
      const competingOffer = waiting && session?.requestId && !foundOffer
        && (session.draws.length < 3 || session.draws.some(draw => draw.pending) || Date.parse(session.nextOfferAt) > Date.parse(next.serverNow));
      if (operation.type === "offer" || foundOffer || competingOffer) {
        saveOffer(null);
        if (mounted.current) {
          setConfirmation(null);
          setQuote(null);
          setChoice({ lotId: "", grams: "" });
          if (!competingOffer) callbacks.current.onReaction("offer");
        }
      }
      if (operation.type === "offer" || operation.type === "draw" || foundOffer || competingOffer || previous) notifyChanges(session, previous?.session ?? null);
      if (operation.type === "offer" || operation.type === "draw") publish();
      if (!mounted.current) return;
      setState(next);
      if (operation.type === "quote" && next.quote) setQuote({ ...operation.selection, ...next.quote });
      const waitingDraw = latestDrawRequest.current;
      const draw = session && session.id === waitingDraw?.sessionId
        ? session.draws.find(entry => entry.index === waitingDraw.draw) : undefined;
      if (draw && !draw.pending) {
        latestDrawRequest.current = null;
        setDrawRecovery(null);
        if (spin.current) {
          spin.current.result = draw;
          // Leave time for the three stops even when the server responds late.
          spin.current.timer = window.setTimeout(finishSpin, Math.max(680, spinDuration - (performance.now() - spin.current.startedAt)));
        } else callbacks.current.onReaction(reactionFor(draw.kind));
      } else if (operation.type === "draw") {
        setDrawRecovery(operation.draw);
        finishSpin();
      }
      if (operation.type !== "read" || !previous || foundOffer || competingOffer || draw) setError("");
    } catch (cause) {
      if (operation.type === "offer" && definitive) {
        saveOffer(null);
        if (mounted.current) {
          setConfirmation(null);
          setQuote(null);
        }
      }
      if (operation.type === "offer" || operation.type === "draw") publish();
      if (!mounted.current) return;
      if (definitive && (operation.type === "offer" || operation.type === "draw")) reread.current = true;
      if (operation.type === "draw") {
        if (definitive) latestDrawRequest.current = null;
        setDrawRecovery(definitive ? null : operation.draw);
        finishSpin();
      }
      setError(cause instanceof Error ? cause.message : "La machine est momentanément indisponible.");
    } finally {
      lock.current = false;
      if (mounted.current) {
        setPending(null);
        if (reread.current) {
          reread.current = false;
          void perform({ type: "read" });
        }
      }
    }
  }, [api, finishSpin, saveOffer, signalKey]);

  useEffect(() => {
    if (!active) {
      callbacks.current.onClose();
      return;
    }
    const refresh = () => { if (!publishing.current && !document.hidden) void perform({ type: "read" }); };
    const sync = (event: StorageEvent) => { if (event.key === signalKey) refresh(); };
    const initial = window.setTimeout(refresh, 0);
    const unsubscribe = api.subscribe([updateEvent], refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    if (!api.isTutorial) window.addEventListener("storage", sync);
    return () => {
      window.clearTimeout(initial);
      unsubscribe();
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("storage", sync);
    };
  }, [active, api, isNight, perform, signalKey]);

  const nextOfferAt = state?.nextOfferAt;
  const serverNow = state?.serverNow;
  useEffect(() => {
    if (!active || !nextOfferAt || !serverNow) return;
    const delay = Date.parse(nextOfferAt) - Date.parse(serverNow);
    if (delay <= 0) return;
    const timer = window.setTimeout(() => { void perform({ type: "read" }); }, delay + 250);
    return () => window.clearTimeout(timer);
  }, [active, nextOfferAt, perform, serverNow]);

  const session = state?.session;
  const draws = session?.draws ?? [];
  const spinning = spinningDraw !== null;
  const shownDraws = draws.filter(draw => draw.index !== spinningDraw);
  const remainingDraws = 3 - draws.length;
  const confirmedDraws = shownDraws.filter(draw => !draw.pending);
  const completeCount = confirmedDraws.length;
  const confirmedMoney = confirmedDraws.reduce((total, draw) => total + draw.moneyCents, 0);
  const confirmedItems = confirmedDraws.filter(draw => rewardDestination[draw.kind] && draw.moneyCents === 0).length;
  const pendingItems = shownDraws.length - completeCount;
  const pendingDraw = shownDraws.find(draw => draw.pending);
  const unresolvedDraw = drawRecovery?.sessionId === session?.id ? drawRecovery : null;
  const progress = Boolean(session) && completeCount < 3;
  const cooldownDate = state?.isNight ? nextOfferAt : session?.nextOfferAt;
  const coolDown = Boolean(cooldownDate && serverNow && Date.parse(cooldownDate) > Date.parse(serverNow));
  const paused = !isNight || state?.isNight === false;
  const minimumValue = state?.minimumValueCents ?? KORRIGAN_MIN_VALUE_CENTS;
  const recordedOdds = session?.odds ?? KORRIGAN_ODDS;
  const inviteOdds = progress ? recordedOdds : KORRIGAN_ODDS;
  const busy = pending !== null;
  const chosenLot = state?.lots.find(lot => lot.id === choice.lotId) ?? (choice.lotId ? undefined : state?.lots[0]);
  const grams = Number(choice.grams);
  const selection = chosenLot && Number.isSafeInteger(grams) && grams >= 1 && grams <= chosenLot.availableGrams
    ? { lotId: chosenLot.id, grams } : null;
  const priced = selection && quote && quote.lotId === selection.lotId && quote.grams === selection.grams ? quote : null;
  const canOffer = state && !coolDown && !progress;
  const offer = savedOffer ?? (canOffer && confirmation ? { ...confirmation, expectedValueCents: confirmation.valueCents } : null);
  const offeredLot = offer && state?.lots.find(lot => lot.id === offer.lotId);
  const actionable = !paused && !busy && !spinning;
  const drawAction = progress && !offer && !pendingDraw
    ? pending === "draw" ? "Tirage en cours…" : unresolvedDraw ? "Reprendre le tirage" : `Lancer le tirage ${completeCount + 1} sur 3`
    : undefined;
  const invitationAction = savedOffer ? "Reprendre mon offrande"
    : progress ? remainingDraws === 0 ? "Reprendre la remise" : remainingDraws === 1 ? "Reprendre mon tirage" : `Reprendre mes ${remainingDraws} tirages`
      : session && coolDown ? "Voir mon bilan" : "Je veux voir la machine";
  const greeting = savedOffer || pendingDraw ? greetings.register : !state ? null
    : progress ? greetings.resume : coolDown && session ? greetings.resting : coolDown ? null : greetings.welcome;

  useLayoutEffect(() => {
    if (!open) return;
    const dialog = body.current?.closest("dialog[open]");
    const focused = document.activeElement;
    if (!dialog || (focused && focused !== dialog && dialog.contains(focused))) return;
    const target = body.current?.querySelector<HTMLElement>("[data-korrigan-next]:not(:disabled)") ?? dialog.querySelector<HTMLElement>("header button");
    target?.focus({ preventScroll: true });
  }, [open, pending, confirmation, session, spinning, savedOffer, priced]);

  function changeSelection(next: typeof choice) {
    setChoice(next);
    setQuote(null);
    setConfirmation(null);
    setError("");
  }

  function pullLever() {
    if (!session || !progress || busy || spinning || (paused && !pendingDraw)) return;
    const draw = pendingDraw ? { sessionId: session.id, draw: pendingDraw.index }
      : unresolvedDraw ?? { sessionId: session.id, draw: completeCount + 1 };
    void perform({ type: "draw", draw, recoverAward: Boolean(pendingDraw) });
  }

  function submitOffer() {
    if (!actionable || !offer) return;
    if (savedOffer) void perform({ type: "offer", offer: savedOffer });
    else void perform({ type: "offer", offer: {
      lotId: offer.lotId, grams: offer.grams, expectedValueCents: offer.expectedValueCents,
      requestId: createClientRequestKey(),
    } });
  }

  if (!open) return isNight ? <dialog ref={invitation} className={styles.invitation} data-korrigan-invitation data-app-dialog aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }}
    onKeyDown={event => {
      if (event.key === "Escape") event.stopPropagation();
      if (event.key !== "Tab") return;
      if (event.shiftKey && event.target === inviteButton.current) {
        event.preventDefault();
        declineButton.current?.focus();
      } else if (!event.shiftKey && event.target === declineButton.current) {
        event.preventDefault();
        inviteButton.current?.focus();
      }
    }}>
    <h2 id={titleId}>Les Korrigans</h2>
    {greeting ? <div className={styles.exchange}>
      <KorriganLine bonnet="rouge">{greeting[0]}</KorriganLine>
      <KorriganLine bonnet="bleu">{greeting[1]}</KorriganLine>
    </div> : <KorriganLine bonnet="rouge">Psst ! Viens donc t’asseoir avec nous sous le chêne.</KorriganLine>}
    <p className={styles.inviteTerms}>Une offrande tous les 7 jours. Par tirage, <strong>{oddsLabel(inviteOdds.loss)} sans gain</strong> et <strong>{oddsLabel(10_000 - inviteOdds.loss)} de chances</strong> de gagner des pièces, un pack ou une carte.</p>
    {coolDown && nextOfferAt ? <p className={styles.deadline}>Prochaine offrande à partir du <time dateTime={nextOfferAt}>{timeLabel(nextOfferAt)} (Paris)</time> pendant une nuit du jeu.</p> : null}
    <div className={styles.actions}>
      <button ref={inviteButton} type="button" className={`${styles.control} ${styles.primary}`} onClick={() => setOpen(true)}>{invitationAction}</button>
      <button ref={declineButton} type="button" className={styles.control} onClick={onClose}>Une autre fois</button>
    </div>
  </dialog> : null;

  return <AppDialog open onClose={onClose} closeOnBackdrop={false} closeLabel="Fermer le marché des Korrigans"
    className={styles.dialog} bodyClassName={styles.dialogBody} headerClassName={styles.dialogHeader}
    title={<h2>Le marché des Korrigans</h2>}
    dialogProps={{ "data-korrigan-dialog": true }}>
    <div className={styles.market} ref={body}>
      {paused ? <p className={styles.notice} role="status" data-korrigan-day><Sun size={20} aria-hidden="true" />
        <span>Le jour s’est levé. Les Korrigans reprendront cette nuit. {pending === "offer" || pending === "draw" ? "La demande en cours continue." : "Ton choix reste ici."}</span>
      </p> : null}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <div className={styles.columns}>
        <MarketMachine result={spinning ? draws.find(draw => draw.index === spinningDraw && !draw.pending)
          : pending === "draw" && !pendingDraw ? undefined : pendingDraw ?? shownDraws.at(-1)}
          spinning={spinning} hasSession={Boolean(session)} completed={completeCount} drawAction={drawAction}
          waiting={!actionable} onPull={pullLever} onSkip={finishSpin} />
        <div className={styles.marketControls}>
          {!state ? <div className={styles.operation}>
            <p role="status">{error ? "Le marché est momentanément indisponible." : "Les Korrigans ouvrent leur registre…"}</p>
            {error ? <button className={styles.control} type="button" disabled={busy} data-korrigan-next onClick={() => void perform({ type: "read" })}>Réessayer</button> : null}
          </div> : null}

          {offer ? <section className={styles.operation} data-korrigan-confirmation>
            <h3>{savedOffer ? "Vérifier l’offrande" : "Confirmer l’offrande"}</h3>
            <p><strong>{gramsLabel(offer.grams)}{offeredLot ? ` · ${offeredLot.label}` : ""}</strong> quittent ton stock. Valeur de reprise : <strong>{formatKqCash(offer.expectedValueCents)}</strong>.</p>
            <p>Tu obtiens 3 tirages. Prochaine offrande possible après 168 h. {oddsLabel(KORRIGAN_ODDS.loss)} de risque de ne rien gagner à chaque tirage.</p>
            <div className={styles.actions}>
              <button className={`${styles.control} ${styles.primary}`} type="button" disabled={!actionable} data-korrigan-next onClick={submitOffer}>
                {pending === "offer" ? "Confirmation…" : savedOffer ? "Reprendre l’offrande" : `Donner ${gramsLabel(offer.grams)} et jouer`}
              </button>
              {savedOffer ? <button className={styles.control} type="button" disabled={busy} onClick={() => void perform({ type: "read" })}>Actualiser le registre</button>
                : <button className={styles.control} type="button" onClick={() => { setConfirmation(null); setError(""); }}>Revenir au devis</button>}
            </div>
          </section> : null}

          {canOffer && !offer ? <form className={styles.operation} onSubmit={event => {
            event.preventDefault();
            if (actionable && selection) void perform({ type: "quote", selection });
          }}>
            <h3>Préparer une offrande</h3>
            <dl className={styles.offerTerms}>
              <div><dt>Reprise minimale</dt><dd>{formatKqCash(minimumValue)}</dd></div>
              <div><dt>Tirages par offrande</dt><dd>3</dd></div>
            </dl>
            {state.lots.length ? <>
              {!paused && <KorriganLine bonnet="rouge">Montre-moi tes fleurs. Je te dirai ce qu’elles valent avant que tu me les confies.</KorriganLine>}
              <div className={styles.fields}>
                <label>Lot de fleurs sèches
                  <select value={chosenLot?.id ?? ""} disabled={!actionable} onChange={event => changeSelection({ lotId: event.target.value, grams: choice.grams })}>
                    {!chosenLot ? <option value="" disabled>Choisir un lot</option> : null}
                    {state.lots.map(lot => <option key={lot.id} value={lot.id}>{lot.label} · {gramsLabel(lot.availableGrams)}</option>)}
                  </select>
                </label>
                <label>Quantité (g)
                  <input type="number" min={1} max={Math.floor(chosenLot?.availableGrams ?? 0)} step={1} inputMode="numeric" required value={choice.grams}
                    disabled={!actionable || !chosenLot} onChange={event => changeSelection({ lotId: chosenLot?.id ?? "", grams: event.target.value })} />
                </label>
              </div>
              {priced ? <div className={styles.quote} role="status" data-korrigan-quote>
                <span>Valeur de reprise <strong>{formatKqCash(priced.valueCents)}</strong></span>
                {!priced.eligible ? <small>Il faut atteindre {formatKqCash(minimumValue)} pour offrir ce lot.</small> : null}
              </div> : null}
              {priced?.eligible ? <button className={`${styles.control} ${styles.primary}`} type="button" disabled={!actionable} data-korrigan-next
                onClick={() => setConfirmation(priced)}>Passer à la confirmation</button>
                : <button className={`${styles.control} ${styles.primary}`} type="submit" disabled={!actionable || !selection} data-korrigan-next>
                  {pending === "quote" ? "Devis en cours…" : "Calculer la valeur"}
                </button>}
            </> : <EmptyStock onOpenStock={onOpenStock} />}
          </form> : null}

          {session && !offer ? <section className={styles.operation}>
            <h3>{shownDraws.length < 3 ? "Offrande remise" : "Bilan de l’offrande"}</h3>
            {draws.length === 0 && !spinning && !paused && !unresolvedDraw && pending !== "draw" &&
              <KorriganLine bonnet="rouge">Tope là ! Le levier est à toi.</KorriganLine>}
            <p><strong>{gramsLabel(session.grams)}</strong> offerts · <strong>{formatKqCash(session.valueCents)}</strong> de reprise.</p>
            {pendingDraw && <button type="button" className={`${styles.control} ${styles.primary}`} disabled={busy}
              data-korrigan-next onClick={pullLever}>{pending === "draw" ? "Remise en cours…" : "Récupérer le gain"}</button>}
            {shownDraws.length ? <>
              {completeCount === 3 && !confirmedMoney && !confirmedItems ? <p><strong>Aucun gain en trois tirages</strong></p> : null}
              <dl className={styles.totals}>
                <div><dt>Argent gagné</dt><dd>{formatKqCash(confirmedMoney)}</dd></div>
                <div><dt>Objets remis</dt><dd>{confirmedItems}</dd></div>
              </dl>
              {pendingItems ? <p>{pendingItems} {pendingItems > 1 ? "remises en attente" : "remise en attente"}</p> : null}
              <ol className={styles.register} aria-label="Résultats des tirages">
                {shownDraws.map(draw => <li key={draw.index}><span>Tirage {draw.index}</span>
                  <div><strong>{draw.moneyCents > 0 ? `${outcomes[draw.kind]} · ${drawLabel(draw)}` : drawLabel(draw)}</strong>
                    {draw.pending ? <small>Remise en attente</small> : rewardDestination[draw.kind] ? <small>{rewardDestination[draw.kind]}</small> : null}</div>
                </li>)}
              </ol>
            </> : null}
            {coolDown && nextOfferAt ? <p className={styles.deadline}>Prochaine offrande à partir du
              <time dateTime={nextOfferAt}>{timeLabel(nextOfferAt)} (Paris)</time> pendant une nuit du jeu.</p> : null}
            {!progress && !coolDown ? <p className={styles.deadline}>
              {paused ? "Délai écoulé · nouvelle offrande possible à la prochaine nuit." : "Délai écoulé · nouvelle offrande possible cette nuit."}
              {paused && nextOfferAt ? <time dateTime={nextOfferAt}>{timeLabel(nextOfferAt)} (Paris)</time> : null}
            </p> : null}
          </section> : null}
          {state && !session && !offer && coolDown && nextOfferAt ? <p className={styles.deadline}>
            Prochaine offrande à partir du <time dateTime={nextOfferAt}>{timeLabel(nextOfferAt)} (Paris)</time> pendant une nuit du jeu.
          </p> : null}
        </div>
      </div>
      <details className={styles.odds}>
        <summary><CircleHelp size={18} aria-hidden="true" /> {session ? "Règles et chances de l’offrande" : "Règles et chances"} <ChevronDown size={17} aria-hidden="true" /></summary>
        <p>Une offrande tous les 7 jours (168 h), pendant une nuit du jeu. Les trois tirages sont indépendants. Les multiplicateurs portent sur la valeur de reprise de l’offrande.</p>
        <table><thead><tr><th scope="col">Résultat</th><th scope="col">Par tirage</th></tr></thead>
          <tbody>{odds.map(kind => <tr key={kind}><th scope="row">{outcomes[kind]}</th><td>{oddsLabel(recordedOdds[kind])}</td></tr>)}</tbody>
        </table>
      </details>
    </div>
  </AppDialog>;
}
