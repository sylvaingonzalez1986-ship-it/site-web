"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { List, Maximize2, Minimize2 } from "lucide-react";
import { getKqEquipmentAtLevel, KQ_EQUIPMENT_SLOT_LABELS, type KqEquipmentSlot } from "@/lib/kanab-quest-equipment";
import type { KqTentOverview } from "./KqTentSelector";
import assetManifest from "../../../public/placard/warehouse-v2/manifest.json";
import styles from "./KqWarehouseScene.module.css";

type WarehouseZone = { slot: KqEquipmentSlot; center: number; bottom: number; height: number; support?: "bench" | "floor" };

// Coordinates refer to the 2:1 room artwork. Anchor the lowest feet inside
// the wooden tabletop (65.8–68.6%) or along the foreground floor at 89%.
// Heights include the complete illustrated assembly: frame, stand and pump.
// Preserve each sprite's aspect ratio; upgrades never change its physical size.
const BENCH_BASELINE = 68.2;
const WORKSHOP_BASELINE = 89;
export const WAREHOUSE_ZONES: readonly WarehouseZone[] = [
  { slot: "sifting", center: 12, bottom: BENCH_BASELINE, height: 16, support: "bench" },
  { slot: "press", center: 26, bottom: BENCH_BASELINE, height: 11.5, support: "bench" },
  { slot: "washing", center: 42.5, bottom: WORKSHOP_BASELINE, height: 27, support: "floor" },
  { slot: "filtration", center: 57.5, bottom: WORKSHOP_BASELINE, height: 24, support: "floor" },
  { slot: "drying", center: 74, bottom: WORKSHOP_BASELINE, height: 28, support: "floor" },
  { slot: "static-separation", center: 93, bottom: WORKSHOP_BASELINE, height: 40, support: "floor" },
  { slot: "energy", center: 18, bottom: 96, height: 15 },
  { slot: "security", center: 4.5, bottom: 24, height: 3.5 },
  { slot: "flower-drying", center: 86, bottom: 41, height: 12 },
];

const TENT_CENTERS = [13, 33, 53, 73] as const;
const TENT_BASELINE = 59;
const SHARED_SLOTS: readonly KqEquipmentSlot[] = ["sifting", "press", "washing", "filtration", "drying", "static-separation"];
const assets: Record<string, { width: number; height: number }> = assetManifest.assets;

function artworkFor(slot: KqEquipmentSlot, code: string | undefined, level: number) {
  if (slot === "security") return code === "SECURITY-DOG" ? "security-dog" : "security-camera";
  if (slot === "flower-drying") return level >= 5 ? "flower-drying-full" : "flower-drying";
  if (slot === "tent" || slot === "lighting" || slot === "air") return `${slot}-${!code || code.includes("STARTER") ? "starter" : "pro"}`;
  return slot;
}

function positionFor(zone: WarehouseZone, asset: string, depth: number): CSSProperties {
  const dimensions = assets[asset];
  const width = zone.height * dimensions.width / dimensions.height / 2;
  return { left: `${zone.center - width / 2}%`, top: `${zone.bottom - zone.height}%`,
    width: `${width}%`, height: `${zone.height}%`, "--depth": depth } as CSSProperties;
}

