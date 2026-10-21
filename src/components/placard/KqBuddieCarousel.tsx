"use client";
import Image from "next/image";
import { Check, Leaf, LockKeyhole } from "lucide-react";
import { useId, useState } from "react";
import { BuddieCard } from "@/components/lottery/BuddieCard";
import { hasModernBuddieArtwork } from "@/lib/buddie-artwork";
import { rarityLabels } from "@/lib/lottery-card-ui";
import type { KqBuddie } from "@/lib/kanab-quest-game";
import { getKqBuddieRotationRemaining, KQ_BUDDIE_ROTATION_REQUIRED, type KqBuddieRotation } from "@/lib/kanab-quest-buddie-rotation";
import { KqCardCarousel } from "./KqCardCarousel";
import { KqBuddieFlavors } from "./KqBuddieFlavors";
import { KqBuddieVarietyPopover } from "./KqBuddieVarietyPopover";
import shared from "./KqCardCarousel.module.css";
import styles from "./KqBuddieCarousel.module.css";

type Props = {
  buddies: readonly KqBuddie[];
  artwork: Record<string, { imageUrl: string; ownedCopies: number }>;
  selectedCode: string;
  rotation?: KqBuddieRotation | null;
  onSelect: (code: string) => void;
  onInspect?: (code: string) => void;
};
export function KqBuddieCarousel({ buddies, artwork, selectedCode, rotation, onSelect, onInspect }: Props) {
  const id = useId();
  const [inspected, setInspected] = useState<{ code: string; trigger: HTMLButtonElement; anchor: HTMLElement } | null>(null);
  const rotationEnabled = rotation !== undefined;
  const rotationLoading = rotation === null;
  const inspectedBuddie = inspected ? buddies.find(buddie => buddie.code === inspected.code) : undefined;
  const inspectedRotation = inspectedBuddie && rotation ? getKqBuddieRotationRemaining(inspectedBuddie.code, rotation.recentBuddieCodes) : 0;
  const inspectedUnavailable = rotationLoading ? "Vérification des Buddies disponibles…"
    : inspectedRotation ? `Joue encore ${inspectedRotation} autre${inspectedRotation > 1 ? "s" : ""} Buddie${inspectedRotation > 1 ? "s" : ""} avant de le choisir.` : undefined;
  const availableCount = buddies.filter(buddie => !rotationLoading && (!rotation || getKqBuddieRotationRemaining(buddie.code, rotation.recentBuddieCodes) === 0)).length;
  return <><KqCardCarousel id="placard-preparation" title="1. Ton Buddie" label="Tes cartes Buddies" count={buddies.length} tourStep="culture"
    intro={rotationEnabled ? <div className={styles.rotationRule}>
      <strong>Fais tourner tes Buddies</strong>
      <p>Après avoir lancé une culture avec un Buddie, utilise {KQ_BUDDIE_ROTATION_REQUIRED} autres Buddies différents avant de le rejouer. La règle vaut pour toutes les raretés, même si tu possèdes plusieurs copies.</p>
      <small role="status">{rotationLoading ? "Vérification des Buddies disponibles…" : `${availableCount} Buddie${availableCount > 1 ? "s" : ""} disponible${availableCount > 1 ? "s" : ""} sur ${buddies.length}.`}</small>
      {!rotationLoading && buddies.length > 0 && buddies.length <= KQ_BUDDIE_ROTATION_REQUIRED ? <small>Avec au moins {KQ_BUDDIE_ROTATION_REQUIRED + 1} Buddies différents, tu peux alterner les variétés pour enchaîner les cultures.</small> : null}
    </div> : null}
    footer={!buddies.length ? <p className={shared.empty}>Tes Buddies disponibles apparaîtront ici.</p> : null}>
    {buddies.map(buddie => {
      const remaining = rotation ? getKqBuddieRotationRemaining(buddie.code, rotation.recentBuddieCodes) : 0;
      const locked = rotationLoading || remaining > 0;
      const illustration = artwork[buddie.code], selected = selectedCode === buddie.code && !locked;
      const availabilityLabel = rotationLoading ? "Vérification en cours" : `Encore ${remaining} autre${remaining > 1 ? "s" : ""} Buddie${remaining > 1 ? "s" : ""} différent${remaining > 1 ? "s" : ""}`;
      return <article key={buddie.code} role="listitem" className={shared.card} data-selected={selected || undefined} data-locked={locked || undefined}>
        <div className={shared.artwork}>
          <button type="button" data-carousel-drag data-buddie-variety-card={buddie.code} className={styles.picture} data-unavailable={locked || undefined} aria-label={`Voir la fiche de ${buddie.name}`} aria-describedby={locked ? `buddie-rotation-${buddie.code}` : undefined} aria-haspopup="dialog" aria-expanded={inspectedBuddie?.code === buddie.code} aria-controls={inspectedBuddie?.code === buddie.code ? `${id}-variety` : undefined} onClick={event => {
            const trigger = event.currentTarget;
            const anchor = trigger.closest<HTMLElement>('[role="list"]');
            if (anchor) {
              if (inspected?.code !== buddie.code) onInspect?.(buddie.code);
              setInspected(previous => previous?.code === buddie.code ? null : { code: buddie.code, trigger, anchor });
            }
          }}>
            {hasModernBuddieArtwork(buddie.code) ? <BuddieCard code={buddie.code} name={buddie.name} rarity={buddie.rarity} cardNumber={buddie.cardNumber} imageUrl={illustration?.imageUrl} sizes="(max-width: 600px) 74vw, 275px" />
              : illustration?.imageUrl ? <Image src={illustration.imageUrl} alt={`Carte ${buddie.name}`} width={1024} height={1536} sizes="(max-width: 600px) 74vw, 275px" />
              : <span className={styles.placeholder}><Leaf size={48} aria-hidden="true" /><strong>{buddie.name}</strong><span>Buddie #{buddie.cardNumber}</span></span>}
          </button>
        </div>
        <KqBuddieFlavors varietyCode={buddie.code} />
        <div className={styles.metadata}>
          <span className={shared.timing}>#{buddie.cardNumber} · {rarityLabels[buddie.rarity]}{illustration?.ownedCopies ? ` · ×${illustration.ownedCopies}` : ""}</span>
          {selected ? <span className={styles.selected}><Check size={14} aria-hidden="true" /> Choisi</span> : null}
        </div>
        <h3>{buddie.name}</h3><p>{buddie.ability}</p>
        {locked ? <p id={`buddie-rotation-${buddie.code}`} className={styles.rotationStatus}><LockKeyhole size={14} aria-hidden="true" />{availabilityLabel}</p> : null}
        <button type="button" data-buddie-select={buddie.code} disabled={locked} aria-label={`${locked ? "Indisponible" : selected ? "Sélectionné" : "Choisir"} : ${buddie.name}`} aria-describedby={locked ? `buddie-rotation-${buddie.code}` : undefined} aria-pressed={selected} onClick={() => onSelect(buddie.code)}>{locked ? "Buddie en rotation" : selected ? "Sélectionné" : "Choisir ce Buddie"}</button>
      </article>;
    })}
  </KqCardCarousel>
    {inspectedBuddie && inspected && <KqBuddieVarietyPopover key={inspectedBuddie.code} id={`${id}-variety`} buddie={inspectedBuddie} anchor={inspected.anchor} trigger={inspected.trigger} onClose={() => setInspected(null)} unavailableReason={inspectedUnavailable} onChoose={() => onSelect(inspectedBuddie.code)} />}
  </>;
}
