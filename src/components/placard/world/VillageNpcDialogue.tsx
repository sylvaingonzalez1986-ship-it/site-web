"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { X } from "lucide-react";
import { KQ_FARM_GUIDE_OPEN_EVENT } from "@/lib/kanab-quest-guide-navigation";
import { advanceVillageDialogue, type NpcDialogue } from "./village-npc-dialogue";
import type { VillageNpcId, VillageNpcInteraction } from "./village-npc-types";
import styles from "./VillagePrototype.module.css";

export const VILLAGE_NPC_NAMES: Record<VillageNpcId, string> = { breton: "Le sonneur", fisherman: "Le pêcheur", loic: "Loïc" };
export type VillageNpcBridge = {
  active: VillageNpcId | null;
  interaction: VillageNpcInteraction | undefined;
  onInteract: (id: VillageNpcId) => void;
  bubbleNode: RefObject<HTMLElement | null>;
  bubbleTail: RefObject<SVGPathElement | null>;
};

export function useVillageNpcDialogue(hidden: boolean, beforeInteract: () => void) {
  const [dialogue, setDialogue] = useState<NpcDialogue | null>(null);
  const [reading, setReading] = useState(false);
  const history = useRef<Partial<Record<VillageNpcId, NpcDialogue>>>({});
  const current = useRef<NpcDialogue | null>(null);
  const bubble = useRef<HTMLElement>(null), tail = useRef<SVGPathElement>(null);
  const close = useCallback((restoreFocus = false) => {
    const previous = current.current;
    if (previous) history.current[previous.npcId] = { ...previous, segment: previous.segments.length - 1 };
    const focused = bubble.current?.contains(document.activeElement);
    current.current = null;
    setDialogue(null);
    setReading(false);
    if (previous && (restoreFocus || focused)) document.querySelector<HTMLButtonElement>(`[data-npc-access="${previous.npcId}"]`)?.focus({ preventScroll: true });
  }, []);
  const interact = useCallback((id: VillageNpcId) => {
    beforeInteract();
    if (id === "loic") {
      close();
      window.dispatchEvent(new CustomEvent(KQ_FARM_GUIDE_OPEN_EVENT, { detail: { source: "loic" } }));
      return;
    }
    if (current.current && current.current.npcId !== id) close();
    const next = advanceVillageDialogue(id, current.current ?? history.current[id]);
    current.current = next;
    history.current[id] = next;
    setDialogue(next);
  }, [beforeInteract, close]);
  useEffect(() => {
    const opening = () => close();
    window.addEventListener(KQ_FARM_GUIDE_OPEN_EVENT, opening);
    return () => window.removeEventListener(KQ_FARM_GUIDE_OPEN_EVENT, opening);
  }, [close]);
  useEffect(() => {
    if (!dialogue || hidden || reading) return;
    const timer = window.setTimeout(() => close(), dialogue.readingMs);
    return () => window.clearTimeout(timer);
  }, [dialogue, close, hidden, reading]);
  const bridge: VillageNpcBridge = {
    active: dialogue?.npcId ?? null,
    interaction: dialogue ? { type: dialogue.type, emphasis: dialogue.emphasis } : undefined,
    onInteract: interact, bubbleNode: bubble, bubbleTail: tail,
  };
  return { dialogue, bridge, close, setReading };
}

export function VillageNpcDialogue({ dialogue, bridge: { bubbleNode: nodeRef, bubbleTail: tailRef, onInteract }, onClose, onReading }: {
  dialogue: NpcDialogue; bridge: VillageNpcBridge; onClose: () => void; onReading: (reading: boolean) => void;
}) {
  return <>
    <svg className={styles.bubbleTail} aria-hidden="true"><path ref={tailRef} /></svg>
    <section ref={nodeRef} className={`${styles.bubble} ${styles.npcBubble}`} data-npc-dialogue={dialogue.npcId}
      data-intervention={dialogue.interventionId} data-segment={dialogue.segment} aria-label={`Échange avec ${VILLAGE_NPC_NAMES[dialogue.npcId]}`}
      onPointerEnter={() => onReading(true)} onPointerLeave={() => onReading(false)}
      onFocus={() => onReading(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) onReading(false); }}>
      <div className={styles.bubbleSheet}>
        <div className={styles.detailHeading}><h2>{VILLAGE_NPC_NAMES[dialogue.npcId]}</h2>
          <button type="button" className={styles.iconControl} aria-label="Fermer l’échange" onClick={onClose}><X size={18} /></button></div>
        <div className={styles.npcSpeech} tabIndex={0} role="region" aria-label="Réplique" aria-live="polite" aria-atomic="true"><p>{dialogue.text}</p></div>
        <div className={styles.npcDialogueActions}>
          {dialogue.segments.length > 1 ? <span>{dialogue.segment + 1} / {dialogue.segments.length}</span> : null}
          <button className={styles.control} data-npc-next type="button" onClick={() => onInteract(dialogue.npcId)}>
            {dialogue.segment < dialogue.segments.length - 1 ? "La suite" : "Encore une"}
          </button>
        </div>
      </div>
    </section>
  </>;
}
