"use client";

import Image from "next/image";
import { useEffect, useRef, type CSSProperties } from "react";
import { getKqEquipmentAtLevel, KQ_EQUIPMENT_SLOT_LABELS, type KqEquipmentSlot } from "@/lib/kanab-quest-equipment";
import styles from "./KqWarehouseScene.module.css";

export const WAREHOUSE_ZONES: readonly {slot:KqEquipmentSlot;left:number;top:number;width:number;tile:number}[] = [
  {slot:"tent",left:30,top:25,width:37,tile:0},
  {slot:"lighting",left:39,top:32,width:15.5,tile:2},
  {slot:"air",left:53,top:18,width:10,tile:4},
  {slot:"climate-controller",left:63,top:43,width:5.5,tile:6},
  {slot:"security",left:18,top:21,width:7.5,tile:8},
  {slot:"energy",left:18,top:82,width:11,tile:7},
  {slot:"press",left:2,top:40,width:10,tile:10},
  {slot:"sifting",left:12,top:43,width:8,tile:12},
  {slot:"washing",left:3,top:65,width:12,tile:11},
  {slot:"filtration",left:18,top:66,width:7,tile:13},
  {slot:"static-separation",left:3,top:24,width:6,tile:13},
  {slot:"drying",left:65,top:75,width:11,tile:14},
  {slot:"flower-drying",left:79,top:35,width:10.5,tile:15},
];

// Explicit source rectangles exclude neighbouring atlas objects and their padding.
// The last rectangle contains hanging branches only: the room already has rails.
const SPRITE_RECTS = [
  [18,30,278,281], [327,27,288,286], [632,54,291,216], [943,54,294,229],
  [20,377,274,190], [321,343,297,250], [652,326,251,276], [933,342,309,269],
  [21,639,273,245], [341,601,240,310], [650,623,266,282], [954,622,288,292],
  [20,951,284,249], [337,944,252,264], [633,930,286,282], [982,973,214,178],
] as const;

function spriteStyle(tile:number):CSSProperties {
  const [x,y,width,height] = SPRITE_RECTS[tile];
  return {
    backgroundSize:`${1254/width*100}% ${1254/height*100}%`,
    backgroundPosition:`${x/(1254-width)*100}% ${y/(1254-height)*100}%`,
  };
}

export function KqWarehouseScene({equippedCodes,levels,selectedSlot,onSelect,disabled=false}:{
  equippedCodes:string[];levels:Record<string,number>;selectedSlot:KqEquipmentSlot;onSelect:(slot:KqEquipmentSlot)=>void;disabled?:boolean;
}) {
  const viewport=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const element=viewport.current,zone=WAREHOUSE_ZONES.find(item=>item.slot===selectedSlot);
    const center=selectedSlot==="security"&&equippedCodes.includes("SECURITY-DOG")?88:zone?zone.left+zone.width/2:50;
    if(element&&zone)element.scrollLeft=element.scrollWidth*center/100-element.clientWidth/2;
  },[selectedSlot,equippedCodes]);
  return <div ref={viewport} className={styles.viewport}>
    <div className={styles.scene} aria-label="Les emplacements de ton entrepôt">
      <Image src="/placard/warehouse-room-v1.webp" alt="Entrepôt avec une box de culture au centre, un établi à gauche et une pièce séchoir à droite" fill sizes="(max-width: 700px) 760px, 1100px" priority className={styles.background}/>
      {equippedCodes.some(code=>getKqEquipmentAtLevel(code)?.slot==="air")?<span className={styles.airDuct} aria-hidden="true"/>:null}
      {WAREHOUSE_ZONES.map(zone=>{
        const installed=equippedCodes.map(code=>getKqEquipmentAtLevel(code,levels[code])).find(item=>item?.slot===zone.slot);
        const level=installed?.purchasable?levels[installed.code]??1:1;
        const dog=installed?.code==="SECURITY-DOG";
        const tile=dog?9:zone.tile+(installed&&["tent","lighting","air"].includes(zone.slot)&&!installed.code.includes("STARTER")?1:0);
        const room=zone.slot==="flower-drying";
        return <button type="button" key={zone.slot} data-warehouse-slot={zone.slot} disabled={disabled}
          className={styles.zone} data-installed={!!installed} data-selected={selectedSlot===zone.slot} data-tier={level>=10?3:level>=5?2:1} data-room={room||undefined}
          style={{left:`${dog?83:zone.left}%`,top:`${dog?76:zone.top}%`,width:`${dog?10:zone.width}%`,aspectRatio:room?".44":`${SPRITE_RECTS[tile][2]}/${SPRITE_RECTS[tile][3]}`}}
          aria-pressed={selectedSlot===zone.slot} aria-label={`${KQ_EQUIPMENT_SLOT_LABELS[zone.slot]} · ${installed?`${installed.name}, ${installed.purchasable?`niveau ${level}`:"fourni"}`:"emplacement libre"}`} onClick={()=>onSelect(zone.slot)}>
          <span className={styles.sprite} style={spriteStyle(tile)} aria-hidden="true"/>
          {!installed?<span className={styles.emptyMarker} aria-hidden="true">+</span>:null}
          {room&&installed&&level>=5?<span className={`${styles.sprite} ${styles.extraRack}`} style={spriteStyle(15)} aria-hidden="true"/>:null}
          <span className={styles.label}>{KQ_EQUIPMENT_SLOT_LABELS[zone.slot]}<small>{installed?(installed.purchasable?`Niv. ${level}`:"Fourni"):"+ Installer"}</small></span>
        </button>;
      })}
    </div>
  </div>;
}
