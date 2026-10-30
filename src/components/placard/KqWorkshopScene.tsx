"use client";

import Image from "next/image";
import { Maximize2, Minimize2, MousePointer2, Ruler, Wrench } from "lucide-react";
import { useState, type CSSProperties } from "react";
import type { KqEquipmentSlot } from "@/lib/kanab-quest-equipment";
import type { KqMachineCondition } from "@/lib/kanab-quest-maintenance";
import { getKqWorkshopMachineSpecification } from "@/lib/kanab-quest-workshop-machines";
import { getKqWorkshopPlacementStyle, KQ_WORKSHOP_PLACEMENTS, KQ_WORKSHOP_ROOM } from "@/lib/kanab-quest-workshop-layout";
import styles from "./KqWorkshopScene.module.css";

export function KqWorkshopScene({ purchasedCodes, equippedCodes, levels, maintenance = {}, selectedSlot, disabled = false, onSelect }: {
  purchasedCodes: string[];
  equippedCodes: string[];
  levels: Record<string, number>;
  maintenance?: Record<string, KqMachineCondition>;
  selectedSlot?: KqEquipmentSlot;
  disabled?: boolean;
  onSelect: (slot: KqEquipmentSlot) => void;
}) {
  const [zoomed, setZoomed] = useState(false);
  const ownedCount = KQ_WORKSHOP_PLACEMENTS.filter(machine => purchasedCodes.includes(machine.code)).length;
  return <section className={styles.viewer} aria-label="Atelier de transformation, vue de dessus" data-workshop-scene>
    <div className={styles.toolbar}>
      <div><strong>Ton atelier</strong><span>{ownedCount} / 6 machines acquises</span></div>
      <button type="button" onClick={() => setZoomed(value => !value)} aria-pressed={zoomed} aria-label={zoomed ? "Voir tout l’atelier" : "Agrandir l’atelier"}>
        {zoomed ? <Minimize2 size={17} aria-hidden="true" /> : <Maximize2 size={17} aria-hidden="true" />}
        {zoomed ? "Vue d’ensemble" : "Agrandir"}
      </button>
    </div>
    <div className={styles.viewport} data-zoomed={zoomed} tabIndex={zoomed ? 0 : undefined} aria-label={zoomed ? "Atelier agrandi, défilement horizontal et vertical" : undefined}>
      <div className={styles.room}>
        <Image src="/placard/workshop-v1/room.webp" alt="Atelier illustré vu du dessus, murs crème, poutres turquoise et sol clair" fill sizes="(max-width: 850px) 100vw, 850px" loading="eager" draggable={false} className={styles.background} />
        <span className={styles.aisle} aria-hidden="true">ATELIER</span>
        {KQ_WORKSHOP_PLACEMENTS.map(placement => {
          const owned = purchasedCodes.includes(placement.code);
          const installed = owned && equippedCodes.includes(placement.code);
          const level = owned ? levels[placement.code] ?? 1 : 0;
          const machine = getKqWorkshopMachineSpecification(placement.code, level || 1)!;
          const condition = owned && maintenance[placement.code]?.due;
          const state = !owned ? "À acquérir" : condition ? "À entretenir" : installed ? "Installée" : "À installer";
          const action = !owned ? "Acheter" : condition ? "Voir l’entretien" : installed ? "Gérer et améliorer" : "Installer";
          const position = getKqWorkshopPlacementStyle(placement);
          return <div key={placement.code} className={styles.station} style={position}>
            {placement.bench && <span className={styles.bench} aria-hidden="true" style={{ width: `${placement.bench.widthM / placement.widthM * 100}%`, height: `${placement.bench.depthM / placement.depthM * 100}%` }} />}
            <button type="button" className={styles.machine} data-workshop-machine={placement.code} data-warehouse-slot={placement.slot}
              data-owned={owned} data-installed={installed} data-level={level} data-maintenance-due={condition || undefined}
              aria-haspopup="dialog" aria-expanded={selectedSlot === placement.slot} disabled={disabled}
              aria-label={`${placement.label} · ${machine.name} · ${state}${owned ? ` · niveau ${level}` : ""} · ${action}`}
              onClick={() => onSelect(placement.slot)} style={{ "--label-offset": `${Math.max(placement.depthM, placement.bench?.depthM ?? 0) / placement.depthM * 50}%` } as CSSProperties}>
              <span className={styles.machineGlow} aria-hidden="true" />
              <span className={styles.artwork} data-workshop-sprite={placement.sprite} aria-hidden="true">
                <Image src={`/placard/workshop-v1/${placement.sprite}.webp`} alt="" width={512} height={512} sizes="160px" draggable={false} />
              </span>
              <span className={styles.label}><strong>{placement.label}</strong>{owned&&<small>Niv. {level}</small>}<span className={styles.machineStatus} data-workshop-machine-state>{condition ? <Wrench size={11} aria-hidden="true" /> : null}{state}</span></span>
              <span className={styles.tooltip} aria-hidden="true"><strong>{machine.name}</strong><span>{state}{owned ? ` · niveau ${level}` : ""}</span><small>{action}</small></span>
            </button>
          </div>;
        })}
        <div className={styles.scale} style={{ width: `${KQ_WORKSHOP_ROOM.floorSize / KQ_WORKSHOP_ROOM.widthM}%` }} aria-label="Repère d’échelle : un mètre"><span>1 m</span></div>
      </div>
    </div>
    <div className={styles.legend}>
      <p><MousePointer2 size={16} aria-hidden="true" />Sélectionne une machine pour l’installer, l’entretenir ou consulter ses options.</p>
      <div><span><i className={styles.ownedDot} />Acquise</span><span><i className={styles.ghostDot} />À acquérir</span><span><Ruler size={14} aria-hidden="true" />5 × 5 m</span></div>
    </div>
  </section>;
}
