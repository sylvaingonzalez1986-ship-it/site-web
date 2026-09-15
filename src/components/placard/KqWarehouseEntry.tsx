"use client";

import { useCallback, useEffect, useState } from "react";
import { getKqEquipmentDefinition } from "@/lib/kanab-quest-equipment";
import { KqEquipmentInventoryModal } from "./KqEquipmentInventoryModal";
import type { KqMachineCondition } from "@/lib/kanab-quest-maintenance";

type Snapshot={ownedCodes:string[];purchasedCodes:string[];equippedCodes:string[];levels:Record<string,number>;cashCents:number;maintenance?:Record<string,KqMachineCondition>};
const EMPTY:Snapshot={ownedCodes:[],purchasedCodes:[],equippedCodes:[],levels:{},cashCents:0};
export function KqWarehouseEntry({initialEquipmentCode,onClose,onOpenShop}:{initialEquipmentCode?:string|null;onClose:()=>void;onOpenShop:(code?:string)=>void}){
  const [snapshot,setSnapshot]=useState<Snapshot>(EMPTY);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [revision,setRevision]=useState(0);
  const refresh=useCallback(()=>{setLoading(true);setRevision(value=>value+1);},[]);
  useEffect(()=>{window.addEventListener("kq:equipment-updated",refresh);return()=>window.removeEventListener("kq:equipment-updated",refresh);},[refresh]);
  useEffect(()=>{
    const controller=new AbortController();let cancelled=false;
    void(async()=>{try{
      const response=await fetch("/api/arena/placard/equipment",{cache:"no-store",signal:controller.signal});const body=await response.json();
      if(!response.ok)throw new Error(body.error||"Entrepôt indisponible.");
      if(!cancelled){setSnapshot(body);setError("");}
    }catch(reason){if(!cancelled)setError(reason instanceof Error?reason.message:"Entrepôt indisponible.");}
    finally{if(!cancelled)setLoading(false);}})();
    return()=>{cancelled=true;controller.abort();};
  },[revision]);
  return <KqEquipmentInventoryModal {...snapshot} loading={loading} loadError={error} onRetry={refresh} onClose={onClose} onOpenShop={onOpenShop} initialSlot={getKqEquipmentDefinition(initialEquipmentCode??"")?.slot}/>;
}
