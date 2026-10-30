"use client";

import Image from "next/image";
import { ArrowUp, Check, ChevronDown, CircleAlert, ImageIcon, PackageOpen, RefreshCw, Settings2, ShoppingBag, Tent, X, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { formatKqCash, getKqEquipmentAtLevel, getKqEquipmentBuildingNumber, getKqEquipmentImpactLabels, getKqEquipmentRequirementState, isKqBuildingEquipment, isKqBuildingEquipmentSlot, isKqSharedEquipment, isKqSharedEquipmentSlot, KQ_EQUIPMENT_CATALOG, KQ_EQUIPMENT_SLOT_LABELS, summarizeKqEquipmentLoadout, type KqEquipmentDefinition, type KqEquipmentSlot } from "@/lib/kanab-quest-equipment";
import { getKqProductionExpansion, getKqProductionUnits } from "@/lib/kanab-quest-production";
import { KqTentSelector, type KqTentOverview, type KqSharedEquipmentOverview, type KqBuildingEquipmentOverview } from "./KqTentSelector";
import { KqProductionCapacity, type KqProductionSnapshot } from "./KqProductionCapacity";
import { getKqCultureOperationalCodes, type KqCultureEquipmentCondition } from "@/lib/kanab-quest-culture-wear";
import { KqEquipmentUpgrade } from "./KqEquipmentUpgrade";
import { getKqWorkshopProductArtwork } from "@/lib/kanab-quest-warehouse-product-artwork";
import { KqMachineMaintenance } from "./KqMachineMaintenance";
import { KqCultureEquipmentWear } from "./KqCultureEquipmentWear";
import { KqEnergyPanel } from "./KqEnergyPanel";
import type { KqMachineCondition } from "@/lib/kanab-quest-maintenance";
import { KqWarehouseScene } from "./KqWarehouseScene";
import { KqWarehouseOverview } from "./KqWarehouseOverview";
import { KqWarehouseStorage } from "./KqWarehouseStorage";
import styles from "./KqWarehouseInventory.module.css";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import type { ChanvrierCareerSnapshot } from "@/lib/chanvrier-career";
import type { ChanvrierProfile } from "@/lib/arena-chanvrier";
import { KqCareerProgress } from "./KqCareerProgress";
import { KqWorkshopScene } from "./KqWorkshopScene";
import { KqWorkshopMachineDialog } from "./KqWorkshopMachineDialog";
import { KqWorkshopTiers } from "./KqWorkshopTiers";
import { KqWorkshopMachineSummary } from "./KqWorkshopMachineSummary";

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

export function KqEquipmentInventoryModal({ownedCodes,purchasedCodes,equippedCodes,levels,cashCents,career,chanvrierProfile,storageCapacity,expansionEnergyCents,productionUnits=1,tentNumber=1,tents=[],buildings=[],equipmentScopeVersion=2,sharedEquipment,onSelectTent,production,maintenance={},cultureWear={},activeRun=false,inventoryKnown=true,loading,loadError,onClose,onOpenShop,onRetry,onBusyChange,embedded=false,workshopOnly=false,initialSlot:requestedInitialSlot="tent",initialSection="equipment"}:{
  embedded?:boolean;
  workshopOnly?:boolean;
  onBusyChange?:(busy:boolean)=>void;
  career?:ChanvrierCareerSnapshot;
  chanvrierProfile?:ChanvrierProfile|null;
  storageCapacity?:{freeUnits:number;totalUnits:number}|null;
  expansionEnergyCents?:number;
  productionUnits?:number;
  tentNumber?:number;
  tents?:KqTentOverview[];
  buildings?:KqBuildingEquipmentOverview[];
  equipmentScopeVersion?:2|3;
  sharedEquipment?:KqSharedEquipmentOverview;
  onSelectTent?:(tentNumber:number)=>void;
  production?:KqProductionSnapshot;
  maintenance?:Record<string,KqMachineCondition>;
  cultureWear?:Record<string,KqCultureEquipmentCondition>;
  activeRun?:boolean;
  inventoryKnown?:boolean;
  ownedCodes:string[];purchasedCodes:string[];equippedCodes:string[];levels:Record<string,number>;cashCents:number;loading:boolean;loadError:string;
  onClose:()=>void;onOpenShop:(equipmentCode?:string)=>void;onRetry:()=>void;
  initialSlot?:KqEquipmentSlot;
  initialSection?:"equipment"|"storage";
}) {
  const api = useKqTutorialApi();
  const inline = embedded || api.isTutorial;
  const initialSlot=workshopOnly&&!isKqSharedEquipmentSlot(requestedInitialSlot)?"press":requestedInitialSlot;
  const visibleGroups=workshopOnly?WAREHOUSE_GROUPS.filter(group=>group.code==="process"):WAREHOUSE_GROUPS;
  const closeButton=useRef<HTMLButtonElement>(null);
  const panel=useRef<HTMLElement>(null);
  const workshop=useRef<HTMLDivElement>(null);
  const inventoryFeedback=useRef<HTMLDivElement>(null);
  const inventoryRetry=useRef(false);
  const management=useRef<HTMLDivElement>(null);
  const viewChanged=useRef(false);
  const locks=useRef(new Set<number>());
  const [tentStates,setTentStates]=useState<Record<number,TentUiState>>(()=>({[tentNumber]:{...EMPTY_TENT_UI,slot:initialSlot}}));
  const [requestedSlot,setRequestedSlot]=useState(initialSlot);
  const [listView,setListView]=useState(false);
  const [chargesOpen,setChargesOpen]=useState(false);
  const [productionPending,setProductionPending]=useState(false);
  const [storageBusy,setStorageBusy]=useState(false);
  const [upgradeBusy,setUpgradeBusy]=useState(false);
  const [maintenanceBusy,setMaintenanceBusy]=useState(false);
  const [machineDialogOpen,setMachineDialogOpen]=useState(false);
  if(requestedSlot!==initialSlot){
    setRequestedSlot(initialSlot);
    setTentStates(current=>({...current,[tentNumber]:{...(current[tentNumber]??EMPTY_TENT_UI),slot:initialSlot,selectedCode:null,error:""}}));
  }
  const tentState=tentStates[tentNumber]??{...EMPTY_TENT_UI,slot:initialSlot};
  const {slot,selectedCode}=tentState;
  const buildingScope=equipmentScopeVersion===3;
  const buildingNumber=getKqEquipmentBuildingNumber(tentNumber);
  const building=buildingScope?buildings.find(item=>item.buildingNumber===buildingNumber):undefined;
  const sharedSlot=isKqSharedEquipmentSlot(slot);
  const buildingSlot=buildingScope&&isKqBuildingEquipmentSlot(slot);
  const operationState=sharedSlot?(tentStates[0]??EMPTY_TENT_UI):buildingSlot?(tentStates[-buildingNumber]??EMPTY_TENT_UI):tentState;
  const {pending,error,notice}=operationState;
  const busy=productionPending||!!pending||upgradeBusy||maintenanceBusy;
  useEffect(()=>{onBusyChange?.(busy||storageBusy);},[busy,storageBusy,onBusyChange]);
  useEffect(()=>()=>onBusyChange?.(false),[onBusyChange]);
  const updateTent=(number:number,patch:Partial<TentUiState>)=>setTentStates(current=>({...current,[number]:{...(current[number]??{...EMPTY_TENT_UI,slot:initialSlot}),...patch}}));
  const units=getKqProductionUnits(productionUnits);
  const expansion=production??getKqProductionExpansion(units,purchasedCodes,levels);
  const tentCodes=tentState.override?.baseCodes===equippedCodes?tentState.override.codes:equippedCodes;
  const sharedSource=useMemo(()=>sharedEquipment?.equippedCodes??equippedCodes.filter(isKqSharedEquipment),[sharedEquipment,equippedCodes]);
  const sharedOverride=tentStates[0]?.override;
  const sharedCodes=sharedOverride?.baseCodes===sharedSource?sharedOverride.codes:sharedSource;
  const buildingSource=useMemo(()=>building?.equippedCodes??equippedCodes.filter(isKqBuildingEquipment),[building,equippedCodes]);
  const buildingOverride=tentStates[-buildingNumber]?.override;
  const buildingCodes=buildingOverride?.baseCodes===buildingSource?buildingOverride.codes:buildingSource;
  const activeCodes=useMemo(()=>[...tentCodes.filter(code=>!isKqSharedEquipment(code)&&(!buildingScope||!isKqBuildingEquipment(code))),...(buildingScope?buildingCodes:[]),...sharedCodes],[tentCodes,buildingScope,buildingCodes,sharedCodes]);
  const sceneTents=(tents.length?tents:[{tentNumber,ownedCodes,purchasedCodes,equippedCodes,levels,cultureWear}]).map(tent=>{
    const override=tentStates[tent.tentNumber]?.override;
    return override?.baseCodes===tent.equippedCodes?{...tent,equippedCodes:override.codes}:tent;
  });
  const operationalCodes=useMemo(()=>getKqCultureOperationalCodes(activeCodes,cultureWear),[activeCodes,cultureWear]);
  const sceneBuildings=buildings.map(item=>{
    const override=tentStates[-item.buildingNumber]?.override;
    return override?.baseCodes===item.equippedCodes?{...item,equippedCodes:override.codes}:item;
  });
  const summary=useMemo(()=>summarizeKqEquipmentLoadout(operationalCodes,levels),[operationalCodes,levels]);
  const equipment=useMemo(()=>[...new Set([...ownedCodes,...activeCodes])].map(code=>getKqEquipmentAtLevel(code,levels[code])).filter((item):item is KqEquipmentDefinition=>!!item),[ownedCodes,activeCodes,levels]);
  const choices=equipment.filter(item=>item.slot===slot);
  const installed=choices.find(item=>activeCodes.includes(item.code));
  const selectedEquipment=choices.find(item=>item.code===selectedCode)??installed??choices[0];
  const suggestion=KQ_EQUIPMENT_CATALOG.find(item=>item.slot===slot&&item.purchasable&&!ownedCodes.includes(item.code));
  const installedSlots=new Set(equipment.filter(item=>activeCodes.includes(item.code)).map(item=>item.slot));
  const selectedGroup=WAREHOUSE_GROUPS.find(group=>group.slots.includes(slot))??WAREHOUSE_GROUPS[0];
  useBodyScrollLock(!inline);
  useEffect(()=>{if(inline)return;const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;closeButton.current?.focus({preventScroll:true});return()=>{if(previous?.isConnected)previous.focus({preventScroll:true});};},[inline]);
  useEffect(()=>{if(viewChanged.current)workshop.current?.querySelector<HTMLButtonElement>("[data-warehouse-view-toggle]")?.focus({preventScroll:true});},[listView]);
  const retryInventory=()=>{inventoryRetry.current=true;onRetry();};
  useEffect(()=>{
    if(!inventoryRetry.current||loading)return;
    inventoryRetry.current=false;
    const target=inventoryKnown&&!loadError
      ? workshop.current?.querySelector<HTMLButtonElement>("[data-workshop-machine]:not(:disabled)")??workshop.current
      : inventoryFeedback.current?.querySelector<HTMLButtonElement>("button");
    target?.focus({preventScroll:true});
  },[inventoryKnown,loading,loadError]);
  useEffect(()=>{
    if(inline)return;
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"&&!event.defaultPrevented&&!storageBusy&&!busy)onClose();};
    document.addEventListener("keydown",escape);return()=>document.removeEventListener("keydown",escape);
  },[onClose,inline,storageBusy,busy]);
  const select=(next:KqEquipmentSlot)=>{
    if(busy||(workshopOnly&&!isKqSharedEquipmentSlot(next)))return;
    updateTent(tentNumber,{slot:next,selectedCode:null,error:""});
    if(isKqSharedEquipmentSlot(next))updateTent(0,{error:""});
    if(buildingScope&&isKqBuildingEquipmentSlot(next))updateTent(-buildingNumber,{error:""});
    if(workshopOnly)setMachineDialogOpen(true);
    else if(window.matchMedia("(max-width: 899px)").matches)scrollToSection(panel.current);
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
  const openShop=(code?:string)=>{if(busy)return;setMachineDialogOpen(false);onOpenShop(code);};
  const equip=async(item:KqEquipmentDefinition)=>{
    const shared=isKqSharedEquipment(item.code),buildingItem=buildingScope&&isKqBuildingEquipment(item.code),targetKey=shared?0:buildingItem?-buildingNumber:tentNumber,targetTent=shared?1:tentNumber;
    if(locks.current.has(targetKey)||loading||loadError||busy||activeCodes.includes(item.code)||!purchasedCodes.includes(item.code)||cultureWear[item.code]?.due)return;
    locks.current.add(targetKey);updateTent(targetKey,{pending:item.code,error:"",notice:""});
    try {
      const response=await api.request("/api/arena/placard/equipment",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({equipmentCode:item.code,tentNumber:targetTent,expectedUnits:units})});
      const body=await response.json();if(!response.ok)throw new Error(body.error||"Installation impossible.");
      updateTent(targetKey,{override:{baseCodes:shared?sharedSource:buildingItem?buildingSource:equippedCodes,codes:[...(shared?sharedCodes:buildingItem?buildingCodes:activeCodes).filter(code=>getKqEquipmentAtLevel(code)?.slot!==item.slot),item.code]},notice:workshopOnly?`${item.name} installé dans l’atelier de transformation.`:shared?`${item.name} installé dans l’atelier commun, disponible pour toutes les tentes.`:buildingItem?`${item.name} installé dans l’entrepôt ${buildingNumber}, pour ses tentes dès la prochaine culture.`:`${item.name} installé dans la tente ${targetTent}. Ses bonus seront pris en compte à la prochaine culture.`});
      api.notify("kq:equipment-updated");
    } catch(reason){updateTent(targetKey,{error:reason instanceof Error?reason.message:"Installation impossible."});}
    finally{locks.current.delete(targetKey);updateTent(targetKey,{pending:null});}
  };
  const equipmentPanel = <aside key={sharedSlot?"shared":buildingSlot?`building:${buildingNumber}`:tentNumber} ref={panel} className={styles.panel} tabIndex={-1} aria-labelledby="warehouse-slot-title">
          {!workshopOnly&&<button type="button" className={styles.backToScene} onClick={showWorkshop}><ArrowUp size={16} aria-hidden="true"/>Retour au récapitulatif</button>}
          {!workshopOnly&&<div className={styles.panelHeading}><small>{sharedSlot?"Atelier commun · Toutes les tentes":buildingSlot?`Entrepôt ${buildingNumber} · Services partagés`:`Tente ${tentNumber} · ${selectedGroup.label}`}</small><span data-installed={!!installed}>{installed?<><Check size={12} aria-hidden="true"/>Installé</>:"Libre"}</span></div>}<h3 id="warehouse-slot-title" className={workshopOnly?styles.workshopTitle:undefined}>{KQ_EQUIPMENT_SLOT_LABELS[slot]}</h3>
          {slot==="flower-drying"?<p>Le séchoir des fleurs {buildingScope?`de l’entrepôt ${buildingNumber}, commun à ses tentes`:`de la tente ${tentNumber}`}. Chaque niveau renforce la régularité ; la qualité maximale augmente aux niveaux 4, 7 et 10.</p>:null}
          <div aria-live="polite">{error||loadError?<p role="alert" className={styles.error}><CircleAlert size={16}/>{error||loadError}</p>:null}{notice?<p role="status" className={styles.notice}><Check size={16}/>{notice}</p>:null}</div>
          {loading?<p role="status">Actualisation de l’atelier…</p>:loadError?<button type="button" onClick={onRetry}><RefreshCw size={16}/>Réessayer</button>:<>
            {choices.length>1?<label className={styles.modelChoice}>Matériel de cet emplacement<select value={selectedEquipment.code} onChange={event=>updateTent(tentNumber,{selectedCode:event.target.value})} disabled={busy}><option disabled value="">Choisir un modèle</option>{choices.map(item=><option key={item.code} value={item.code}>{item.name} · {activeCodes.includes(item.code)?"installé":"en réserve"}</option>)}</select></label>:null}
            {selectedEquipment?[selectedEquipment].map(item=>{const isInstalled=activeCodes.includes(item.code),requirement=getKqEquipmentRequirementState({equipment:item,ownedCodes}),artwork=getKqWorkshopProductArtwork(item.code,levels[item.code]??1),workshopMachine=workshopOnly&&purchasedCodes.includes(item.code);return <article key={item.code} className={workshopMachine?styles.workshopMachine:styles.item} data-installed={isInstalled}>
              {!workshopMachine&&<>
              <span>{cultureWear[item.code]?.due?"Hors service":isInstalled?"Installé":item.purchasable?"En réserve":"Fourni"}{item.purchasable?` · niveau ${levels[item.code]??1}`:""}</span><h4>{item.name}</h4>
              {artwork?<Image src={artwork.src} alt="" width={512} height={512} sizes="180px" className={styles.machineArtwork} data-workshop-inventory-artwork={item.code}/>:null}
              <ul>{getKqEquipmentImpactLabels(item).map(label=><li key={label}>{label}</li>)}</ul><small>{item.tradeoff}</small>
              </>}
              {workshopMachine?<KqWorkshopMachineSummary code={item.code} level={levels[item.code]??1} condition={maintenance[item.code]} cashCents={cashCents} career={career} installed={isInstalled} tentNumber={tentNumber} productionUnits={units} equipmentScopeVersion={equipmentScopeVersion} disabled={busy||loading} onUpdated={onRetry} onBusyChange={setUpgradeBusy}/>:null}
              {!isInstalled&&installed?<p>Remplace {installed.name}, qui reste en réserve.</p>:null}
              {!requirement.compatible?<p className={styles.error}>Prérequis : {requirement.missing.map(r=>r.label).join(", ")}</p>:null}
              {!isInstalled?<button type="button" disabled={!purchasedCodes.includes(item.code)||!requirement.compatible||busy||loading||cultureWear[item.code]?.due} onClick={()=>void equip(item)}>{pending===item.code?"Installation…":cultureWear[item.code]?.due?"À remplacer avant installation":sharedSlot?"Installer dans l’atelier commun":buildingSlot?`Installer · entrepôt ${buildingNumber}`:`Installer · tente ${tentNumber}`}</button>:null}
              {cultureWear[item.code]?<KqCultureEquipmentWear equipmentScopeVersion={equipmentScopeVersion} tentNumber={tentNumber} productionUnits={units} code={item.code} name={item.name} condition={cultureWear[item.code]} cashCents={cashCents} activeRun={activeRun} disabled={busy||loading} onUpdated={onRetry}/>:null}
              {!workshopMachine&&item.purchasable&&purchasedCodes.includes(item.code)&&!cultureWear[item.code]?.due?<KqEquipmentUpgrade workshopOnly={workshopOnly} maintenanceDue={maintenance[item.code]?.due} onBusyChange={setUpgradeBusy} equipmentScopeVersion={equipmentScopeVersion} career={career} code={item.code} level={levels[item.code]??1} cashCents={cashCents} tentNumber={tentNumber} productionUnits={units} disabled={busy||loading} onUpdated={onRetry}/>:null}
              {!workshopMachine&&maintenance[item.code]?<KqMachineMaintenance onBusyChange={setMaintenanceBusy} tentNumber={tentNumber} productionUnits={units} code={item.code} condition={maintenance[item.code]} cashCents={cashCents} disabled={busy||loading} onUpdated={onRetry}/>:null}
            </article>;}):null}
            {!choices.length?<><p className={styles.empty}><PackageOpen/>{workshopOnly?"Cette machine n’est pas encore acquise. Choisis sa gamme pour l’ajouter à ton atelier.":"Cet emplacement est prêt à accueillir ton matériel."}</p>{workshopOnly&&suggestion?<KqWorkshopTiers key={suggestion.code} code={suggestion.code} cashCents={cashCents} career={career} disabled={busy||loading} onUpdated={onRetry} onBusyChange={setUpgradeBusy}/>:null}</>:null}
            <button type="button" className={styles.shopButton} disabled={busy} onClick={()=>openShop(workshopOnly?selectedEquipment?.code??suggestion?.code:suggestion?.code)}><ShoppingBag size={17}/>{sharedSlot?"Matériel de l’atelier commun":buildingSlot?`Matériel de l’entrepôt ${buildingNumber}`:slot==="flower-drying"&&suggestion?`Aménager le séchoir · ${formatKqCash(suggestion.priceCents)}`:`Acheter du matériel · tente ${tentNumber}`}</button>
          </>}
          <small className={styles.rule}>{workshopOnly?"Un modèle actif par emplacement. Les niveaux et l’entretien de tes machines sont conservés.":sharedSlot?"Un seul achat pour toutes les tentes. Installation, niveau et entretien communs.":buildingSlot?`Un seul achat pour les tentes ${buildingNumber===1?"1 à 4":"5 à 8"}. Installation, niveau et usure partagés dans cet entrepôt.`:<>Matériel et niveaux propres à la tente {tentNumber}. Les changements s’appliquent à la prochaine culture commune.</>}</small>
        </aside>;
  return <div className={styles.overlay} data-embedded={inline||undefined} data-page={embedded||undefined} data-workshop-only={workshopOnly||undefined}>
    {!inline?<button type="button" tabIndex={-1} className={styles.backdrop} onClick={onClose} disabled={storageBusy||busy} aria-label="Fermer l’entrepôt"/>:null}
    <section className={styles.dialog} role={inline?"region":"dialog"} aria-modal={inline?undefined:true} aria-labelledby="equipment-inventory-title" data-arena-tour-surface="warehouse" onKeyDown={event=>{
      if(inline||event.target instanceof Element&&event.target.closest("[data-app-dialog]"))return;
      if(event.key==="Escape"){event.preventDefault();event.stopPropagation();if(!storageBusy&&!busy)onClose();return;}
      if(event.key!=="Tab")return;
      const controls=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),summary,[tabindex="0"]')).filter(el=>el.getClientRects().length>0);
      if(event.shiftKey&&document.activeElement===controls[0]){event.preventDefault();controls.at(-1)?.focus();}
      else if(!event.shiftKey&&document.activeElement===controls.at(-1)){event.preventDefault();controls[0]?.focus();}
    }}>
      <header className={styles.header}>
        <div><h2 id="equipment-inventory-title" data-arena-tour="warehouse">{workshopOnly?"Mes machines":"L’Entrepôt"}</h2></div>
        <div className={styles.balance} data-inventory-balance={inventoryKnown?"known":"unknown"}><small>Trésorerie</small><strong aria-label={inventoryKnown?undefined:"Trésorerie indisponible"}>{inventoryKnown?formatKqCash(cashCents):"—"}</strong></div>{!embedded?<button ref={closeButton} type="button" onClick={onClose} disabled={storageBusy||busy} aria-label="Fermer l’inventaire"><X/></button>:null}
      </header>
      {!inventoryKnown?<div ref={inventoryFeedback} className={styles.inventoryState} data-inventory-state={loading?"loading":"unavailable"} role={loading?"status":"alert"}>
        <p>{loading?"Vérification de ton inventaire…":loadError||"Ton inventaire n’est pas disponible."}</p>
        {!loading&&<button type="button" onClick={retryInventory}><RefreshCw size={16} aria-hidden="true"/>Réessayer</button>}
      </div>:<>
      {!workshopOnly&&<KqCareerProgress career={career} profile={chanvrierProfile} compact/>}
      {!workshopOnly&&initialSection==="storage"?<div className={styles.storageView}><KqWarehouseStorage onChanged={onRetry} onBusyChange={setStorageBusy}/></div>:<div className={styles.layout}>
        <div ref={workshop} className={styles.workshop} tabIndex={-1} aria-label={workshopOnly?"Explorer l’atelier":"Explorer l’entrepôt"}>
          {workshopOnly?<>
            {(loading||loadError)&&<div ref={inventoryFeedback} className={styles.inventoryState} data-inventory-state={loading?"refreshing":"stale"} role={loading?"status":"alert"}>
              <p><strong>Dernières données connues.</strong> {loading?"Actualisation en cours…":`Inventaire non actualisé : ${loadError}`}</p>
              {!loading&&<button type="button" onClick={retryInventory}><RefreshCw size={16} aria-hidden="true"/>Réessayer</button>}
            </div>}
            <KqWorkshopScene purchasedCodes={purchasedCodes} equippedCodes={sharedCodes} levels={levels} maintenance={maintenance} selectedSlot={machineDialogOpen?slot:undefined} disabled={loading||!!loadError||busy} onSelect={select}/>
            <div className={styles.workshopToolbar}>
              <button type="button" disabled={busy||loading||!!loadError} onClick={()=>openShop(selectedEquipment?.code??suggestion?.code)}><ShoppingBag size={17} aria-hidden="true"/>Matériel de l’atelier commun</button>
            </div>
          </>:listView?<div className={styles.listView}>
            <div className={styles.listHeading}><strong>{workshopOnly?"Choisir une machine":"Choisir un emplacement"}</strong>{!workshopOnly&&<button type="button" data-warehouse-view-toggle onClick={()=>changeView(false)}><ImageIcon size={16} aria-hidden="true"/>Voir le décor</button>}</div>
            {!workshopOnly&&<KqTentSelector equipmentScopeVersion={equipmentScopeVersion} tents={tents} tentNumber={tentNumber} disabled={!tents.length||productionPending} onSelect={onSelectTent}/>}
            {visibleGroups.map(group=><section key={group.code} className={styles.listGroup} aria-label={group.label}>
              <h3>{workshopOnly?"Emplacements de transformation":group.code==="services"&&buildingScope?`Entrepôt ${buildingNumber} · Services`:group.label}</h3><div className={styles.slots}>{group.slots.map(groupSlot=><button key={groupSlot} type="button" data-warehouse-slot={groupSlot} disabled={loading||!!loadError||busy} aria-pressed={slot===groupSlot} data-installed={installedSlots.has(groupSlot)} onClick={()=>select(groupSlot)}><span>{KQ_EQUIPMENT_SLOT_LABELS[groupSlot]}</span><small>{installedSlots.has(groupSlot)?<><Check size={12} aria-hidden="true"/>Installé</>:"Libre"}</small></button>)}</div>
            </section>)}
          </div>:<KqWarehouseScene equipmentScopeVersion={equipmentScopeVersion} buildings={sceneBuildings} tents={sceneTents} selectedTentNumber={tentNumber} equippedCodes={activeCodes} levels={levels} sharedEquipment={{equippedCodes:sharedCodes,levels:sharedEquipment?.levels??levels}} selectedSlot={slot} onSelect={selectInScene} onExpand={showExpansion} onShowList={()=>changeView(true)} disabled={productionPending||(!tents.length&&(loading||!!loadError))}/>}
          {!workshopOnly&&<><div className={styles.panHint}><span><Tent size={16} aria-hidden="true"/><strong>Tente {tentNumber}</strong> · matériel individuel</span>{buildingScope?<span>Services · entrepôt {buildingNumber}</span>:null}<span><Settings2 size={16} aria-hidden="true"/>Transformation · atelier commun</span></div>
          <KqWarehouseOverview equipmentScopeVersion={equipmentScopeVersion} buildings={sceneBuildings} tents={loading&&!tents.length?[]:sceneTents} sharedEquipment={sharedEquipment?{...sharedEquipment,equippedCodes:sharedCodes}:undefined}
            selectedTentNumber={tentNumber} selectedSlot={slot} disabled={loading||!!loadError||busy} loading={loading} error={loadError} onRetry={onRetry} onSelect={selectInOverview}/></>}
        </div>
        {workshopOnly?<KqWorkshopMachineDialog open={machineDialogOpen} busy={busy||loading} title={KQ_EQUIPMENT_SLOT_LABELS[slot]} onClose={()=>{if(!busy&&!loading)setMachineDialogOpen(false);}}>{equipmentPanel}</KqWorkshopMachineDialog>:equipmentPanel}
        {!workshopOnly&&<div ref={management} className={styles.management}>
          <details className={styles.performance}><summary><span>Bilan de la tente {tentNumber}<small>Bonus du matériel{buildingScope?" et de son bâtiment":""}</small></span><ChevronDown size={18} aria-hidden="true"/></summary><div className={styles.performanceContent}><dl className={styles.stats}><div><dt>Quantité</dt><dd>+{summary.quantityPercent} %</dd></div><div><dt>Qualité max.</dt><dd>+{summary.qualityMaxBonus}</dd></div><div><dt>Régularité</dt><dd>+{summary.regularityPercent} %</dd></div></dl>
          <small className={styles.estimate}>Les bonus du matériel hors service sont désactivés ; le kit de départ prend le relais aux emplacements concernés. Le matériel est fixé au lancement de la culture commune. Le panneau Charges et énergie présente la facture totale.</small></div></details>
          <KqProductionCapacity equipmentScopeVersion={equipmentScopeVersion} career={career} storageCapacity={storageCapacity} expansionEnergyCents={expansionEnergyCents} tents={tents} production={expansion} cashCents={cashCents} activeRun={activeRun} disabled={loading||!!loadError||productionPending||Object.values(tentStates).some(state=>!!state.pending)} onUpdated={onRetry} onPendingChange={setProductionPending}/>
          <details className={styles.charges} onToggle={event=>setChargesOpen(event.currentTarget.open)}><summary><Zap size={19} aria-hidden="true"/><span>Charges et énergie<small>Factures de l’ensemble des tentes</small></span><ChevronDown size={18} aria-hidden="true"/></summary>{chargesOpen?<div className={styles.chargesContent}><KqEnergyPanel productionUnits={units}/></div>:null}</details>
        </div>}
      </div>}
      </>}
    </section>
  </div>;
}
