"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { Check, ChevronLeft, ChevronRight, Pause, Play, TriangleAlert } from "lucide-react";
import type { ChanvrierAvatarProfile } from "@/lib/arena-chanvrier";
import type { KqWarehouseState } from "@/lib/kanab-quest-warehouse";
import { KqGrowRoomIsometric } from "./KqGrowRoomIsometric";
import type { KqGrowRoomWarehouseEditor } from "./KqGrowRoomWarehouseEditor";
import { GrowRoomActor } from "./KqGrowRoomActor";
import { GrowRoomBay, GrowRoomDefinitions, GrowRoomShell } from "./KqGrowRoomArt";
import { BAY_WIDTH, END_WALL, PAGE_SIZE, ROOM_HEIGHT, bayOrigin, roomEquipmentName, roomSectorKey, zoneStatus, type KqAffectedPlant, type KqGrowRoomEvent, type KqGrowRoomZone, type KqPbiTargeting } from "./KqGrowRoomModel";
import { useKqSceneMotion } from "./useKqSceneMotion";
import styles from "./KqGrowRoom.module.css";

export type { KqGrowRoomEvent, KqGrowRoomZone } from "./KqGrowRoomModel";
export type { KqGrowRoomWarehouseEditor } from "./KqGrowRoomWarehouseEditor";

