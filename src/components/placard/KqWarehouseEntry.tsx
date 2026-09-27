"use client";

import { useCallback, useEffect, useState } from "react";
import { getKqEquipmentDefinition } from "@/lib/kanab-quest-equipment";
import { KqEquipmentInventoryModal } from "./KqEquipmentInventoryModal";
import { selectKqTent, useKqTentSelection, type KqTentOverview, type KqSharedEquipmentOverview } from "./KqTentSelector";
import type { KqProductionSnapshot } from "./KqProductionCapacity";
import type { KqMachineCondition } from "@/lib/kanab-quest-maintenance";
import type { KqCultureEquipmentCondition } from "@/lib/kanab-quest-culture-wear";

type Snapshot={tentNumber?:number;tents?:KqTentOverview[];sharedEquipment?:KqSharedEquipmentOverview;ownedCodes:string[];purchasedCodes:string[];equippedCodes:string[];levels:Record<string,number>;cashCents:number;productionUnits?:number;production?:KqProductionSnapshot;maintenance?:Record<string,KqMachineCondition>;cultureWear?:Record<string,KqCultureEquipmentCondition>;activeRun?:boolean};
const EMPTY:Snapshot={ownedCodes:[],purchasedCodes:[],equippedCodes:[],levels:{},cashCents:0};
export function KqWarehouseEntry({initialEquipmentCode,onClose,onOpenShop}:{initialEquipmentCode?:string|null;onClose:()=>void;onOpenShop:(code?:string)=>void}){
  const tentNumber=useKqTentSelection();
  const [snapshot,setSnapshot]=useState<Snapshot>(EMPTY);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [revision,setRevision]=useState(0);
  const refresh=useCallback(()=>{setLoading(true);setRevision(value=>value+1);},[]);
  useEffect(()=>{window.addEventListener("kq:equipment-updated",refresh);return()=>window.removeEventListener("kq:equipment-updated",refresh);},[refresh]);
  useEffect(()=>{
    const controller=new AbortController();let cancelled=false;
    void(async()=>{try{
      const response=await fetch("/api/arena/placard/equipment?tentNumber="+tentNumber,{cache:"no-store",signal:controller.signal});const body=await response.json();
      if(!response.ok)throw new Error(body.error||"Entrepôt indisponible.");
      if(!body||!Array.isArray(body.ownedCodes)||!Array.isArray(body.purchasedCodes)||!Array.isArray(body.equippedCodes)||!body.levels||!Number.isFinite(body.cashCents))throw new Error("Les informations de l’entrepôt sont incomplètes.");
      if(!cancelled){setSnapshot(body);setError("");if(body.tentNumber && body.tentNumber!==tentNumber)selectKqTent(body.tentNumber);}
    }catch(reason){if(!cancelled)setError(reason instanceof Error?reason.message:"Entrepôt indisponible.");}
    finally{if(!cancelled)setLoading(false);}})();
    return()=>{cancelled=true;controller.abort();};
  },[revision,tentNumber]);
  const selectedTent=snapshot.tents?.find(tent=>tent.tentNumber===tentNumber);
  const selected=selectedTent?.ownedCodes&&selectedTent.purchasedCodes
    ? {...selectedTent,ownedCodes:selectedTent.ownedCodes,purchasedCodes:selectedTent.purchasedCodes}
    : (snapshot.tentNumber??1)===tentNumber?snapshot:null;
  const selectTent=(number:number)=>{
    if(!snapshot.tents?.some(tent=>tent.tentNumber===number))return;
    setError("");selectKqTent(number);
  };
  const shared=snapshot.sharedEquipment;
  return <KqEquipmentInventoryModal {...snapshot} {...(selected??EMPTY)}
    cashCents={snapshot.cashCents}
    sharedEquipment={shared}
    ownedCodes={[...new Set([...(selected?.ownedCodes??[]),...(shared?.ownedCodes??[])])]}
    purchasedCodes={[...new Set([...(selected?.purchasedCodes??[]),...(shared?.purchasedCodes??[])])]}
    equippedCodes={[...new Set([...(selected?.equippedCodes??[]),...(shared?.equippedCodes??[])])]}
    levels={{...selected?.levels,...shared?.levels}}
    maintenance={{...selected?.maintenance,...shared?.maintenance}} cultureWear={selected?.cultureWear??{}}
    tentNumber={tentNumber} tents={snapshot.tents??[]} onSelectTent={selectTent}
    loading={loading||(!error&&!selected)} loadError={error} onRetry={refresh} onClose={onClose} onOpenShop={onOpenShop}
    initialSlot={getKqEquipmentDefinition(initialEquipmentCode??"")?.slot}/>;
}
