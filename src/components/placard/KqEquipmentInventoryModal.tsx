"use client";

import {
  Box,
  Check,
  CircleAlert,
  Lightbulb,
  PackageOpen,
  RefreshCw,
  Settings,
  Shield,
  ShoppingBag,
  Wind,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { getKqEquipmentArtwork } from "@/lib/kanab-quest-equipment-artwork";
import {
  getKqEquipmentDefinition,
  getKqEquipmentAtLevel,
  getKqEquipmentImpactLabels,
  getKqEquipmentRequirementState,
  KQ_EQUIPMENT_CATEGORY_LABELS,
  KQ_EQUIPMENT_CATEGORIES,
  KQ_EQUIPMENT_SLOT_LABELS,
  type KqEquipmentCategory,
  type KqEquipmentDefinition,
  type KqEquipmentSlot,
} from "@/lib/kanab-quest-equipment";
import styles from "./KqEquipmentInventoryModal.module.css";
import { KqEquipmentUpgrade } from "./KqEquipmentUpgrade";
import { KqEquipmentTierBadge } from "./KqEquipmentTierBadge";

const SLOT_ORDER: readonly KqEquipmentSlot[] = [
  "tent",
  "lighting",
  "air",
  "climate-controller",
  "energy",
  "security",
  "sifting",
  "washing",
  "filtration",
  "static-separation",
  "press",
  "drying",
];

const CATEGORY_ICONS: Record<KqEquipmentCategory, LucideIcon> = {
  infrastructure: Box,
  lighting: Lightbulb,
  climate: Wind,
  processing: Settings,
  energy: Zap,
  security: Shield,
};

type InventoryGroup = {
  slot: KqEquipmentSlot;
  equipment: KqEquipmentDefinition[];
};

function EquipmentVisual({ equipment, level = 1 }: { equipment: KqEquipmentDefinition; level?: number }) {
  const artwork = getKqEquipmentArtwork(equipment.code, level);
  const Icon = CATEGORY_ICONS[equipment.category];
  return (
    <span className={styles.visual} data-category={equipment.category} data-has-artwork={artwork ? true : undefined}>
      {artwork ? (
        <Image
          src={artwork.src}
          alt={artwork.alt}
          fill
          sizes="(max-width: 680px) 92px, 140px"
          className={styles.visualImage}
        />
      ) : <Icon aria-hidden="true" />}
      <KqEquipmentTierBadge level={level} />
    </span>
  );
}

export function KqEquipmentInventoryModal({
  ownedCodes,
  purchasedCodes,
  equippedCodes,
  levels,
  cashCents,
  loading,
  loadError,
  onClose,
  onOpenShop,
  onRetry,
}: {
  ownedCodes: string[];
  purchasedCodes: string[];
  equippedCodes: string[];
  levels: Record<string, number>;
  cashCents: number;
  loading: boolean;
  loadError: string;
  onClose: () => void;
  onOpenShop: () => void;
  onRetry: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [category, setCategory] = useState<KqEquipmentCategory | "all">("all");
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [equippedOverride, setEquippedOverride] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const activeCodes = equippedOverride ?? equippedCodes;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  const ownedEquipment = useMemo(() => [...new Set(purchasedCodes)]
    .map((code) => getKqEquipmentAtLevel(code, levels[code]))
    .filter((equipment): equipment is KqEquipmentDefinition => Boolean(equipment?.purchasable)), [purchasedCodes, levels]);
  const activeEquipment = useMemo(() => [...new Set(activeCodes)]
    .map((code) => getKqEquipmentDefinition(code))
    .filter((equipment): equipment is KqEquipmentDefinition => Boolean(equipment)), [activeCodes]);
  const availableCategories = useMemo(() => KQ_EQUIPMENT_CATEGORIES.filter((candidate) => (
    ownedEquipment.some((equipment) => equipment.category === candidate)
  )), [ownedEquipment]);
  const groups = useMemo(() => SLOT_ORDER.flatMap((slot): InventoryGroup[] => {
    const equipment = ownedEquipment
      .filter((item) => item.slot === slot && (category === "all" || item.category === category))
      .sort((left, right) => Number(activeCodes.includes(right.code)) - Number(activeCodes.includes(left.code))
        || right.priceCents - left.priceCents
        || left.name.localeCompare(right.name));
    return equipment.length > 0 ? [{ slot, equipment }] : [];
  }), [activeCodes, category, ownedEquipment]);
  const equippedCount = ownedEquipment.filter((equipment) => activeCodes.includes(equipment.code)).length;

  const equip = async (equipment: KqEquipmentDefinition) => {
    if (pendingCode || activeCodes.includes(equipment.code)) return;
    if (!purchasedCodes.includes(equipment.code)) {
      setError("Cet équipement doit être acheté avant de pouvoir être installé.");
      return;
    }
    setPendingCode(equipment.code);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/arena/placard/equipment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equipmentCode: equipment.code }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Installation impossible.");
      const nextCodes = activeCodes.filter((code) => getKqEquipmentDefinition(code)?.slot !== equipment.slot);
      setEquippedOverride([...nextCodes, equipment.code]);
      setNotice(`${equipment.name} est maintenant installé.`);
      window.dispatchEvent(new Event("kq:equipment-updated"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Installation impossible.");
    } finally {
      setPendingCode(null);
    }
  };

  const openShop = () => {
    onClose();
    onOpenShop();
  };

  return (
    <div className={styles.overlay}>
      <button type="button" tabIndex={-1} className={styles.backdrop} onClick={onClose} aria-label="Fermer l’inventaire" />
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="equipment-inventory-title">
        <header className={styles.header}>
          <span className={styles.headerIcon}><PackageOpen aria-hidden="true" /></span>
          <div>
            <small>Atelier du placard</small>
            <h2 id="equipment-inventory-title">Inventaire d’équipement</h2>
            <p>{loading ? "Chargement de l’atelier…" : `${ownedEquipment.length} pièce${ownedEquipment.length > 1 ? "s" : ""} possédée${ownedEquipment.length > 1 ? "s" : ""} · ${equippedCount} installée${equippedCount > 1 ? "s" : ""}`}</p>
          </div>
          <button ref={closeButtonRef} type="button" className={styles.closeButton} onClick={onClose} aria-label="Fermer l’inventaire"><X aria-hidden="true" /></button>
        </header>

        <div className={styles.categoryBar} aria-label="Filtrer l’inventaire">
          <button type="button" aria-pressed={category === "all"} data-active={category === "all" || undefined} onClick={() => setCategory("all")}>Tout</button>
          {availableCategories.map((candidate) => {
            const Icon = CATEGORY_ICONS[candidate];
            return <button key={candidate} type="button" aria-pressed={category === candidate} data-active={category === candidate || undefined} onClick={() => setCategory(candidate)}><Icon aria-hidden="true" />{KQ_EQUIPMENT_CATEGORY_LABELS[candidate]}</button>;
          })}
        </div>

        <div className={styles.feedback} aria-live="polite">
          {error || loadError ? <p data-error><CircleAlert aria-hidden="true" />{error || loadError}</p> : null}
          {notice ? <p data-notice><Check aria-hidden="true" />{notice}</p> : null}
        </div>

        <div className={styles.content}>
          {loading ? (
            <div className={styles.skeleton} aria-label="Chargement de l’inventaire"><i /><i /><i /></div>
          ) : loadError ? (
            <div className={styles.emptyState}>
              <CircleAlert aria-hidden="true" />
              <strong>Impossible d’ouvrir l’atelier.</strong>
              <button type="button" onClick={onRetry}><RefreshCw aria-hidden="true" />Réessayer</button>
            </div>
          ) : groups.length === 0 ? (
            <div className={styles.emptyState}>
              <PackageOpen aria-hidden="true" />
              <strong>{category === "all" ? "Aucun équipement acheté pour le moment." : "Aucun achat dans cette catégorie."}</strong>
              <button type="button" onClick={openShop}><ShoppingBag aria-hidden="true" />Voir la boutique</button>
            </div>
          ) : groups.map((group) => {
            const installed = activeEquipment.find((equipment) => equipment.slot === group.slot) ?? null;
            return (
              <section key={group.slot} className={styles.slotGroup} aria-labelledby={`inventory-slot-${group.slot}`}>
                <header>
                  <div>
                    <small>Emplacement</small>
                    <h3 id={`inventory-slot-${group.slot}`}>{KQ_EQUIPMENT_SLOT_LABELS[group.slot]}</h3>
                  </div>
                  <span data-empty={!installed || undefined}>{installed ? `${installed.name} actif` : "Emplacement libre"}</span>
                </header>
                <div className={styles.equipmentGrid}>
                  {group.equipment.map((equipment) => {
                    const isEquipped = activeCodes.includes(equipment.code);
                    const requirementState = getKqEquipmentRequirementState({ equipment, ownedCodes });
                    const replacedEquipment = activeEquipment.find((candidate) => (
                      candidate.slot === equipment.slot && activeCodes.includes(candidate.code) && candidate.code !== equipment.code
                    ));
                    const impacts = getKqEquipmentImpactLabels(equipment).slice(0, 3);
                    return (
                      <article key={equipment.code} className={styles.equipmentCard} data-equipped={isEquipped || undefined}>
                        <EquipmentVisual equipment={equipment} level={levels[equipment.code] ?? 1} />
                        <div className={styles.cardCopy}>
                          <span className={styles.status} data-equipped={isEquipped || undefined}>{isEquipped ? <><Check aria-hidden="true" />Installé</> : "En réserve"}</span>
                          <small>{KQ_EQUIPMENT_CATEGORY_LABELS[equipment.category]} · {equipment.specification}</small>
                          <h4>{equipment.name}</h4>
                          <p>{equipment.benefit}</p>
                          <ul>{impacts.map((impact) => <li key={impact}><Check aria-hidden="true" />{impact}</li>)}</ul>
                          <em data-tradeoff>Contrepartie : {equipment.tradeoff}</em>

                          {!isEquipped && replacedEquipment ? <em>Remplace : {replacedEquipment.name}</em> : null}
                          {!requirementState.compatible ? <em data-warning>Prérequis : {requirementState.missing.map((requirement) => requirement.label).join(" · ")}</em> : null}
                        </div>
                        <div className={styles.upgradeSlot}><KqEquipmentUpgrade code={equipment.code} level={levels[equipment.code] ?? 1} cashCents={cashCents} disabled={pendingCode !== null} onUpdated={onRetry} /></div>
                        <footer>
                          <button
                            type="button"
                            disabled={isEquipped || !requirementState.compatible || Boolean(pendingCode)}
                            onClick={() => void equip(equipment)}
                          >
                            {pendingCode === equipment.code ? "Installation…" : isEquipped ? "Déjà installé" : requirementState.compatible ? "Installer" : "Installation bloquée"}
                          </button>
                        </footer>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <footer className={styles.footer}>
          <p><strong>Un seul équipement actif par emplacement.</strong> Améliore chaque matériel jusqu’au niveau 10. Son apparence évolue aux niveaux 5 et 10.</p>
          <button type="button" onClick={openShop}><ShoppingBag aria-hidden="true" />Acheter du matériel</button>
        </footer>
      </section>
    </div>
  );
}