export function KqGrowRoom({ zones, selectedZoneId, onSelectZone, playerProfile, event, plan, affectedPlants: reportedPlants, pbiTargeting, warehouseEditor }: {
  plan?: KqWarehouseState;
  zones: readonly KqGrowRoomZone[];
  selectedZoneId?: string | null;
  onSelectZone?: (id: string) => void;
  playerProfile?: ChanvrierAvatarProfile | null;
  event?: KqGrowRoomEvent | null;
  affectedPlants?: readonly KqAffectedPlant[];
  pbiTargeting?: KqPbiTargeting | null;
  warehouseEditor?: KqGrowRoomWarehouseEditor;
}) {
  const id = useId().replace(/[^a-z0-9_-]/gi,"");
  const [localSelection, setLocalSelection] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const { ref: sceneRef, motionEnabled, status, visible: sceneVisible, reducedMotion } = useKqSceneMotion<HTMLDivElement>(paused);
  const viewport = useRef<HTMLDivElement>(null);
  const affectedPlants = useMemo(() => {
    const pots = new Map<string, { plant: KqAffectedPlant; labels: Set<string> }>();
    for (const plant of reportedPlants ?? []) {
      const key = roomSectorKey(plant) + ":" + plant.slot;
      const pot = pots.get(key) ?? { plant, labels: new Set<string>() };
      if (plant.label) pot.labels.add(plant.label);
      pots.set(key, pot);
    }
    return Array.from(pots.values(), ({ plant, labels }) => ({ ...plant, label: [...labels].join(", ") }));
  }, [reportedPlants]);
  const selection = warehouseEditor ? warehouseEditor.selectedId : selectedZoneId ?? localSelection;
  const selectedIndex = zones.findIndex(zone => zone.id===selection);
  const selected = warehouseEditor ? selectedIndex : Math.max(0, selectedIndex);
  const zone = zones[selected];
  const start = plan ? Math.floor(selected/PAGE_SIZE)*PAGE_SIZE : selected;
  const visible = zones.slice(start,start+(plan ? PAGE_SIZE : 1));
  const left = 0;
  const width = Math.max(1,visible.length)*BAY_WIDTH+END_WALL;
  const focusAfterSelection = useRef(false);
  const select = (next: number) => {
    const item = zones[next];
    if (!item) return;
    setLocalSelection(item.id);
    onSelectZone?.(item.id);
  };
  useEffect(() => {
    const view = viewport.current;
    const button = view?.querySelector<HTMLButtonElement>('[data-grow-pick][aria-pressed="true"]');
    if (!view || !button) return;
    if (focusAfterSelection.current) { button.focus({preventScroll:true}); focusAfterSelection.current=false; }
    const scroller=button.closest<HTMLElement>('[data-grow-posts]')??view;
    const bounds = button.getBoundingClientRect(), frame = scroller.getBoundingClientRect();
    if (bounds.left < frame.left || bounds.right > frame.right) {
      scroller.scrollLeft += bounds.left-frame.left-(scroller.clientWidth-bounds.width)/2;
    }
  },[selected,start,zone?.id]);
  function onKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key==="ArrowRight" ? index+1 : event.key==="ArrowLeft" ? index-1 :
      event.key==="Home" ? 0 : event.key==="End" ? zones.length-1 : null;
    if (next===null || !zones[next]) return;
    event.preventDefault();
    focusAfterSelection.current=true;
    select(next);
  }
  const equipment = zone ? [...new Set([zone.deviceCode,zone.lightingCode,zone.airCode,zone.supportCode,...(zone.optionCodes??[])].filter((code): code is string => !!code))] : [];
  const effects = zone?.effects?.filter(Boolean) ?? [];
  const infoId = "grow-info-"+id;
  const showServiceStatus = !!warehouseEditor && warehouseEditor.managing === false && (zone?.kind === "drying" || zone?.kind === "storage");

  return <div ref={sceneRef} className={styles.room} style={{"--room-width":width,"--room-height":ROOM_HEIGHT,"--count":Math.max(1,visible.length)} as CSSProperties}
    data-grow-room="" data-grow-has-plan={!!plan} data-grow-motion={status} aria-label={warehouseEditor ? "Entrepôt" : "Salle de culture"}>
    {plan ? <div ref={viewport}><KqGrowRoomIsometric plan={plan} zones={zones} selected={zone?.id??null} onSelect={select}
      profile={playerProfile} event={event} motion={motionEnabled} visible={sceneVisible} staticCare={paused || reducedMotion} onKey={onKey}
      affectedPlants={affectedPlants} pbiTargeting={pbiTargeting} warehouseEditor={warehouseEditor} paused={paused}
      onTogglePause={warehouseEditor && !reducedMotion ? () => setPaused(value => !value) : undefined}/></div> : <>
    <p className={styles.legacyNote}>Tente isolée · le plan de cette culture n’a pas été enregistré.</p>
    <div ref={viewport} className={styles.viewport}>
      <div className={styles.camera}>
        <svg className={styles.scene} viewBox={`${left} 0 ${width} ${ROOM_HEIGHT}`} aria-hidden="true" focusable="false">
          <GrowRoomDefinitions id={id}/>
          <GrowRoomShell id={id} left={left} width={width} count={Math.max(1,visible.length)}/>
          {visible.map((item,i) => <GrowRoomBay key={item.id} zone={item} index={i} id={id} selected={selected===start+i}/>)}
          {zone && <GrowRoomActor index={0} stage={zone.stageIndex??null} event={event?.zoneId===zone.id?event:null} profile={playerProfile}
            motion={motionEnabled} visible={sceneVisible} width={width} left={left}/>}
        </svg>
        {visible.map((item,i) => {
          const index=start+i;
          return <button type="button" key={item.id} className={styles.pick} aria-pressed={selected===index}
            aria-label={item.name+" · "+zoneStatus(item)} aria-describedby={selected===index?infoId:undefined}
            onClick={()=>select(index)} onKeyDown={e=>onKey(e,index)} data-grow-pick={item.id}
            style={{left:((bayOrigin(i)+4)/width*100)+"%",width:(BAY_WIDTH-5)/width*100+"%"} as CSSProperties}>
            <span className={styles.sign}><b>{selected===index && <Check aria-hidden="true" strokeWidth={3}/>} {item.name}</b><small>{zoneStatus(item)}</small></span>
          </button>;
        })}
      </div>
    </div></>}
    {pbiTargeting && <SectorPicker targeting={pbiTargeting} zones={zones} affectedPlants={affectedPlants}/>}
    {(!warehouseEditor || !plan || showServiceStatus) && (zone ? <div className={styles.info} data-warehouse-service-status={showServiceStatus || undefined}>
      <div id={infoId} className={styles.status}><strong>{zone.name}</strong><span>{zoneStatus(zone)}{zone.variety ? " · "+zone.variety : ""}{typeof zone.areaM2==="number" ? " · "+zone.areaM2.toLocaleString("fr-FR")+" m²" : ""}</span></div>
      {!showServiceStatus && <div className={styles.tools}>
        {!plan && zones.length>1 && <div className={styles.travel}>
          <button type="button" aria-label="Zone précédente" disabled={selected===0} onClick={()=>select(selected-1)}><ChevronLeft size={16}/></button>
          {zones.length>PAGE_SIZE ? <select aria-label="Choisir une zone de culture" value={zone.id} onChange={e=>select(zones.findIndex(z=>z.id===e.target.value))}>{zones.map(z=><option key={z.id} value={z.id}>{z.name}</option>)}</select> : <span>{selected+1} / {zones.length}</span>}
          <button type="button" aria-label="Zone suivante" disabled={selected===zones.length-1} onClick={()=>select(selected+1)}><ChevronRight size={16}/></button>
        </div>}
        {!reducedMotion && <button type="button" aria-label={paused?"Reprendre l’animation de la salle":"Mettre l’animation de la salle en pause"} aria-pressed={paused} onClick={()=>setPaused(!paused)}>{paused?<Play size={15}/>:<Pause size={15}/>}</button>}
      </div>}
      {zone.attention && <p className={styles.attention}><TriangleAlert size={15} aria-hidden="true"/>{zone.attention}</p>}
      {!showServiceStatus && !!affectedPlants?.length && <details className={styles.details}>
        <summary><span className={styles.plantLegend} aria-hidden="true">×</span> {affectedPlants.length} {affectedPlants.length === 1 ? "plante atteinte" : "plantes atteintes"} dans la salle</summary>
        <ul>{affectedPlants.map(plant => <li key={roomSectorKey(plant) + ":" + plant.slot}>
          {zones.find(item => item.id === plant.zoneId)?.name ?? plant.zoneId} · case {plant.x + 1}, {plant.y + 1} · {["nord-ouest", "nord-est", "sud-ouest", "sud-est"][plant.slot]}{plant.label && " · " + plant.label}
        </li>)}</ul>
      </details>}
      {(equipment.length>0 || effects.length>0) && <details className={styles.details} key={zone.id}>
        <summary>{equipment.length && effects.length ? "Matériel et effets" : effects.length ? "Effets en cours" : "Matériel installé"}</summary>
        {equipment.length>0 && <ul aria-label="Matériel installé">{equipment.map(code=><li key={code}>{roomEquipmentName(code)}</li>)}</ul>}
        {effects.length>0 && <ul aria-label="Effets en cours">{effects.map((effect,i)=><li key={i}>{effect}</li>)}</ul>}
      </details>}
    </div> : <p className={styles.empty}>Aucune zone de culture aménagée.</p>)}
  </div>;
}

