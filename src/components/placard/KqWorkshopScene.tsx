"use client";

import Image from "next/image";
import { ArrowRight, Check, Package, Plus, ShoppingBag, Wrench, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { KqEquipmentSlot } from "@/lib/kanab-quest-equipment";
import type { KqMachineCondition } from "@/lib/kanab-quest-maintenance";
import { getKqWorkshopMachineSpecification } from "@/lib/kanab-quest-workshop-machines";
import { getKqLabFootprint, getKqLabModel, getKqLabStationLayout, KQ_WORKSHOP_PLACEMENTS, KQ_WORKSHOP_ROOM } from "@/lib/kanab-quest-workshop-layout";
import styles from "./KqWorkshopScene.module.css";
import board from "./KqWarehousePilotage.module.css";

export function KqWorkshopScene({ purchasedCodes, equippedCodes, levels, maintenance = {}, selectedSlot, disabled = false, onSelect, onOpenShop }: {
  purchasedCodes: string[];
  equippedCodes: string[];
  levels: Record<string, number>;
  maintenance?: Record<string, KqMachineCondition>;
  selectedSlot?: KqEquipmentSlot;
  disabled?: boolean;
  onSelect: (slot: KqEquipmentSlot) => void;
  onOpenShop?: () => void;
}) {
  const [zoomed, setZoomed] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = viewport.current;
    if (element) {
      element.scrollLeft = zoomed ? (element.scrollWidth - element.clientWidth) / 2 : 0;
      element.scrollTop = zoomed ? (element.scrollHeight - element.clientHeight) / 2 : 0;
    }
  }, [zoomed]);
  const machines = KQ_WORKSHOP_PLACEMENTS.map((placement, index) => {
    const acquired = purchasedCodes.includes(placement.code);
    const installed = acquired && equippedCodes.includes(placement.code);
    const level = acquired ? levels[placement.code] ?? 1 : 0;
    const condition = acquired ? maintenance[placement.code] : undefined;
    const specification = getKqWorkshopMachineSpecification(placement.code, level || 1)!;
    const model = getKqLabModel(placement.code, level || 1)!;
    const state = !acquired ? "Emplacement libre" : condition?.due ? "À entretenir" : installed ? "Installée" : "En réserve";
    const action = !acquired ? "Comparer les gammes" : condition?.due ? "Entretenir" : installed ? "Gérer la machine" : "Installer";
    return { placement, number: index + 1, acquired, installed, level, condition, specification, model, state, action,
      label: `${placement.label} · ${specification.name} · ${state}${acquired ? ` · niveau ${level}` : ""} · ${action}` };
  });
  const owned = machines.filter(machine => machine.acquired);
  const due = owned.filter(machine => machine.condition?.due).length;
  const unknown = owned.filter(machine => !machine.condition).length;
  return <section className={styles.viewer} aria-label="Machines de l’atelier" data-workshop-scene>
    <dl className={styles.summary}>
      <div><dt>Acquises</dt><dd>{owned.length} / {machines.length}</dd></div>
      <div><dt>Installées</dt><dd>{owned.filter(machine => machine.installed).length}</dd></div>
      <div><dt>Places libres</dt><dd>{machines.length - owned.length}</dd></div>
    </dl>
    <div className={board.floor}>
      <div className={`${board.sceneFrame} ${styles.lab}`} data-workshop-lab>
        <div className={styles.viewport} ref={viewport} data-lab-viewport data-zoomed={zoomed} tabIndex={0} role="region" aria-label="Plan illustré du laboratoire, défilement avec les flèches en vue agrandie">
          <div className={styles.stage} data-lab-stage data-zoomed={zoomed}>
            <Image className={styles.room} src="/placard/lab-v2/room.webp" alt="" width={KQ_WORKSHOP_ROOM.imageWidth} height={KQ_WORKSHOP_ROOM.imageHeight} sizes={zoomed ? "1200px" : "(max-width: 680px) 100vw, 680px"} draggable={false} />
            <svg className={styles.footprints} viewBox={`0 0 ${KQ_WORKSHOP_ROOM.imageWidth} ${KQ_WORKSHOP_ROOM.imageHeight}`} aria-hidden="true">
              {machines.map(({ placement, acquired }) => <polygon key={placement.code} points={getKqLabFootprint(placement)}
                data-lab-empty={!acquired ? placement.code : undefined} data-free={!acquired} data-active={hovered === placement.code || selectedSlot === placement.slot} />)}
            </svg>
            {[...machines].sort((a, b) => a.placement.xM + a.placement.yM - b.placement.xM - b.placement.yM).map(machine => {
              const { placement, model, acquired, installed, state, number, condition, label } = machine;
              const layout = getKqLabStationLayout(placement, acquired ? model : null);
              const Icon = !acquired ? Plus : condition?.due ? Wrench : installed ? Check : Package;
              return <button type="button" key={placement.code} className={styles.station} style={layout.stage}
                data-lab-station={placement.code} data-owned={acquired} data-installed={installed}
                data-maintenance-due={condition?.due || undefined} aria-label={label} title={`${placement.label} · ${state}`}
                aria-haspopup="dialog" aria-expanded={selectedSlot === placement.slot} disabled={disabled}
                onPointerEnter={() => setHovered(placement.code)} onPointerLeave={() => setHovered(null)}
                onFocus={() => setHovered(placement.code)} onBlur={() => setHovered(null)}
                onClick={() => onSelect(placement.slot)}>
                {acquired ? <>
                  {model.support ? <span className={styles.support} style={layout.support} aria-hidden="true"><Image src="/placard/lab-v2/bench.webp" alt="" width={362} height={362} draggable={false} sizes="200px" /></span> : null}
                  <span className={styles.artwork} style={layout.body} data-workshop-artwork={placement.code} data-lab-sprite={placement.code} data-lab-model={model.sprite} aria-hidden="true">
                    <Image src={`/placard/lab-v2/${model.sprite}.webp`} alt="" width={362} height={362} draggable={false} sizes="(max-width: 600px) 220px, 480px" />
                  </span>
                </> : null}
                <span className={styles.marker} style={layout.marker} data-free={!acquired}><b>{number}</b><Icon size={12} aria-hidden="true" /></span>
              </button>;
            })}
          </div>
        </div>
        <div className={styles.sceneToolbar}>
          <p className={styles.legend}><span className={styles.freeKey} aria-hidden="true" />Place libre</p>
          <button type="button" onClick={() => setZoomed(value => !value)} aria-pressed={zoomed} disabled={disabled} data-lab-zoom>
            {zoomed ? <ZoomOut size={17} aria-hidden="true" /> : <ZoomIn size={17} aria-hidden="true" />}{zoomed ? "Vue d’ensemble" : "Agrandir"}
          </button>
          {zoomed && <p className={styles.zoomHint}>Fais défiler le plan avec le doigt ou les flèches du clavier.</p>}
        </div>
      </div>
      <aside className={`${board.context} ${board.contextSection}`} aria-label="Postes de travail">
        <h3>Postes de travail</h3>
        {(due > 0 || unknown > 0) && <p className={styles.note}>{due > 0 ? `${due} machine${due > 1 ? "s" : ""} à entretenir. ` : ""}{unknown > 0 ? `Usure à vérifier pour ${unknown} machine${unknown > 1 ? "s" : ""}.` : ""}</p>}
        {onOpenShop && <button type="button" className={board.control} data-primary disabled={disabled} onClick={onOpenShop}>
          <ShoppingBag size={16} aria-hidden="true" />Matériel de l’atelier commun
        </button>}
        <ul className={styles.machines} aria-label="Accès aux six postes du labo">
          {machines.map(({ placement, number, acquired, installed, level, specification, condition, state, action, label }) => {
            const Icon = !acquired ? Plus : condition?.due ? Wrench : installed ? Check : Package;
            return <li key={placement.code}>
              <button type="button" className={styles.machine} data-workshop-machine={placement.code} data-warehouse-slot={placement.slot}
                data-owned={acquired} data-installed={installed} data-level={level} data-maintenance-due={condition?.due || undefined}
                aria-haspopup="dialog" aria-expanded={selectedSlot === placement.slot} disabled={disabled} aria-label={label}
                onPointerEnter={() => setHovered(placement.code)} onPointerLeave={() => setHovered(null)}
                onFocus={() => setHovered(placement.code)} onBlur={() => setHovered(null)}
                onClick={() => onSelect(placement.slot)}>
                <span className={styles.number} aria-hidden="true">{number}</span>
                <span className={styles.identity}><strong>{placement.label}</strong><span data-workshop-machine-state><Icon size={13} aria-hidden="true" />{state}</span>
                  <small>{acquired ? `${specification.tier.label} · niv. ${level}` : "Choisir une gamme"}</small></span>
                <ArrowRight size={17} aria-hidden="true" /><span className={styles.srOnly}>{action}</span>
              </button>
            </li>;
          })}
        </ul>
      </aside>
    </div>
  </section>;
}
