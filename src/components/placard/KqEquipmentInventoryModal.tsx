"use client";

import { Check, CircleAlert, PackageOpen, RefreshCw, ShoppingBag, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { formatKqCash, getKqEquipmentAtLevel, getKqEquipmentImpactLabels, getKqEquipmentRequirementState, KQ_EQUIPMENT_CATALOG, KQ_EQUIPMENT_SLOT_LABELS, summarizeKqEquipmentLoadout, type KqEquipmentDefinition, type KqEquipmentSlot } from "@/lib/kanab-quest-equipment";
import { quoteKqEnergy } from "@/lib/kanab-quest-energy";
import { KqEquipmentUpgrade } from "./KqEquipmentUpgrade";
import { KqMachineMaintenance } from "./KqMachineMaintenance";
import type { KqMachineCondition } from "@/lib/kanab-quest-maintenance";
import { KqWarehouseScene, WAREHOUSE_ZONES } from "./KqWarehouseScene";
import styles from "./KqWarehouseInventory.module.css";

export function KqEquipmentInventoryModal({ownedCodes,purchasedCodes,equippedCodes,levels,cashCents,maintenance={},loading,loadError,onClose,onOpenShop,onRetry,initialSlot="tent"}:{
  maintenance?:Record<string,KqMachineCondition>;
  ownedCodes:string[];purchasedCodes:string[];equippedCodes:string[];levels:Record<string,number>;cashCents:number;loading:boolean;loadError:string;
  onClose:()=>void;onOpenShop:(equipmentCode?:string)=>void;onRetry:()=>void;
  initialSlot?:KqEquipmentSlot;
}) {
  const closeButton=useRef<HTMLButtonElement>(null);
  const panel=useRef<HTMLElement>(null);
  const lock=useRef(false);
  const [slot,setSlot]=useState<KqEquipmentSlot>(initialSlot);
  const [pending,setPending]=useState<string|null>(null);
  const [override,setOverride]=useState<string[]|null>(null);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const activeCodes=override??equippedCodes;
  const summary=useMemo(()=>summarizeKqEquipmentLoadout(activeCodes,levels),[activeCodes,levels]);
  const energy=useMemo(()=>quoteKqEnergy(activeCodes,levels),[activeCodes,levels]);
  const equipment=useMemo(()=>[...new Set([...ownedCodes,...activeCodes])].map(code=>getKqEquipmentAtLevel(code,levels[code])).filter((item):item is KqEquipmentDefinition=>!!item),[ownedCodes,activeCodes,levels]);
  const choices=equipment.filter(item=>item.slot===slot);
  const installed=choices.find(item=>activeCodes.includes(item.code));
  const suggestion=KQ_EQUIPMENT_CATALOG.find(item=>item.slot===slot&&item.purchasable&&!ownedCodes.includes(item.code));
  useBodyScrollLock(true);
  useEffect(()=>{const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;closeButton.current?.focus({preventScroll:true});return()=>{if(previous?.isConnected)previous.focus({preventScroll:true});};},[]);
  useEffect(()=>{
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"&&!event.defaultPrevented)onClose();};
    document.addEventListener("keydown",escape);return()=>document.removeEventListener("keydown",escape);
  },[onClose]);
  const select=(next:KqEquipmentSlot)=>{setSlot(next);setError("");if(innerWidth<900)requestAnimationFrame(()=>panel.current?.scrollIntoView({block:"nearest",behavior:"instant"}));};
  const openShop=(code?:string)=>{onClose();onOpenShop(code);};
  const equip=async(item:KqEquipmentDefinition)=>{
    if(lock.current||loading||activeCodes.includes(item.code)||!purchasedCodes.includes(item.code))return;
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
      const controls=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,select,[tabindex="0"]')).filter(el=>el.getClientRects().length>0);
      if(event.shiftKey&&document.activeElement===controls[0]){event.preventDefault();controls.at(-1)?.focus();}
      else if(!event.shiftKey&&document.activeElement===controls.at(-1)){event.preventDefault();controls[0]?.focus();}
    }}>
      <header className={styles.header}>
        <div><small>Le Placard · ton atelier</small><h2 id="equipment-inventory-title" data-arena-tour="warehouse">Mon entrepôt</h2><p>Clique sur la box ou un emplacement pour installer ton matériel.</p></div>
        <strong>{formatKqCash(cashCents)}</strong><button ref={closeButton} type="button" onClick={onClose} aria-label="Fermer l’inventaire"><X/></button>
      </header>
      <div className={styles.layout}>
        <div className={styles.workshop}>
          <KqWarehouseScene equippedCodes={activeCodes} levels={levels} selectedSlot={slot} onSelect={select} disabled={loading||!!loadError||!!pending}/>
          <p className={styles.panHint}>Sur petit écran, fais glisser le décor pour explorer l’entrepôt.</p>
          <nav className={styles.slots} aria-label="Emplacements de l’entrepôt">{WAREHOUSE_ZONES.map(zone=><button key={zone.slot} type="button" aria-pressed={slot===zone.slot} onClick={()=>select(zone.slot)}>{KQ_EQUIPMENT_SLOT_LABELS[zone.slot]}</button>)}</nav>
          <dl className={styles.stats}><div><dt>Quantité</dt><dd>+{summary.quantityPercent} %</dd></div><div><dt>Qualité max.</dt><dd>+{summary.qualityMaxBonus}</dd></div><div><dt>Régularité</dt><dd>+{summary.regularityPercent} %</dd></div><div><dt>Électricité / cycle</dt><dd>{formatKqCash(energy.totalCents)}</dd></div></dl>
          <small className={styles.estimate}>Estimation en mode équilibré, hors nourriture et vétérinaire. L’installation est fixée au lancement de chaque culture.</small>
        </div>
        <aside ref={panel} className={styles.panel} aria-labelledby="warehouse-slot-title">
          <small>Emplacement sélectionné</small><h3 id="warehouse-slot-title">{KQ_EQUIPMENT_SLOT_LABELS[slot]}</h3>
          {slot==="flower-drying"?<p>Ta pièce dédiée aux fleurs récoltées. Chaque niveau renforce la régularité ; la qualité maximale augmente aux niveaux 4, 7 et 10. Le résultat dépend aussi de tes réussites en culture.</p>:<p>{installed?`${installed.name} est en place.`:"Choisis un équipement acheté pour aménager cet emplacement."}</p>}
          <div aria-live="polite">{error||loadError?<p role="alert" className={styles.error}><CircleAlert size={16}/>{error||loadError}</p>:null}{notice?<p role="status" className={styles.notice}><Check size={16}/>{notice}</p>:null}</div>
          {loading?<p role="status">Actualisation de l’atelier…</p>:loadError?<button type="button" onClick={onRetry}><RefreshCw size={16}/>Réessayer</button>:<>
            {choices.map(item=>{const isInstalled=activeCodes.includes(item.code),requirement=getKqEquipmentRequirementState({equipment:item,ownedCodes});return <article key={item.code} className={styles.item} data-installed={isInstalled}>
              <span>{isInstalled?"Installé":item.purchasable?"En réserve":"Fourni"}{item.purchasable?` · niveau ${levels[item.code]??1}`:""}</span><h4>{item.name}</h4>
              <ul>{getKqEquipmentImpactLabels(item).map(label=><li key={label}>{label}</li>)}</ul><small>{item.tradeoff}</small>
              {!isInstalled&&installed?<p>Remplace {installed.name}, qui reste en réserve.</p>:null}
              {!requirement.compatible?<p className={styles.error}>Prérequis : {requirement.missing.map(r=>r.label).join(", ")}</p>:null}
              <button type="button" disabled={isInstalled||!purchasedCodes.includes(item.code)||!requirement.compatible||!!pending||loading} onClick={()=>void equip(item)}>{pending===item.code?"Installation…":isInstalled?"Déjà installé":"Installer ici"}</button>
              {item.purchasable&&purchasedCodes.includes(item.code)?<KqEquipmentUpgrade code={item.code} level={levels[item.code]??1} cashCents={cashCents} disabled={!!pending||loading} onUpdated={onRetry}/>:null}
              {maintenance[item.code]?<KqMachineMaintenance code={item.code} condition={maintenance[item.code]} cashCents={cashCents} disabled={!!pending||loading} onUpdated={onRetry}/>:null}
            </article>;})}
            {!choices.length?<p className={styles.empty}><PackageOpen/>Cet emplacement est prêt à accueillir ton matériel.</p>:null}
            {suggestion?<button type="button" className={styles.shopButton} onClick={()=>openShop(suggestion.code)}><ShoppingBag size={17}/>{slot==="flower-drying"?`Aménager le séchoir · ${formatKqCash(suggestion.priceCents)}`:"Voir le matériel en boutique"}</button>:null}
          </>}
          <small className={styles.rule}>Acheter, installer, puis améliorer. Un seul équipement actif par emplacement ; aucun changement sur les cultures déjà lancées.</small>
        </aside>
      </div>
    </section>
  </div>;
}