export function KqWarehouseScene({
  tents, selectedTentNumber, equippedCodes, levels, sharedEquipment, selectedSlot, onSelect, onShowList, onExpand, disabled = false,
}: {
  tents: KqTentOverview[];
  selectedTentNumber: number;
  equippedCodes: string[];
  levels: Record<string, number>;
  sharedEquipment?: { equippedCodes: string[]; levels: Record<string, number> };
  selectedSlot: KqEquipmentSlot;
  onSelect: (tentNumber: number, slot: KqEquipmentSlot) => void;
  onShowList?: () => void;
  onExpand?: () => void;
  disabled?: boolean;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const positionedWarehouse = useRef<number | null>(null);
  const [overview, setOverview] = useState(true);
  const profiles = tents.length ? tents : [{ tentNumber: selectedTentNumber, equippedCodes, levels }];
  const roomCount = profiles.some(tent => tent.tentNumber > 4) ? 2 : 1;
  const selectedWarehouse = Math.floor((selectedTentNumber - 1) / 4);
  const selectedProfile = { tentNumber: selectedTentNumber, equippedCodes, levels };
  const sharedModels = new Map<KqEquipmentSlot, { code: string; level: number }>();
  for (const profile of profiles) for (const code of profile.equippedCodes) {
    const item = getKqEquipmentAtLevel(code, profile.levels[code]);
    if (item && SHARED_SLOTS.includes(item.slot) && (profile.levels[code] ?? 1) > (sharedModels.get(item.slot)?.level ?? 0)) {
      sharedModels.set(item.slot, { code, level: profile.levels[code] ?? 1 });
    }
  }
  const commonProfile = { tentNumber: selectedTentNumber, ...(sharedEquipment ?? {
    equippedCodes: [...sharedModels.values()].map(item => item.code),
    levels: Object.fromEntries([...sharedModels.values()].map(item => [item.code, item.level])),
  }) };

  useEffect(() => {
    if (positionedWarehouse.current === selectedWarehouse || !tents.length) return;
    const frame = requestAnimationFrame(() => {
      const element = viewport.current;
      const bay = element?.querySelector<HTMLElement>(`[data-warehouse-bay="${selectedWarehouse + 1}"]`);
      if (!element || !bay) return;
      element.scrollLeft += bay.getBoundingClientRect().left - element.getBoundingClientRect().left;
      positionedWarehouse.current = selectedWarehouse;
    });
    return () => cancelAnimationFrame(frame);
  }, [tents.length, selectedWarehouse]);

  const toggleZoom = () => {
    setOverview(value => !value);
    if (overview) requestAnimationFrame(() => {
      const element = viewport.current;
      const target = element?.querySelector<HTMLElement>(`[data-warehouse-slot="tent"][data-tent-number="${selectedTentNumber}"]`);
      if (!element || !target) return;
      const rect = target.getBoundingClientRect();
      element.scrollLeft += rect.left - element.getBoundingClientRect().left + rect.width / 2 - element.clientWidth / 2;
    });
  };

  const equipmentButton = (zone: WarehouseZone, profile: KqTentOverview, depth: number, tentLabel = false, shared = false) => {
    const code = profile.equippedCodes.find(item => getKqEquipmentAtLevel(item)?.slot === zone.slot);
    const installed = code ? getKqEquipmentAtLevel(code, profile.levels[code]) : null;
    const selected = profile.tentNumber === selectedTentNumber && selectedSlot === zone.slot;
    // Unowned equipment stays in the list/detail; only the selected vacant position is marked.
    if (!installed && !tentLabel && !selected) return null;
    const level = installed?.purchasable ? profile.levels[installed.code] ?? 1 : 1;
    const asset = artworkFor(zone.slot, code, level);
    const dimensions = assets[asset];
    return <button type="button" key={`${shared ? "shared" : profile.tentNumber}:${zone.slot}`}
      data-warehouse-slot={zone.slot} data-tent-number={shared ? undefined : profile.tentNumber} data-equipment-scope={shared ? "shared" : "tent"} data-warehouse-scope={shared ? "shared" : "tent"}
      data-installed={!!installed} data-selected={selected}
      data-tent-selected={tentLabel ? profile.tentNumber === selectedTentNumber : undefined}
      data-accessory={depth === 4 || undefined} data-support={zone.support ?? (depth === 7 ? "floor" : undefined)}
      disabled={disabled} className={styles.zone} style={positionFor(zone, asset, depth)} aria-pressed={selected}
      aria-label={`${shared ? "Atelier commun" : `Tente ${profile.tentNumber}`} · ${KQ_EQUIPMENT_SLOT_LABELS[zone.slot]} · ${installed ? `${installed.name}, ${installed.purchasable ? `niveau ${level}` : "fourni"}` : "emplacement libre"}`}
      onClick={() => onSelect(profile.tentNumber, zone.slot)}>
      {installed || tentLabel ? <Image src={`/placard/warehouse-v2/${asset}.webp`} alt=""
        width={dimensions.width} height={dimensions.height} sizes={tentLabel ? "(max-width: 600px) 90px, 200px" : "180px"}
        className={styles.sprite} draggable={false}/> : <span className={styles.vacant} aria-hidden="true"/>}
      {tentLabel ? <span className={styles.tentBadge}>Tente {profile.tentNumber}</span> : <span className={styles.label}>
        {KQ_EQUIPMENT_SLOT_LABELS[zone.slot]}<small>{installed ? (installed.purchasable ? `Niv. ${level}` : "Fourni") : "À aménager"}</small>
      </span>}
    </button>;
  };

  const tentEquipment = (profile: KqTentOverview, center: number) => {
    const tentCode = profile.equippedCodes.find(code => getKqEquipmentAtLevel(code)?.slot === "tent");
    const starter = !tentCode || tentCode.includes("STARTER");
    const height = starter ? 34 : 38;
    const tentAsset = assets[starter ? "tent-starter" : "tent-pro"];
    const width = height * tentAsset.width / tentAsset.height / 2;
    const top = TENT_BASELINE - height;
    const accessory = (slot: "lighting" | "air" | "climate-controller", widthRatio: number, offset: number, bottomRatio: number) => {
      const code = profile.equippedCodes.find(item => getKqEquipmentAtLevel(item)?.slot === slot);
      const asset = assets[artworkFor(slot, code, 1)];
      return equipmentButton({ slot, center: center + width * offset, bottom: top + height * bottomRatio,
        height: width * widthRatio * 2 * asset.height / asset.width }, profile, 4);
    };
    return <div key={profile.tentNumber} className={styles.tentGroup} data-warehouse-tent={profile.tentNumber}>
      {equipmentButton({ slot: "tent", center, bottom: TENT_BASELINE, height }, profile, 2, true)}
      {accessory("lighting", .5, -.07, .52)}
      {accessory("air", .22, .24, .11)}
      {accessory("climate-controller", .08, .37, .61)}
    </div>;
  };

  return <div className={styles.viewer}>
    <div className={styles.viewControls}>
      <span>{profiles.length} tente{profiles.length > 1 ? "s" : ""} · {roomCount} entrepôt{roomCount > 1 ? "s" : ""}</span>
      <div className={styles.viewActions}>
        {onShowList ? <button type="button" data-warehouse-view-toggle onClick={onShowList}><List size={15} aria-hidden="true"/>Vue liste</button> : null}
        <button type="button" onClick={toggleZoom} aria-pressed={!overview}>
          {overview ? <Maximize2 size={15} aria-hidden="true"/> : <Minimize2 size={15} aria-hidden="true"/>}
          {overview ? "Agrandir le décor" : "Vue d’ensemble"}
        </button>
      </div>
    </div>
    <div ref={viewport} className={styles.viewport} data-overview={overview} tabIndex={0} aria-label={roomCount > 1 ? "Panorama des deux entrepôts, défilement horizontal" : "Décor de l’entrepôt"}>
      <div className={styles.panorama} aria-label="Les emplacements de ton entrepôt">
        {Array.from({ length: roomCount }, (_, warehouse) => <section key={warehouse} className={styles.scene}
          data-warehouse-bay={warehouse + 1} aria-label={`Entrepôt ${warehouse + 1} · tentes ${warehouse * 4 + 1} à ${warehouse * 4 + 4}`}>
          <Image src="/placard/warehouse-v3/room.webp" alt="Entrepôt illustré, quatre places côte à côte au fond et un établi bas au premier plan"
            fill sizes="(max-width: 960px) 960px, 1150px" loading="eager" fetchPriority={warehouse === 0 ? "high" : "auto"} className={styles.background}/>
          <span className={styles.roomBadge}>Entrepôt {warehouse + 1}</span>
          {TENT_CENTERS.map((center, index) => {
            const number = warehouse * 4 + index + 1;
            const snapshot = profiles.find(tent => tent.tentNumber === number);
            if (!snapshot) return number === profiles.length + 1 && onExpand
              ? <button key={number} type="button" className={styles.addTent} style={{ left: `${center}%` }} onClick={onExpand} disabled={disabled} aria-label={`Ajouter la tente ${number} · voir le devis`}><span aria-hidden="true">+</span>Ajouter une tente</button>
              : <span key={number} className={styles.futureTent} style={{ left: `${center}%`, top: `${TENT_BASELINE + 2}%` }} aria-label={`Emplacement libre pour la tente ${number}`}><span>{String(number).padStart(2, "0")}</span></span>;
            return tentEquipment(number === selectedTentNumber ? selectedProfile : snapshot, center);
          })}
          {warehouse === 0 ? <div className={styles.workshop} data-warehouse-workshop data-equipment-scope="shared" data-warehouse-scope="shared">
            {WAREHOUSE_ZONES.filter(zone => SHARED_SLOTS.includes(zone.slot)).map(zone => equipmentButton(zone, commonProfile, 7, false, true))}
          </div> : null}
          {warehouse === selectedWarehouse ? <div className={styles.workshop} data-tent-services={selectedTentNumber}>
            {WAREHOUSE_ZONES.filter(zone => !SHARED_SLOTS.includes(zone.slot)).map(zone => equipmentButton(zone.slot === "security" && equippedCodes.includes("SECURITY-DOG")
              ? { ...zone, center: 84, bottom: 94, height: 15 } : zone, selectedProfile, zone.slot === "flower-drying" || zone.slot === "security" && !equippedCodes.includes("SECURITY-DOG") ? 4 : 7))}
          </div> : null}
          {warehouse === 0 ? <div className={styles.workshopCaption}><strong>Atelier commun</strong></div> : null}
        </section>)}
      </div>
    </div>
    {roomCount > 1 ? <p className={styles.panHint}>Les deux entrepôts sont côte à côte. Fais glisser le décor pour parcourir les tentes 1 à 8.</p> : null}
  </div>;
}
