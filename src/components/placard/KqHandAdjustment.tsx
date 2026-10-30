"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRightLeft, ChevronDown, RotateCcw } from "lucide-react";
import { getKqCardGuide } from "@/lib/kanab-quest-card-guide";
import { canRedrawKqHand, canSwapKqHeritageHandCard, getKqHandCodes, KQ_CARDS, type KqGameState, type KqSupportCard } from "@/lib/kanab-quest-game";
import styles from "./KqHandAdjustment.module.css";

type Props = {
  state: KqGameState;
  selectionScope: string;
  busy: boolean;
  blockedReason?: string;
  onSwap: (handIndex: number, reserveIndex: number) => Promise<boolean>;
  onRedraw: () => Promise<boolean>;
};

type Selection = { scope: string; out: number; incoming: number | null };

function focusAndReveal(target: HTMLElement | null) {
  if (!target?.isConnected) return;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "start", behavior: "instant" });
}

function CardRules({ card }: { card: KqSupportCard }) {
  const guide = getKqCardGuide(card);
  return <details className={styles.cardRules}>
    <summary>Détails de la carte<ChevronDown size={14} aria-hidden="true" /></summary>
    <div>
      <p><strong>À jouer :</strong> {guide.timing.toLocaleLowerCase("fr-FR")} · {card.xpCost} XP de culture et 1 copie brûlée.</p>
      <p><strong>Situations :</strong> {guide.scope}{guide.examples.length ? ` — ${guide.examples.join(", ")}` : ""}.</p>
      <p><strong>Limite :</strong> {guide.risk}</p>
      <p>Consulter ou échanger cette carte ne la joue pas.</p>
    </div>
  </details>;
}

