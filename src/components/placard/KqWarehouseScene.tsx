"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { getKqEquipmentAtLevel, KQ_EQUIPMENT_SLOT_LABELS, type KqEquipmentSlot } from "@/lib/kanab-quest-equipment";
import assetManifest from "../../../public/placard/warehouse-v2/manifest.json";
import styles from "./KqWarehouseScene.module.css";

type WarehouseZone = { slot: KqEquipmentSlot; center: number; bottom: number; height: number };

// Coordinates use the room's 2:1 canvas. Heights follow a common physical scale:
// about 20% of scene height per metre at the back, 24% at the front.
// Benchtop machines share the countertop baseline; floor machines share an aisle.
export const WAREHOUSE_ZONES: readonly WarehouseZone[] = [
  { slot: "tent", center: 22, bottom: 66, height: 42 },
  { slot: "lighting", center: 20.6, bottom: 42, height: 15 },
  { slot: "air", center: 26.7, bottom: 27.5, height: 7.5 },
  { slot: "climate-controller", center: 31.2, bottom: 44, height: 5.5 },
  { slot: "security", center: 9.5, bottom: 28, height: 5 },
  { slot: "energy", center: 10.5, bottom: 84, height: 23 },
  { slot: "sifting", center: 40, bottom: 48.8, height: 13 },
  { slot: "press", center: 54, bottom: 48.8, height: 10 },
  { slot: "static-separation", center: 71.5, bottom: 66, height: 37 },
  { slot: "washing", center: 34, bottom: 86, height: 23 },
  { slot: "filtration", center: 47, bottom: 86, height: 21 },
  { slot: "drying", center: 61, bottom: 87, height: 27 },
  { slot: "flower-drying", center: 88.9, bottom: 64, height: 36 },
];

const assets: Record<string, { width: number; height: number }> = assetManifest.assets;

function artworkFor(slot: KqEquipmentSlot, code: string | undefined, level: number) {
  if (slot === "security") return code === "SECURITY-DOG" ? "security-dog" : "security-camera";
  if (slot === "flower-drying") return level >= 5 ? "flower-drying-full" : "flower-drying";
  if (slot === "tent" || slot === "lighting" || slot === "air") {
    return `${slot}-${!code || code.includes("STARTER") ? "starter" : "pro"}`;
  }
  return slot;
}

export function KqWarehouseScene({
  equippedCodes, levels, selectedSlot, onSelect, disabled = false,
}: {
  equippedCodes: string[];
  levels: Record<string, number>;
  selectedSlot: KqEquipmentSlot;
  onSelect: (slot: KqEquipmentSlot) => void;
  disabled?: boolean;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [overview, setOverview] = useState(false);
  const hasDog = equippedCodes.includes("SECURITY-DOG");
  const starterTent = !equippedCodes.some(code => getKqEquipmentAtLevel(code)?.slot === "tent" && !code.includes("STARTER"));
  const installedEquipment = equippedCodes.map(code => getKqEquipmentAtLevel(code, levels[code]));

  useEffect(() => {
    const element = viewport.current;
    const target = element?.querySelector<HTMLElement>(`[data-warehouse-slot="${selectedSlot}"]`);
    if (element && target && !overview) {
      element.scrollLeft = target.offsetLeft + target.offsetWidth / 2 - element.clientWidth / 2;
    }
  }, [selectedSlot, hasDog, overview]);

  return <div className={styles.viewer}>
    <div className={styles.viewControls}>
      <span>Ton atelier</span>
      <button type="button" onClick={() => setOverview(value => !value)} aria-pressed={overview}>
        {overview ? <Maximize2 size={15} aria-hidden="true"/> : <Minimize2 size={15} aria-hidden="true"/>}
        {overview ? "Agrandir le décor" : "Vue d’ensemble"}
      </button>
    </div>
    <div ref={viewport} className={styles.viewport} data-overview={overview}>
      <div className={styles.scene} aria-label="Les emplacements de ton entrepôt">
        <Image src="/placard/warehouse-v2/room.webp"
          alt="Atelier organisé avec une zone de culture à gauche, un établi central, des machines au sol et un accès dégagé au séchoir à droite"
          fill sizes="(max-width: 960px) 960px, 1150px" loading="eager" fetchPriority="high" className={styles.background}/>
        {WAREHOUSE_ZONES.map(zone => {
          const installed = installedEquipment.find(item => item?.slot === zone.slot);
          const level = installed?.purchasable ? levels[installed.code] ?? 1 : 1;
          const dog = installed?.code === "SECURITY-DOG";
          const room = zone.slot === "flower-drying";
          const asset = artworkFor(zone.slot, installed?.code, level);
          const dimensions = assets[asset];
          let { center, bottom, height } = zone;
          if (dog) { center = 76.5; bottom = 91; height = 20; }
          if (zone.slot === "tent" && starterTent) height = 38;
          if (zone.slot === "lighting" && starterTent) { center = 20.5; bottom = 44; height = 12; }
          if (zone.slot === "air" && starterTent) { center = 24.7; bottom = 31; height = 6; }
          const width = room ? 8.1 : height * dimensions.width / dimensions.height / 2;
          const style = {
            left: `${center - width / 2}%`, top: `${bottom - height}%`,
            width: `${width}%`, height: `${height}%`,
            "--depth": dog ? 9 : zone.slot === "tent" ? 2 : bottom >= 80 ? 7 : room ? 1 : 4,
          } as CSSProperties;
          return <button type="button" key={zone.slot} data-warehouse-slot={zone.slot}
            disabled={disabled} className={styles.zone} data-installed={!!installed}
            data-selected={selectedSlot === zone.slot} data-tier={level >= 10 ? 3 : level >= 5 ? 2 : 1}
            data-room={room || undefined} data-dog={dog || undefined} style={style}
            aria-pressed={selectedSlot === zone.slot}
            aria-label={`${KQ_EQUIPMENT_SLOT_LABELS[zone.slot]} · ${installed ? `${installed.name}, ${installed.purchasable ? `niveau ${level}` : "fourni"}` : "emplacement libre"}`}
            onClick={() => onSelect(zone.slot)}>
            {installed ? <Image src={`/placard/warehouse-v2/${asset}.webp`} alt=""
              width={dimensions.width} height={dimensions.height}
              sizes={zone.slot === "tent" || zone.slot === "static-separation" ? "300px" : "220px"}
              className={styles.sprite} draggable={false}/> : <span className={styles.emptyMarker} aria-hidden="true">+</span>}
            <span className={styles.label}>{KQ_EQUIPMENT_SLOT_LABELS[zone.slot]}
              <small>{installed ? (installed.purchasable ? `Niv. ${level}` : "Fourni") : "+ Installer"}</small>
            </span>
          </button>;
        })}
      </div>
    </div>
  </div>;
}
