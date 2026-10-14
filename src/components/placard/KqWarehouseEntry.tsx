"use client";

import { useCallback, useEffect, useState } from "react";
import { getKqEquipmentBuildingNumber, getKqEquipmentDefinition } from "@/lib/kanab-quest-equipment";
import { KqEquipmentInventoryModal } from "./KqEquipmentInventoryModal";
import { KqWarehouse } from "./KqWarehouse";
import { useKqSelectTent, useKqTentSelection, type KqTentOverview, type KqSharedEquipmentOverview, type KqBuildingEquipmentOverview } from "./KqTentSelector";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import type { KqProductionSnapshot } from "./KqProductionCapacity";
import type { KqMachineCondition } from "@/lib/kanab-quest-maintenance";
import type { KqCultureEquipmentCondition } from "@/lib/kanab-quest-culture-wear";
import type { ChanvrierCareerSnapshot } from "@/lib/chanvrier-career";
import type { ChanvrierProfile } from "@/lib/arena-chanvrier";

type Snapshot={chanvrierProfile?:ChanvrierProfile|null;equipmentScopeVersion?:2|3;career?:ChanvrierCareerSnapshot;storageCapacity?:{freeUnits:number;totalUnits:number}|null;expansionEnergyCents?:number;tentNumber?:number;tents?:KqTentOverview[];buildings?:KqBuildingEquipmentOverview[];sharedEquipment?:KqSharedEquipmentOverview;ownedCodes:string[];purchasedCodes:string[];equippedCodes:string[];levels:Record<string,number>;cashCents:number;productionUnits?:number;production?:KqProductionSnapshot;maintenance?:Record<string,KqMachineCondition>;cultureWear?:Record<string,KqCultureEquipmentCondition>;activeRun?:boolean};
const EMPTY:Snapshot={ownedCodes:[],purchasedCodes:[],equippedCodes:[],levels:{},cashCents:0};
type WarehouseEntryProps = {embedded?:boolean;workshopOnly?:boolean;initialZoneId?:string|null;initialShopOpen?:boolean;initialEquipmentCode?:string|null;initialSection?:"equipment"|"storage";onClose:()=>void;onOpenShop?:(code?:string)=>void;onBusyChange?:(busy:boolean)=>void};

/** Existing teaching sessions keep their isolated equipment fixture and never migrate an account. */
export function KqWarehouseEntry(props: WarehouseEntryProps) {
  const api = useKqTutorialApi();
  return api.isTutorial || props.workshopOnly ? <LegacyKqWarehouseEntry {...props} /> : <KqWarehouse {...props} />;
}

function LegacyKqWarehouseEntry({embedded=false,workshopOnly=false,initialEquipmentCode,initialSection="equipment",onClose,onOpenShop=()=>{},onBusyChange}:WarehouseEntryProps){
  const api=useKqTutorialApi();
  const selectKqTent=useKqSelectTent();
  const selectedTentNumber=useKqTentSelection();
  const tentNumber=workshopOnly?1:selectedTentNumber;
  const [snapshot,setSnapshot]=useState<Snapshot>(EMPTY);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [revision,setRevision]=useState(0);
  const refresh=useCallback(()=>{setLoading(true);setRevision(value=>value+1);},[]);
  useEffect(()=>api.subscribe(["kq:equipment-updated"],refresh),[refresh,api]);
  useEffect(()=>{
    const controller=new AbortController();let cancelled=false;
    void(async()=>{try{
      const response=await api.request("/api/arena/placard/equipment?tentNumber="+tentNumber,{cache:"no-store",signal:controller.signal});const body=await response.json();
      if(!response.ok)throw new Error(body.error||"Entrepôt indisponible.");
      if(!body||!Array.isArray(body.ownedCodes)||!Array.isArray(body.purchasedCodes)||!Array.isArray(body.equippedCodes)||!body.levels||!Number.isFinite(body.cashCents))throw new Error("Les informations de l’entrepôt sont incomplètes.");
      if(!cancelled){setSnapshot(body);setError("");if(!workshopOnly&&body.tentNumber && body.tentNumber!==tentNumber)selectKqTent(body.tentNumber);}
    }catch(reason){if(!cancelled)setError(reason instanceof Error?reason.message:"Entrepôt indisponible.");}
    finally{if(!cancelled)setLoading(false);}})();
    return()=>{cancelled=true;controller.abort();};
  },[revision,tentNumber,api,selectKqTent,workshopOnly]);
  const selectedTent=snapshot.tents?.find(tent=>tent.tentNumber===tentNumber);
  const selected=selectedTent?.ownedCodes&&selectedTent.purchasedCodes
    ? {...selectedTent,ownedCodes:selectedTent.ownedCodes,purchasedCodes:selectedTent.purchasedCodes}
    : (snapshot.tentNumber??1)===tentNumber?snapshot:null;
  const selectTent=(number:number)=>{
    if(!snapshot.tents?.some(tent=>tent.tentNumber===number))return;
    setError("");selectKqTent(number);
  };
  const shared=snapshot.sharedEquipment;
  const building=snapshot.equipmentScopeVersion===3?snapshot.buildings?.find(item=>item.buildingNumber===getKqEquipmentBuildingNumber(tentNumber)):undefined;
  return <KqEquipmentInventoryModal embedded={embedded} workshopOnly={workshopOnly} onBusyChange={onBusyChange} {...snapshot} {...(selected??EMPTY)}
    cashCents={snapshot.cashCents}
    career={snapshot.career}
    chanvrierProfile={snapshot.chanvrierProfile}
    sharedEquipment={shared}
    buildings={snapshot.buildings}
    ownedCodes={[...new Set([...(selected?.ownedCodes??[]),...(building?.ownedCodes??[]),...(shared?.ownedCodes??[])])]}
    purchasedCodes={[...new Set([...(selected?.purchasedCodes??[]),...(building?.purchasedCodes??[]),...(shared?.purchasedCodes??[])])]}
    equippedCodes={[...new Set([...(selected?.equippedCodes??[]),...(building?.equippedCodes??[]),...(shared?.equippedCodes??[])])]}
    levels={{...selected?.levels,...building?.levels,...shared?.levels}}
    maintenance={{...selected?.maintenance,...building?.maintenance,...shared?.maintenance}} cultureWear={{...selected?.cultureWear,...building?.cultureWear}}
    tentNumber={tentNumber} tents={snapshot.tents??[]} onSelectTent={selectTent}
    loading={loading||(!error&&!selected)} loadError={error} onRetry={refresh} onClose={onClose} onOpenShop={onOpenShop}
    initialSection={workshopOnly?"equipment":initialSection} initialSlot={getKqEquipmentDefinition(initialEquipmentCode??"")?.slot}/>;
}
