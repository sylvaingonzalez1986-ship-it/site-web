"use client";

import { ArrowDown, ArrowUp, Check, CircleAlert, PackageOpen, RefreshCw, Settings2, ShieldCheck, ShoppingBag, Sprout, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { formatKqCash, getKqEquipmentAtLevel, getKqEquipmentImpactLabels, getKqEquipmentRequirementState, KQ_EQUIPMENT_CATALOG, KQ_EQUIPMENT_SLOT_LABELS, summarizeKqEquipmentLoadout, type KqEquipmentDefinition, type KqEquipmentSlot } from "@/lib/kanab-quest-equipment";
import { getKqProductionExpansion, getKqProductionUnits } from "@/lib/kanab-quest-production";
import { KqProductionCapacity, type KqProductionSnapshot } from "./KqProductionCapacity";
import { quoteKqEnergy } from "@/lib/kanab-quest-energy";
import { getKqCultureOperationalCodes, type KqCultureEquipmentCondition } from "@/lib/kanab-quest-culture-wear";
import { KqEquipmentUpgrade } from "./KqEquipmentUpgrade";
import { KqMachineMaintenance } from "./KqMachineMaintenance";
import { KqCultureEquipmentWear } from "./KqCultureEquipmentWear";
import type { KqMachineCondition } from "@/lib/kanab-quest-maintenance";
import { KqWarehouseScene, WAREHOUSE_ZONES } from "./KqWarehouseScene";
import styles from "./KqWarehouseInventory.module.css";

const WAREHOUSE_GROUPS: readonly { code: string; label: string; description: string; slots: readonly KqEquipmentSlot[]; icon: typeof Sprout }[] = [
  { code: "grow", label: "Cultiver", description: "La box et son environnement", slots: ["tent", "lighting", "air", "climate-controller"], icon: Sprout },
  { code: "process", label: "Transformer", description: "Tes postes de transformation", slots: ["sifting", "washing", "filtration", "static-separation", "press", "drying"], icon: Settings2 },
  { code: "services", label: "Services", description: "Les essentiels de l’atelier", slots: ["flower-drying", "energy", "security"], icon: ShieldCheck },
];

export function KqEquipmentInventoryModal({ownedCodes,purchasedCodes,equippedCodes,levels,cashCents,productionUnits=1,production,maintenance={},cultureWear={},activeRun=false,loading,loadError,onClose,onOpenShop,onRetry,initialSlot="tent"}:{
  productionUnits?:number;
  production?:KqProductionSnapshot;
  maintenance?:Record<string,KqMachineCondition>;
  cultureWear?:Record<string,KqCultureEquipmentCondition>;
  activeRun?:boolean;
  ownedCodes:string[];purchasedCodes:string[];equippedCodes:string[];levels:Record<string,number>;cashCents:number;loading:boolean;loadError:string;
  onClose:()=>void;onOpenShop:(equipmentCode?:string)=>void;onRetry:()=>void;
  initialSlot?:KqEquipmentSlot;
}) {
  const closeButton=useRef<HTMLButtonElement>(null);
  const panel=useRef<HTMLElement>(null);
  const workshop=useRef<HTMLDivElement>(null);
  const lock=useRef(false);
  const [slot,setSlot]=useState<KqEquipmentSlot>(initialSlot);
  const [pending,setPending]=useState<string|null>(null);
  const [override,setOverride]=useState<string[]|null>(null);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const units=getKqProductionUnits(productionUnits);
  const expansion=production??getKqProductionExpansion(units,purchasedCodes,levels);
  const activeCodes=override??equippedCodes;
  const operationalCodes=useMemo(()=>getKqCultureOperationalCodes(activeCodes,cultureWear),[activeCodes,cultureWear]);
  const summary=useMemo(()=>summarizeKqEquipmentLoadout(operationalCodes,levels),[operationalCodes,levels]);
  const energy=useMemo(()=>quoteKqEnergy(operationalCodes,levels,"balanced",units),[operationalCodes,levels,units]);
  const equipment=useMemo(()=>[...new Set([...ownedCodes,...activeCodes])].map(code=>getKqEquipmentAtLevel(code,levels[code])).filter((item):item is KqEquipmentDefinition=>!!item),[ownedCodes,activeCodes,levels]);
  const choices=equipment.filter(item=>item.slot===slot);
  const installed=choices.find(item=>activeCodes.includes(item.code));
  const suggestion=KQ_EQUIPMENT_CATALOG.find(item=>item.slot===slot&&item.purchasable&&!ownedCodes.includes(item.code));
  const installedSlots=new Set(equipment.filter(item=>activeCodes.includes(item.code)).map(item=>item.slot));
  const selectedGroup=WAREHOUSE_GROUPS.find(group=>group.slots.includes(slot))??WAREHOUSE_GROUPS[0];
  const groupZones=selectedGroup.slots.map(groupSlot=>WAREHOUSE_ZONES.find(zone=>zone.slot===groupSlot)).filter(zone=>!!zone);
  useBodyScrollLock(true);
  useEffect(()=>{const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;closeButton.current?.focus({preventScroll:true});return()=>{if(previous?.isConnected)previous.focus({preventScroll:true});};},[]);
  useEffect(()=>{
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"&&!event.defaultPrevented)onClose();};
    document.addEventListener("keydown",escape);return()=>document.removeEventListener("keydown",escape);
  },[onClose]);
  const select=(next:KqEquipmentSlot)=>{setSlot(next);setError("");};
  const scrollToSection=(target:HTMLElement|null)=>{target?.scrollIntoView({block:"start",behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});target?.focus({preventScroll:true});};
  const showDetails=()=>scrollToSection(panel.current);
  const showWorkshop=()=>scrollToSection(workshop.current);
  const openShop=(code?:string)=>{onClose();onOpenShop(code);};
  const equip=async(item:KqEquipmentDefinition)=>{
    if(lock.current||loading||activeCodes.includes(item.code)||!purchasedCodes.includes(item.code)||cultureWear[item.code]?.due)return;
    lock.current=true;setPending(item.code);setError("");setNotice("");
    try {
      const response=await fetch("/api/arena/placard/equipment",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({equipmentCode:item.code})});
      const body=await response.json();if(!response.ok)throw new Error(body.error||"Installation impossible.");
      setOverride([...activeCodes.filter(code=>getKqEquipmentAtLevel(code)?.slot!==item.slot),item.code]);
      setNotice(`${item.name} installé. Ses bonus seront pris en compte à la prochaine culture.`);
      window.dispatchEvent(new Event("kq:equipment-updated"));
    } catch(reason){setError(reason instanceof Error?reason.message:"Installation impossible.");}
    finally{lock.current=false;setPending(null);}
  };
  return <div className={styles.overlay}>
    <button type="button" tabIndex={-1} className={styles.backdrop} onClick={onClose} aria-label="Fermer l’entrepôt"/>
    <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="equipment-inventory-title" data-arena-tour-surface="warehouse" onKeyDown={event=>{
      if(event.key==="Escape"){event.preventDefault();event.stopPropagation();onClose();return;}
      if(event.key!=="Tab")return;
      const controls=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,select,summary,[tabindex="0"]')).filter(el=>el.getClientRects().length>0);
      if(event.shiftKey&&document.activeElement===controls[0]){event.preventDefault();controls.at(-1)?.focus();}
      else if(!event.shiftKey&&document.activeElement===controls.at(-1)){event.preventDefault();controls[0]?.focus();}
    }}>
      <header className={styles.header}>
        <div><small>Le Placard · ton atelier</small><h2 id="equipment-inventory-title" data-arena-tour="warehouse">Mon entrepôt</h2><p>Explore ton atelier et choisis un emplacement pour l’aménager.</p></div>
        <div className={styles.balance}><small>Trésorerie</small><strong>{formatKqCash(cashCents)}</strong></div><button ref={closeButton} type="button" onClick={onClose} aria-label="Fermer l’inventaire"><X/></button>
      </header>
      <div className={styles.layout}>
        <div ref={workshop} className={styles.workshop} tabIndex={-1} aria-label="Explorer l’entrepôt">
          <nav className={styles.groups} aria-label="Activités de l’entrepôt">
            {WAREHOUSE_GROUPS.map(group=>{const Icon=group.icon;return <button key={group.code} type="button" aria-pressed={selectedGroup.code===group.code} onClick={()=>select(group.slots.includes(slot)?slot:group.slots[0])}>
              <Icon size={19} aria-hidden="true"/><span><strong>{group.label}</strong><small>{group.slots.filter(groupSlot=>installedSlots.has(groupSlot)).length}/{group.slots.length} installés</small></span>
            </button>;})}
          </nav>
          <KqWarehouseScene equippedCodes={activeCodes} levels={levels} selectedSlot={slot} onSelect={select} disabled={loading||!!loadError||!!pending}/>
          <p className={styles.panHint}>En vue agrandie, fais glisser le décor pour explorer chaque poste.</p>
          <div className={styles.navigation}>
            <div className={styles.groupHeading}><strong>{selectedGroup.label}</strong><span>{selectedGroup.description}</span></div>
            <nav className={styles.slots} aria-label="Emplacements de l’entrepôt">{groupZones.map(zone=><button key={zone.slot} type="button" aria-pressed={slot===zone.slot} data-installed={installedSlots.has(zone.slot)} onClick={()=>select(zone.slot)}><span>{KQ_EQUIPMENT_SLOT_LABELS[zone.slot]}</span><small>{installedSlots.has(zone.slot)?<><Check size={12} aria-hidden="true"/>Installé</>:"Libre"}</small></button>)}</nav>
            <div className={styles.selectionSummary}><div><small>Ta sélection</small><strong>{KQ_EQUIPMENT_SLOT_LABELS[slot]}</strong><span>{installed?.name??"Emplacement libre"}</span></div><button type="button" onClick={showDetails}>Voir le détail<ArrowDown size={16} aria-hidden="true"/></button></div>
          </div>
          <div className={styles.performance}><h3>Ton installation en un coup d’œil</h3><dl className={styles.stats}><div><dt>Récolte ×{units}</dt><dd>+{summary.quantityPercent} %</dd></div><div><dt>Qualité max.</dt><dd>+{summary.qualityMaxBonus}</dd></div><div><dt>Régularité</dt><dd>+{summary.regularityPercent} %</dd></div><div><dt>Électricité / cycle</dt><dd>{formatKqCash(energy.totalCents)}</dd></div></dl>
          <small className={styles.estimate}>Estimation en mode équilibré, hors usure, nourriture et vétérinaire. Les bonus du matériel hors service sont désactivés ; le kit de départ prend le relais aux emplacements concernés. L’installation est fixée au lancement de chaque culture.</small></div>
          <KqProductionCapacity tentArtwork={activeCodes.includes("TENT-080-STARTER")?"tent-starter":"tent-pro"} production={expansion} cashCents={cashCents} activeRun={activeRun} disabled={loading||!!loadError||!!pending} onUpdated={onRetry} onPendingChange={busy=>setPending(busy?"production":null)}/>
        </div>
        <aside ref={panel} className={styles.panel} tabIndex={-1} aria-labelledby="warehouse-slot-title">
          <button type="button" className={styles.backToScene} onClick={showWorkshop}><ArrowUp size={16} aria-hidden="true"/>Retour à l’entrepôt</button>
          <div className={styles.panelHeading}><small>{selectedGroup.label} · emplacement sélectionné</small><span data-installed={!!installed}>{installed?<><Check size={12} aria-hidden="true"/>Installé</>:"Libre"}</span></div><h3 id="warehouse-slot-title">{KQ_EQUIPMENT_SLOT_LABELS[slot]}</h3>
          {slot==="flower-drying"?<p>Ta pièce dédiée aux fleurs récoltées. Chaque niveau renforce la régularité ; la qualité maximale augmente aux niveaux 4, 7 et 10. Le résultat dépend aussi de tes réussites en culture.</p>:<p>{installed?`${installed.name} est en place.`:"Choisis un équipement acheté pour aménager cet emplacement."}</p>}
          <div aria-live="polite">{error||loadError?<p role="alert" className={styles.error}><CircleAlert size={16}/>{error||loadError}</p>:null}{notice?<p role="status" className={styles.notice}><Check size={16}/>{notice}</p>:null}</div>
          {loading?<p role="status">Actualisation de l’atelier…</p>:loadError?<button type="button" onClick={onRetry}><RefreshCw size={16}/>Réessayer</button>:<>
            {choices.map(item=>{const isInstalled=activeCodes.includes(item.code),requirement=getKqEquipmentRequirementState({equipment:item,ownedCodes});return <article key={item.code} className={styles.item} data-installed={isInstalled}>
              <span>{cultureWear[item.code]?.due?"Hors service":isInstalled?"Installé":item.purchasable?"En réserve":"Fourni"}{item.purchasable?` · niveau ${levels[item.code]??1}`:""}</span><h4>{item.name}</h4>
              <ul>{getKqEquipmentImpactLabels(item).map(label=><li key={label}>{label}</li>)}</ul><small>{item.category === "security" ? "Par tente : " : ""}{item.tradeoff}{item.category === "security" && units > 1 ? ` Consommation et frais ×${units} pour toute ton installation.` : ""}</small>
              {!isInstalled&&installed?<p>Remplace {installed.name}, qui reste en réserve.</p>:null}
              {!requirement.compatible?<p className={styles.error}>Prérequis : {requirement.missing.map(r=>r.label).join(", ")}</p>:null}
              <button type="button" disabled={isInstalled||!purchasedCodes.includes(item.code)||!requirement.compatible||!!pending||loading||cultureWear[item.code]?.due} onClick={()=>void equip(item)}>{pending===item.code?"Installation…":cultureWear[item.code]?.due?"À remplacer avant installation":isInstalled?"Déjà installé":"Installer ici"}</button>
              {cultureWear[item.code]?<KqCultureEquipmentWear code={item.code} name={item.name} condition={cultureWear[item.code]} cashCents={cashCents} activeRun={activeRun} disabled={!!pending||loading} onUpdated={onRetry}/>:null}
              {item.purchasable&&purchasedCodes.includes(item.code)?<KqEquipmentUpgrade code={item.code} level={levels[item.code]??1} cashCents={cashCents} productionUnits={units} disabled={!!pending||loading||cultureWear[item.code]?.due} onUpdated={onRetry}/>:null}
              {maintenance[item.code]?<KqMachineMaintenance code={item.code} condition={maintenance[item.code]} cashCents={cashCents} disabled={!!pending||loading} onUpdated={onRetry}/>:null}
            </article>;})}
            {!choices.length?<p className={styles.empty}><PackageOpen/>Cet emplacement est prêt à accueillir ton matériel.</p>:null}
            {suggestion?<button type="button" className={styles.shopButton} onClick={()=>openShop(suggestion.code)}><ShoppingBag size={17}/>{slot==="flower-drying"?`Aménager le séchoir · ${formatKqCash(suggestion.priceCents*units)}`:"Voir le matériel en boutique"}</button>:null}
          </>}
          <small className={styles.rule}>Acheter, installer, puis améliorer. Un modèle actif par emplacement, partagé entre tes {units} tente{units>1?"s":""} ; aucun changement sur les cultures déjà lancées.</small>
        </aside>
      </div>
    </section>
  </div>;
}
