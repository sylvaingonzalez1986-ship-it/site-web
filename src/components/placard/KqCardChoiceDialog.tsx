"use client";

import { useId } from "react";
import { ChevronDown, Flame, RefreshCw } from "lucide-react";
import { AppDialog } from "@/components/ui/AppDialog";
import { getKqCardTradeoff, type KqSupportCard } from "@/lib/kanab-quest-game";
import type { KqCardPlayPreview as CardPlayPreview } from "@/lib/kanab-quest-card-preview";
import { KqCardEffectGuide } from "./KqCardEffectGuide";
import { KqCardPlayPreview } from "./KqCardPlayPreview";
import styles from "./KqCardChoiceDialog.module.css";

type Props = {
  card: KqSupportCard;
  copies: number;
  xp: number;
  preview: CardPlayPreview | null;
  blockedReason: string | null;
  teachingAssistance: boolean;
  confirming: boolean;
  notice: string;
  onClose: () => void;
  onConfirm: () => void;
  recovery?: { checking: boolean; onCheck: () => void };
};

export function KqCardChoiceDialog({ card, copies, xp, preview, blockedReason, teachingAssistance, confirming, notice, onClose, onConfirm, recovery }: Props) {
  const id = useId();
  const tradeoff = getKqCardTradeoff(card);
  return <AppDialog open onClose={onClose} title={<h2 className={styles.title}>{card.name}</h2>}
    className={styles.dialog} bodyClassName={styles.body} dialogProps={{ "data-card-choice": card.code }}
    footer={<>
      {notice ? <p className={styles.notice} role="status" tabIndex={0} data-card-choice-notice>{notice}</p> : null}
      <div className={styles.cost} id={`${id}-cost`} data-culture-card-cost>
        {recovery ? <><strong>Vérification sans dépense</strong><span>XP et copies disponibles à vérifier.</span></>
          : <><strong>{card.xpCost} XP de culture · 1 copie détruite</strong><span>Disponibles : {xp} XP · {copies} copie{copies > 1 ? "s" : ""} dans l’album</span></>}
      </div>
      <div className={styles.actions}>
        <button type="button" onClick={onClose}>{recovery || blockedReason || confirming ? "Fermer" : "Annuler"}</button>
        {recovery ? <button type="button" className={styles.confirm} disabled={recovery.checking} aria-busy={recovery.checking || undefined}
          data-card-recovery-refresh aria-describedby={`${id}-cost`} onClick={recovery.onCheck}>
          <RefreshCw size={17} aria-hidden="true" />{recovery.checking ? "Vérification…" : "Vérifier ma culture"}
        </button> : <button type="button" className={styles.confirm} disabled={Boolean(blockedReason) || confirming}
          aria-describedby={`${id}-cost${blockedReason || confirming ? ` ${id}-blocked` : ""}`}
          aria-busy={confirming || undefined} data-culture-confirm-card onClick={onConfirm}>
          <Flame size={17} aria-hidden="true" />{confirming ? "Confirmation…" : "Jouer la carte"}
        </button>}
      </div>
    </>}>
    {blockedReason || confirming ? <p className={styles.blocked} id={`${id}-blocked`} data-card-blocked-reason role="status">
      {confirming ? "Confirmation en cours. Fermer cette fenêtre n’annule pas la demande." : blockedReason}
    </p> : null}
    <p className={styles.effect} data-card-choice-effect>{tradeoff.benefit}</p>
    <p className={styles.limit} data-card-choice-limit><strong>Limite : </strong>{tradeoff.risk}</p>
    {teachingAssistance ? <p className={styles.assistance} data-card-teaching-assistance>Dans cet essai, un secours accompagne les situations critiques.</p>
      : preview?.kind === "preparation" ? <p className={styles.timing} data-card-play-preview="preparation">À jouer avant le lancer. Le résultat du lancer reste inconnu.</p>
      : preview ? <KqCardPlayPreview preview={preview} /> : null}
    <details className={styles.rules} data-card-choice-rules><summary>Règles et situations adaptées<ChevronDown size={16} aria-hidden="true" /></summary><KqCardEffectGuide card={card} /></details>
  </AppDialog>;
}
