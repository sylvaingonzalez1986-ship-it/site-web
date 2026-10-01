"use client";

import { ArrowUp, Check, ChevronDown, CircleAlert, ImageIcon, PackageOpen, RefreshCw, ShoppingBag, X, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { formatKqCash, getKqEquipmentAtLevel, getKqEquipmentImpactLabels, getKqEquipmentRequirementState, isKqSharedEquipment, isKqSharedEquipmentSlot, KQ_EQUIPMENT_CATALOG, KQ_EQUIPMENT_SLOT_LABELS, summarizeKqEquipmentLoadout, type KqEquipmentDefinition, type KqEquipmentSlot } from "@/lib/kanab-quest-equipment";
import { getKqProductionExpansion, getKqProductionUnits } from "@/lib/kanab-quest-production";
import { KqTentSelector, type KqTentOverview, type KqSharedEquipmentOverview } from "./KqTentSelector";
import { KqProductionCapacity, type KqProductionSnapshot } from "./KqProductionCapacity";
import { quoteKqEnergy } from "@/lib/kanab-quest-energy";
import { getKqCultureOperationalCodes, type KqCultureEquipmentCondition } from "@/lib/kanab-quest-culture-wear";
import { KqEquipmentUpgrade } from "./KqEquipmentUpgrade";
import { KqMachineMaintenance } from "./KqMachineMaintenance";
import { KqCultureEquipmentWear } from "./KqCultureEquipmentWear";
import { KqEnergyPanel } from "./KqEnergyPanel";
import type { KqMachineCondition } from "@/lib/kanab-quest-maintenance";
import { KqWarehouseScene } from "./KqWarehouseScene";
import { KqWarehouseOverview } from "./KqWarehouseOverview";
import styles from "./KqWarehouseInventory.module.css";

const WAREHOUSE_GROUPS: readonly { code: string; label: string; slots: readonly KqEquipmentSlot[] }[] = [
  { code: "grow", label: "Cultiver", slots: ["tent", "lighting", "air", "climate-controller"] },
  { code: "process", label: "Atelier commun · Transformer", slots: ["sifting", "washing", "filtration", "static-separation", "press", "drying"] },
  { code: "services", label: "Services", slots: ["flower-drying", "energy", "security"] },
];

type TentUiState = {
  slot: KqEquipmentSlot;
  selectedCode: string | null;
  pending: string | null;
  override: { baseCodes: string[]; codes: string[] } | null;
  error: string;
  notice: string;
};
const EMPTY_TENT_UI: TentUiState = { slot: "tent", selectedCode: null, pending: null, override: null, error: "", notice: "" };

export function KqEquipmentInventoryModal({ownedCodes,purchasedCodes,equippedCodes,levels,cashCents,productionUnits=1,tentNumber=1,tents=[],sharedEquipment,onSelectTent,production,maintenance={},cultureWear={},activeRun=false,loading,loadError,onClose,onOpenShop,onRetry,initialSlot="tent"}:{
  productionUnits?:number;
  tentNumber?:number;
  tents?:KqTentOverview[];
  sharedEquipment?:KqSharedEquipmentOverview;
  onSelectTent?:(tentNumber:number)=>void;
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
  const management=useRef<HTMLDivElement>(null);
  const viewChanged=useRef(false);
  const locks=useRef(new Set<number>());
  const [tentStates,setTentStates]=useState<Record<number,TentUiState>>(()=>({[tentNumber]:{...EMPTY_TENT_UI,slot:initialSlot}}));
  const [requestedSlot,setRequestedSlot]=useState(initialSlot);
  const [listView,setListView]=useState(false);
  const [chargesOpen,setChargesOpen]=useState(false);
  const [productionPending,setProductionPending]=useState(false);
  if(requestedSlot!==initialSlot){
    setRequestedSlot(initialSlot);
    setTentStates(current=>({...current,[tentNumber]:{...(current[tentNumber]??EMPTY_TENT_UI),slot:initialSlot,selectedCode:null,error:""}}));
  }
  const tentState=tentStates[tentNumber]??{...EMPTY_TENT_UI,slot:initialSlot};
  const {slot,selectedCode}=tentState;
  const sharedSlot=isKqSharedEquipmentSlot(slot);
  const operationState=sharedSlot?(tentStates[0]??EMPTY_TENT_UI):tentState;
  const {pending,error,notice}=operationState;
  const busy=productionPending||!!pending;
  const updateTent=(number:number,patch:Partial<TentUiState>)=>setTentStates(current=>({...current,[number]:{...(current[number]??{...EMPTY_TENT_UI,slot:initialSlot}),...patch}}));
  const units=getKqProductionUnits(productionUnits);
  const expansion=production??getKqProductionExpansion(units,purchasedCodes,levels);
  const tentCodes=tentState.override?.baseCodes===equippedCodes?tentState.override.codes:equippedCodes;
  const sharedSource=useMemo(()=>sharedEquipment?.equippedCodes??equippedCodes.filter(isKqSharedEquipment),[sharedEquipment,equippedCodes]);
  const sharedOverride=tentStates[0]?.override;
  const sharedCodes=sharedOverride?.baseCodes===sharedSource?sharedOverride.codes:sharedSource;
  const activeCodes=useMemo(()=>[...tentCodes.filter(code=>!isKqSharedEquipment(code)),...sharedCodes],[tentCodes,sharedCodes]);
  const sceneTents=(tents.length?tents:[{tentNumber,ownedCodes,purchasedCodes,equippedCodes,levels,cultureWear}]).map(tent=>{
    const override=tentStates[tent.tentNumber]?.override;
    return override?.baseCodes===tent.equippedCodes?{...tent,equippedCodes:override.codes}:tent;
  });
  const operationalCodes=useMemo(()=>getKqCultureOperationalCodes(activeCodes,cultureWear),[activeCodes,cultureWear]);
  const summary=useMemo(()=>summarizeKqEquipmentLoadout(operationalCodes,levels),[operationalCodes,levels]);
  const energy=useMemo(()=>quoteKqEnergy(operationalCodes,levels,"balanced",1),[operationalCodes,levels]);
  const equipment=useMemo(()=>[...new Set([...ownedCodes,...activeCodes])].map(code=>getKqEquipmentAtLevel(code,levels[code])).filter((item):item is KqEquipmentDefinition=>!!item),[ownedCodes,activeCodes,levels]);
  const choices=equipment.filter(item=>item.slot===slot);
  const installed=choices.find(item=>activeCodes.includes(item.code));
  const selectedEquipment=choices.find(item=>item.code===selectedCode)??installed??choices[0];
  const suggestion=KQ_EQUIPMENT_CATALOG.find(item=>item.slot===slot&&item.purchasable&&!ownedCodes.includes(item.code));
  const installedSlots=new Set(equipment.filter(item=>activeCodes.includes(item.code)).map(item=>item.slot));
  const selectedGroup=WAREHOUSE_GROUPS.find(group=>group.slots.includes(slot))??WAREHOUSE_GROUPS[0];
  useBodyScrollLock(true);
  useEffect(()=>{const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;closeButton.current?.focus({preventScroll:true});return()=>{if(previous?.isConnected)previous.focus({preventScroll:true});};},[]);
  useEffect(()=>{if(viewChanged.current)workshop.current?.querySelector<HTMLButtonElement>("[data-warehouse-view-toggle]")?.focus({preventScroll:true});},[listView]);
  useEffect(()=>{
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"&&!event.defaultPrevented)onClose();};
    document.addEventListener("keydown",escape);return()=>document.removeEventListener("keydown",escape);
  },[onClose]);
  const select=(next:KqEquipmentSlot)=>{
    updateTent(tentNumber,{slot:next,selectedCode:null,error:""});
    if(isKqSharedEquipmentSlot(next))updateTent(0,{error:""});
    if(window.matchMedia("(max-width: 899px)").matches)scrollToSection(panel.current);
  };
  const selectInScene=(number:number,next:KqEquipmentSlot)=>{
    if(number!==tentNumber){
      if(!onSelectTent)return;
      updateTent(number,{slot:next,selectedCode:null,error:""});
      onSelectTent(number);
      return;
    }
    if(next==="tent")updateTent(number,{slot:next,selectedCode:null,error:""});
    else select(next);
  };
  const scrollToSection=(target:HTMLElement|null)=>{target?.scrollIntoView({block:"start",behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});target?.focus({preventScroll:true});};
  const selectInOverview=(number:number,next:KqEquipmentSlot)=>{
    selectInScene(number,next);
    requestAnimationFrame(()=>scrollToSection(panel.current));
  };
  const showWorkshop=()=>{
    const recap=workshop.current?.querySelector<HTMLDetailsElement>("[data-warehouse-recap]");
    if(recap)recap.open=true;
    scrollToSection(recap?.querySelector<HTMLElement>("summary")??workshop.current);
  };
  const showExpansion=()=>{
    const details=management.current?.querySelector<HTMLDetailsElement>("[data-production-capacity]");
    if(!details)return;
    details.open=true;
    scrollToSection(details.querySelector<HTMLElement>("summary"));
  };
  const changeView=(showList:boolean)=>{viewChanged.current=true;setListView(showList);};
  const openShop=(code?:string)=>onOpenShop(code);
  const equip=async(item:KqEquipmentDefinition)=>{
    const shared=isKqSharedEquipment(item.code),targetKey=shared?0:tentNumber,targetTent=shared?1:tentNumber;
    if(locks.current.has(targetKey)||loading||loadError||productionPending||activeCodes.includes(item.code)||!purchasedCodes.includes(item.code)||cultureWear[item.code]?.due)return;
    locks.current.add(targetKey);updateTent(targetKey,{pending:item.code,error:"",notice:""});
    try {
      const response=await fetch("/api/arena/placard/equipment",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({equipmentCode:item.code,tentNumber:targetTent,expectedUnits:units})});
      const body=await response.json();if(!response.ok)throw new Error(body.error||"Installation impossible.");
      updateTent(targetKey,{override:{baseCodes:shared?sharedSource:equippedCodes,codes:[...(shared?sharedCodes:activeCodes).filter(code=>getKqEquipmentAtLevel(code)?.slot!==item.slot),item.code]},notice:shared?`${item.name} installé dans l’atelier commun, disponible pour toutes les tentes.`:`${item.name} installé dans la tente ${targetTent}. Ses bonus seront pris en compte à la prochaine culture.`});
      window.dispatchEvent(new Event("kq:equipment-updated"));
    } catch(reason){updateTent(targetKey,{error:reason instanceof Error?reason.message:"Installation impossible."});}
    finally{locks.current.delete(targetKey);updateTent(targetKey,{pending:null});}
  };
  return <div className={styles.overlay}>
    <button type="button" tabIndex={-1} className={styles.backdrop} onClick={onClose} aria-label="Fermer l’entrepôt"/>
    <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="equipment-inventory-title" data-arena-tour-surface="warehouse" onKeyDown={event=>{
      if(event.key==="Escape"){event.preventDefault();event.stopPropagation();onClose();return;}
      if(event.key!=="Tab")return;
      const controls=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),summary,[tabindex="0"]')).filter(el=>el.getClientRects().length>0);
      if(event.shiftKey&&document.activeElement===controls[0]){event.preventDefault();controls.at(-1)?.focus();}
      else if(!event.shiftKey&&document.activeElement===controls.at(-1)){event.preventDefault();controls[0]?.focus();}
    }}>
      <header className={styles.header}>
        <div><small>Le Placard · Aménager</small><h2 id="equipment-inventory-title" data-arena-tour="warehouse">L’Entrepôt</h2></div>
        <div className={styles.balance}><small>Trésorerie</small><strong>{formatKqCash(cashCents)}</strong></div><button ref={closeButton} type="button" onClick={onClose} aria-label="Fermer l’inventaire"><X/></button>
      </header>
      <div className={styles.layout}>
        <div ref={workshop} className={styles.workshop} tabIndex={-1} aria-label="Explorer l’entrepôt">
          {listView?<div className={styles.listView}>
            <div className={styles.listHeading}><strong>Choisir un emplacement</strong><button type="button" data-warehouse-view-toggle onClick={()=>changeView(false)}><ImageIcon size={16} aria-hidden="true"/>Voir le décor</button></div>
            <KqTentSelector tents={tents} tentNumber={tentNumber} disabled={!tents.length||productionPending} onSelect={onSelectTent}/>
            {WAREHOUSE_GROUPS.map(group=><section key={group.code} className={styles.listGroup} aria-label={group.label}>
              <h3>{group.label}</h3><div className={styles.slots}>{group.slots.map(groupSlot=><button key={groupSlot} type="button" disabled={loading||!!loadError||busy} aria-pressed={slot===groupSlot} data-installed={installedSlots.has(groupSlot)} onClick={()=>select(groupSlot)}><span>{KQ_EQUIPMENT_SLOT_LABELS[groupSlot]}</span><small>{installedSlots.has(groupSlot)?<><Check size={12} aria-hidden="true"/>Installé</>:"Libre"}</small></button>)}</div>
            </section>)}
          </div>:<KqWarehouseScene tents={sceneTents} selectedTentNumber={tentNumber} equippedCodes={activeCodes} levels={levels} sharedEquipment={{equippedCodes:sharedCodes,levels:sharedEquipment?.levels??levels}} selectedSlot={slot} onSelect={selectInScene} onExpand={showExpansion} onShowList={()=>changeView(true)} disabled={productionPending||(!tents.length&&(loading||!!loadError))}/>}
          <p className={styles.panHint}>Tente {tentNumber} sélectionnée : éclairage, extraction, climat, séchoir, énergie et sécurité lui appartiennent. Seules les machines de transformation sont communes.</p>
          <KqWarehouseOverview tents={loading&&!tents.length?[]:sceneTents} sharedEquipment={sharedEquipment?{...sharedEquipment,equippedCodes:sharedCodes}:undefined}
            selectedTentNumber={tentNumber} selectedSlot={slot} disabled={loading||!!loadError||busy} loading={loading} error={loadError} onRetry={onRetry} onSelect={selectInOverview}/>
        </div>
        <aside key={sharedSlot?"shared":tentNumber} ref={panel} className={styles.panel} tabIndex={-1} aria-labelledby="warehouse-slot-title">
          <button type="button" className={styles.backToScene} onClick={showWorkshop}><ArrowUp size={16} aria-hidden="true"/>Retour au récapitulatif</button>
          <div className={styles.panelHeading}><small>{sharedSlot?"Atelier commun · Toutes les tentes":`Tente ${tentNumber} · ${selectedGroup.label}`}</small><span data-installed={!!installed}>{installed?<><Check size={12} aria-hidden="true"/>Installé</>:"Libre"}</span></div><h3 id="warehouse-slot-title">{KQ_EQUIPMENT_SLOT_LABELS[slot]}</h3>
          {slot==="flower-drying"?<p>Le séchoir des fleurs de la tente {tentNumber}. Chaque niveau renforce la régularité ; la qualité maximale augmente aux niveaux 4, 7 et 10.</p>:null}
          <div aria-live="polite">{error||loadError?<p role="alert" className={styles.error}><CircleAlert size={16}/>{error||loadError}</p>:null}{notice?<p role="status" className={styles.notice}><Check size={16}/>{notice}</p>:null}</div>
          {loading?<p role="status">Actualisation de l’atelier…</p>:loadError?<button type="button" onClick={onRetry}><RefreshCw size={16}/>Réessayer</button>:<>
            {choices.length>1?<label className={styles.modelChoice}>Matériel de cet emplacement<select value={selectedEquipment.code} onChange={event=>updateTent(tentNumber,{selectedCode:event.target.value})} disabled={busy}><option disabled value="">Choisir un modèle</option>{choices.map(item=><option key={item.code} value={item.code}>{item.name} · {activeCodes.includes(item.code)?"installé":"en réserve"}</option>)}</select></label>:null}
            {selectedEquipment?[selectedEquipment].map(item=>{const isInstalled=activeCodes.includes(item.code),requirement=getKqEquipmentRequirementState({equipment:item,ownedCodes});return <article key={item.code} className={styles.item} data-installed={isInstalled}>
              <span>{cultureWear[item.code]?.due?"Hors service":isInstalled?"Installé":item.purchasable?"En réserve":"Fourni"}{item.purchasable?` · niveau ${levels[item.code]??1}`:""}</span><h4>{item.name}</h4>
              <ul>{getKqEquipmentImpactLabels(item).map(label=><li key={label}>{label}</li>)}</ul><small>{item.tradeoff}</small>
              {!isInstalled&&installed?<p>Remplace {installed.name}, qui reste en réserve.</p>:null}
              {!requirement.compatible?<p className={styles.error}>Prérequis : {requirement.missing.map(r=>r.label).join(", ")}</p>:null}
              {!isInstalled?<button type="button" disabled={!purchasedCodes.includes(item.code)||!requirement.compatible||busy||loading||cultureWear[item.code]?.due} onClick={()=>void equip(item)}>{pending===item.code?"Installation…":cultureWear[item.code]?.due?"À remplacer avant installation":sharedSlot?"Installer dans l’atelier commun":`Installer · tente ${tentNumber}`}</button>:null}
              {cultureWear[item.code]?<KqCultureEquipmentWear tentNumber={tentNumber} productionUnits={units} code={item.code} name={item.name} condition={cultureWear[item.code]} cashCents={cashCents} activeRun={activeRun} disabled={busy||loading} onUpdated={onRetry}/>:null}
              {item.purchasable&&purchasedCodes.includes(item.code)&&!cultureWear[item.code]?.due?<KqEquipmentUpgrade code={item.code} level={levels[item.code]??1} cashCents={cashCents} tentNumber={tentNumber} productionUnits={units} disabled={busy||loading} onUpdated={onRetry}/>:null}
              {maintenance[item.code]?<KqMachineMaintenance tentNumber={tentNumber} productionUnits={units} code={item.code} condition={maintenance[item.code]} cashCents={cashCents} disabled={busy||loading} onUpdated={onRetry}/>:null}
            </article>;}):null}
            {!choices.length?<p className={styles.empty}><PackageOpen/>Cet emplacement est prêt à accueillir ton matériel.</p>:null}
            <button type="button" className={styles.shopButton} onClick={()=>openShop(suggestion?.code)}><ShoppingBag size={17}/>{sharedSlot?"Matériel de l’atelier commun":slot==="flower-drying"&&suggestion?`Aménager le séchoir · ${formatKqCash(suggestion.priceCents)}`:`Acheter du matériel · tente ${tentNumber}`}</button>
          </>}
          <small className={styles.rule}>{sharedSlot?"Un seul achat pour toutes les tentes. Installation, niveau et entretien communs.":<>Matériel et niveaux propres à la tente {tentNumber}. Les changements s’appliquent à la prochaine culture commune.</>}</small>
        </aside>
        <div ref={management} className={styles.management}>
          <details className={styles.performance}><summary><span>Bilan de la tente {tentNumber}<small>Bonus et estimation d’électricité</small></span><ChevronDown size={18} aria-hidden="true"/></summary><div className={styles.performanceContent}><dl className={styles.stats}><div><dt>Quantité</dt><dd>+{summary.quantityPercent} %</dd></div><div><dt>Qualité max.</dt><dd>+{summary.qualityMaxBonus}</dd></div><div><dt>Régularité</dt><dd>+{summary.regularityPercent} %</dd></div><div><dt>Électricité / cycle</dt><dd>{formatKqCash(energy.totalCents)}</dd></div></dl>
          <small className={styles.estimate}>Estimation en mode équilibré, hors usure, nourriture et vétérinaire. Les bonus du matériel hors service sont désactivés ; le kit de départ prend le relais aux emplacements concernés. Le matériel de chaque tente est fixé au lancement de la culture commune.</small></div></details>
          <KqProductionCapacity tents={tents} production={expansion} cashCents={cashCents} activeRun={activeRun} disabled={loading||!!loadError||productionPending||Object.values(tentStates).some(state=>!!state.pending)} onUpdated={onRetry} onPendingChange={setProductionPending}/>
          <details className={styles.charges} onToggle={event=>setChargesOpen(event.currentTarget.open)}><summary><Zap size={19} aria-hidden="true"/><span>Charges et énergie<small>Factures de l’ensemble des tentes</small></span><ChevronDown size={18} aria-hidden="true"/></summary>{chargesOpen?<div className={styles.chargesContent}><KqEnergyPanel productionUnits={units}/></div>:null}</details>
        </div>
      </div>
    </section>
  </div>;
}