function SectorPicker({ targeting, zones, affectedPlants }: { targeting: KqPbiTargeting; zones: readonly KqGrowRoomZone[]; affectedPlants?: readonly KqAffectedPlant[] }) {
  const [choice, setChoice] = useState("");
  const sector = targeting.eligible.find(option => roomSectorKey(option) === choice);
  const counts = new Map<string, number>();
  for (const plant of affectedPlants ?? []) {
    const key = roomSectorKey(plant);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return <div className={styles.sectorPicker}>
    <label>Case à traiter
      <select value={sector ? choice : ""} onChange={e => setChoice(e.target.value)} disabled={targeting.busy || !targeting.eligible.length}>
        <option value="">Choisir une case</option>
        {targeting.eligible.map(cell => {
          const key = roomSectorKey(cell), count = counts.get(key) ?? 0;
          const name = zones.find(zone => zone.id === cell.zoneId)?.name ?? cell.zoneId;
          return <option key={key} value={key}>{name} · {cell.x + 1}, {cell.y + 1}{count > 0 ? " · " + count + (count === 1 ? " plante atteinte" : " plantes atteintes") : ""}</option>;
        })}
      </select>
    </label>
    <button type="button" className={styles.stationChoice} disabled={!sector || targeting.busy}
      onClick={() => { if (sector && !targeting.busy) targeting.onSelect(sector); }}>Traiter cette case</button>
  </div>;
}