export function KqHandAdjustment({ state, selectionScope, busy, blockedReason, onSwap, onRedraw }: Props) {
  const id = useId();
  const [selection, setSelection] = useState<Selection | null>(null);
  const [redrawScope, setRedrawScope] = useState<string | null>(null);
  const [observedScope, setObservedScope] = useState(selectionScope);
  const [pending, setPending] = useState<"swap" | "redraw" | null>(null);
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);
  const operation = useRef(false);
  const mounted = useRef(true);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const choicesList = useRef<HTMLDivElement>(null);
  const status = useRef<HTMLParagraphElement>(null);
  const redrawWarning = useRef<HTMLDivElement>(null);
  const redrawButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const frame = requestAnimationFrame(() => focusAndReveal(status.current));
    return () => cancelAnimationFrame(frame);
  }, [notice]);

  // Invalidate choices on every context transition, including a failed action
  // returning to its initial state. A previous choice must never reappear.
  if (observedScope !== selectionScope) {
    setObservedScope(selectionScope);
    setSelection(null);
    setRedrawScope(null);
  }

  const handCodes = getKqHandCodes(state);
  const reserveCodes = state.heritageReserveCodes ?? [];
  const redrawPermission = canRedrawKqHand(state);
  const swapPermission = canSwapKqHeritageHandCard(state);
  const activeSelection = selection?.scope === selectionScope ? selection : null;
  const outgoing = activeSelection ? KQ_CARDS.find(card => card.code === handCodes[activeSelection.out]) : undefined;
  const incomingIndex = activeSelection?.incoming;
  const incoming = incomingIndex !== null && incomingIndex !== undefined
    ? KQ_CARDS.find(card => card.code === reserveCodes[incomingIndex]) : undefined;
  const choosingIncoming = Boolean(outgoing);
  const confirmingRedraw = redrawScope === selectionScope && reserveCodes.length > 0;
  const externalBlock = blockedReason || (busy ? "Une action est en cours. Attends sa confirmation." : "");
  const swapBlock = externalBlock || (!swapPermission.allowed ? swapPermission.reason : "");
  const redrawBlock = externalBlock || (!redrawPermission.allowed ? redrawPermission.reason : "");
  const controlsBusy = Boolean(pending) || busy;
  const choices = choosingIncoming ? reserveCodes : handCodes;
  const remainingLabel = `${redrawPermission.remaining} changement${redrawPermission.remaining > 1 ? "s" : ""} restant${redrawPermission.remaining > 1 ? "s" : ""} pour cette culture`;

  function focusStep() {
    requestAnimationFrame(() => {
      if (!mounted.current) return;
      if (choicesList.current) choicesList.current.scrollTop = 0;
      focusAndReveal(stepHeading.current);
    });
  }

  function showNotice(message: string, error = false) {
    setNotice({ message, error });
  }

  function chooseCard(index: number) {
    if (operation.current || controlsBusy || swapBlock) return;
    setNotice(null);
    setRedrawScope(null);
    if (choosingIncoming && activeSelection) {
      setSelection({ ...activeSelection, incoming: index });
      requestAnimationFrame(() => {
        if (!mounted.current) return;
        focusAndReveal(document.getElementById(`${id}-exchange-review`));
      });
    } else {
      setSelection({ scope: selectionScope, out: index, incoming: null });
      focusStep();
    }
  }

  function resetSelection() {
    setSelection(null);
    setNotice(null);
    focusStep();
  }

  async function exchange() {
    if (operation.current || controlsBusy || swapBlock || !activeSelection || activeSelection.incoming === null || !outgoing || !incoming) return;
    const { out, incoming: reserveIndex } = activeSelection;
    const message = outgoing.code === incoming.code
      ? `Échange confirmé entre deux copies de ${outgoing.name}. Les cartes de ta main restent identiques.`
      : `${incoming.name} est entrée dans ta main. ${outgoing.name} rejoint la réserve.`;
    operation.current = true;
    setPending("swap");
    setNotice(null);
    try {
      const succeeded = await onSwap(out, reserveIndex);
      if (!mounted.current) return;
      if (!succeeded) {
        showNotice("L’échange n’a pas été effectué. Vérifie sa disponibilité avant de réessayer.", true);
        return;
      }
      setSelection(null);
      showNotice(`${message} Aucun XP dépensé, aucune copie brûlée.`);
    } catch (error) {
      if (mounted.current) showNotice(error instanceof Error ? error.message : "L’échange n’a pas pu être confirmé.", true);
    } finally {
      operation.current = false;
      if (mounted.current) setPending(null);
    }
  }

  async function redraw() {
    if (operation.current || controlsBusy || redrawBlock) return;
    operation.current = true;
    setPending("redraw");
    setNotice(null);
    try {
      const succeeded = await onRedraw();
      if (!mounted.current) return;
      if (!succeeded) {
        showNotice("La main n’a pas été changée. Vérifie sa disponibilité avant de réessayer.", true);
        return;
      }
      setSelection(null);
      setRedrawScope(null);
      showNotice(`Nouvelle main confirmée. 1 changement utilisé pour cette culture.${reserveCodes.length ? " La réserve d’échange a été retirée." : ""} Aucun XP dépensé, aucune copie brûlée.`);
    } catch (error) {
      if (mounted.current) showNotice(error instanceof Error ? error.message : "La nouvelle main n’a pas pu être confirmée.", true);
    } finally {
      operation.current = false;
      if (mounted.current) setPending(null);
    }
  }

  function requestRedraw() {
    if (operation.current || controlsBusy || redrawBlock) return;
    setNotice(null);
    if (!reserveCodes.length) { void redraw(); return; }
    setRedrawScope(selectionScope);
    requestAnimationFrame(() => {
      focusAndReveal(redrawWarning.current);
    });
  }

  return <details className={styles.adjustment} data-hand-adjustment>
    <summary><span><strong>Ajuster ma main</strong><small>{remainingLabel}{reserveCodes.length ? ` · ${reserveCodes.length} en réserve` : ""}</small></span><ChevronDown size={18} aria-hidden="true" /></summary>
    <div className={styles.body}>
      <p ref={status} className={styles.status} data-hand-adjustment-status data-error={notice?.error || undefined} role="status" tabIndex={-1}>{notice?.message}</p>
      {reserveCodes.length > 0 ? <section className={styles.exchange} aria-labelledby={`${id}-heritage-title`}>
        <h3 id={`${id}-heritage-title`}>Main prévoyante</h3>
        <p className={styles.intro}>{handCodes.length} cartes en main · {reserveCodes.length} cartes en réserve. Échange une carte avant ta première préparation ou ton premier lancer.</p>
        {swapBlock ? <p className={styles.blocked} id={`${id}-swap-blocked`} data-heritage-swap-reason>{swapBlock}</p> : null}
        <div className={styles.stepHeader}>
          <h4 ref={stepHeading} tabIndex={-1}>{choosingIncoming ? "2. Choisis la carte à faire entrer" : "1. Choisis la carte à retirer"}</h4>
          {choosingIncoming ? <button type="button" className={styles.back} onClick={resetSelection} disabled={controlsBusy}><ArrowLeft size={15} aria-hidden="true" />Changer de carte à retirer</button> : null}
        </div>
        {outgoing ? <p className={styles.outgoing}>À retirer : <strong>{outgoing.name}</strong></p> : null}
        <div className={styles.choices} ref={choicesList} aria-label={choosingIncoming ? "Cartes de la réserve" : "Cartes de ma main"}>
          {choices.map((code, index) => {
            const card = KQ_CARDS.find(item => item.code === code);
            const selected = choosingIncoming && activeSelection?.incoming === index;
            return <div className={styles.choice} key={`${index}-${code}`} data-selected={selected || undefined}>
              <button type="button" className={styles.chooseCard} disabled={controlsBusy || Boolean(swapBlock) || !card}
                data-heritage-out-index={choosingIncoming ? undefined : index} data-heritage-in-index={choosingIncoming ? index : undefined}
                aria-pressed={choosingIncoming ? selected : undefined} aria-describedby={swapBlock ? `${id}-swap-blocked` : undefined}
                onClick={() => chooseCard(index)}>
                <strong>{card?.name ?? "Carte indisponible"}</strong><span>{card ? getKqCardGuide(card).benefit : "Les détails de cette carte ne sont pas disponibles."}</span>
              </button>
              {card ? <CardRules card={card} /> : null}
            </div>;
          })}
        </div>
        {swapBlock ? <details className={styles.reserveLibrary} data-heritage-reserve-library>
          <summary>Consulter les {reserveCodes.length} carte{reserveCodes.length > 1 ? "s" : ""} de réserve<ChevronDown size={16} aria-hidden="true" /></summary>
          <div className={styles.reserveCards}>
            {reserveCodes.map((code, index) => {
              const card = KQ_CARDS.find(item => item.code === code);
              return <div key={`${index}-${code}`}>
                <strong>{card?.name ?? "Carte indisponible"}</strong>
                <p>{card ? getKqCardGuide(card).benefit : "Les détails de cette carte ne sont pas disponibles."}</p>
                {card ? <CardRules card={card} /> : null}
              </div>;
            })}
          </div>
        </details> : null}
        {outgoing && incoming ? <div className={styles.review} id={`${id}-exchange-review`} tabIndex={-1}>
          <p><span>Sort de la main</span><strong>{outgoing.name}</strong><ArrowDown size={17} aria-hidden="true" /><span>Entre dans la main</span><strong>{incoming.name}</strong></p>
          {outgoing.code === incoming.code ? <p className={styles.identical}>Deux copies de la même carte : ta main restera identique.</p> : null}
          <p className={styles.cost}>Échanger : 0 XP · aucune copie brûlée</p>
          <button type="button" className={styles.primary} data-heritage-swap-confirm onClick={() => void exchange()} disabled={controlsBusy || Boolean(swapBlock)} aria-busy={pending === "swap" || undefined} aria-describedby={swapBlock ? `${id}-swap-blocked` : undefined}>
            <ArrowRightLeft size={17} aria-hidden="true" />{pending === "swap" ? "Échange en cours…" : "Échanger"}
          </button>
        </div> : <p className={styles.cost}>Échanger : 0 XP · aucune copie brûlée</p>}
      </section> : null}
      <section className={styles.redraw} aria-labelledby={`${id}-redraw-title`}>
        <h3 id={`${id}-redraw-title`}>Repiocher toute ma main</h3>
        <p className={styles.quota}>{remainingLabel}.</p>
        <p className={styles.intro}>Nouvelle pioche au hasard parmi tes copies restantes, sans garantie de carte jouable. Certaines cartes peuvent revenir.</p>
        <p className={styles.cost}>Changer : 0 XP · aucune copie brûlée</p>
        <p className={redrawBlock ? styles.blocked : styles.permission} id={`${id}-redraw-reason`} data-hand-redraw-reason>{redrawBlock || "Utilise 1 changement pour toute la culture, pas seulement cette étape."}</p>
        {reserveCodes.length > 0 ? <p className={styles.reserveNotice}>Cette action retire aussi la réserve d’échange de Main prévoyante ({reserveCodes.length} carte{reserveCodes.length > 1 ? "s" : ""}). Tes copies restent dans l’album.</p> : null}
        {confirmingRedraw ? <div className={styles.redrawConfirmation} ref={redrawWarning} tabIndex={-1} data-hand-redraw-warning>
          <strong>Repiocher et retirer la réserve ?</strong>
          <p>Tu ne pourras plus échanger avec ces {reserveCodes.length} carte{reserveCodes.length > 1 ? "s" : ""} de réserve dans cette culture.</p>
          <div className={styles.actions}>
            <button type="button" disabled={controlsBusy} onClick={() => { setRedrawScope(null); requestAnimationFrame(() => focusAndReveal(redrawButton.current)); }}>Annuler</button>
            <button type="button" className={styles.primary} data-hand-redraw-confirm disabled={controlsBusy || Boolean(redrawBlock)} aria-busy={pending === "redraw" || undefined} aria-describedby={`${id}-redraw-reason`} onClick={() => void redraw()}>{pending === "redraw" ? "Nouvelle pioche…" : "Confirmer la nouvelle pioche"}</button>
          </div>
        </div> : <button type="button" ref={redrawButton} className={styles.redrawButton} data-hand-redraw disabled={controlsBusy || Boolean(redrawBlock)} aria-busy={pending === "redraw" || undefined} aria-describedby={`${id}-redraw-reason`} onClick={requestRedraw}><RotateCcw size={17} aria-hidden="true" />{pending === "redraw" ? "Nouvelle pioche…" : "Changer ma main"}</button>}
      </section>
    </div>
  </details>;
}
