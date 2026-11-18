import type { CSSProperties } from "react";
import { getKqWarehouseDevice } from "@/lib/kanab-quest-warehouse-catalog";
import { getKqWarehouseProductArtwork } from "@/lib/kanab-quest-warehouse-product-artwork";
import { getKqWarehouseOption } from "@/lib/kanab-quest-warehouse-options";
import { BAY_WIDTH, bayOrigin, plantSeed, plantStage, type KqGrowRoomZone } from "./KqGrowRoomModel";

const INK = "#34463c";
const grain = (id: string, name: string) => `url(#${id}-${name})`;
const href = (id: string, name: string) => `#${id}-${name}`;

// The room and furniture use one oblique camera. Increasing depth moves right and up.
function point(x: number, depth: number, height = 0) {
  return [x + depth * .43, 218 - depth * .42 - height];
}
function face(points: number[][]) { return points.map(p => p.join(",")).join(" "); }

function Box({ x, z, h = 0, w, d, rise, colors }: { x: number; z: number; h?: number; w: number; d: number; rise: number; colors: [string, string, string] }) {
  const a = point(x, z, h), b = point(x + w, z, h), c = point(x + w, z + d, h);
  const at = point(x, z, h + rise), bt = point(x + w, z, h + rise), ct = point(x + w, z + d, h + rise), dt = point(x, z + d, h + rise);
  return <g stroke={INK} strokeWidth="1.3" strokeLinejoin="round">
    <polygon fill={colors[0]} points={face([at, bt, ct, dt])} />
    <polygon fill={colors[2]} points={face([b, c, ct, bt])} />
    <polygon fill={colors[1]} points={face([a, b, bt, at])} />
  </g>;
}

export function GrowRoomDefinitions({ id }: { id: string }) {
  return <defs>
    <linearGradient id={id+"-wall"} x2=".25" y2="1"><stop stopColor="#f2e4bc"/><stop offset=".65" stopColor="#e1d2ac"/><stop offset="1" stopColor="#c6bb96"/></linearGradient>
    <linearGradient id={id+"-floor"} x2=".12" y2="1"><stop stopColor="#b0aa8c"/><stop offset=".4" stopColor="#d7c8a9"/><stop offset="1" stopColor="#f3dcac"/></linearGradient>
    <linearGradient id={id+"-light"} x2=".1" y2="1"><stop stopColor="#ffeab0" stopOpacity=".65"/><stop offset="1" stopColor="#ffea9e" stopOpacity=".03"/></linearGradient>
    <linearGradient id={id+"-sky"} x2="0" y2="1"><stop stopColor="#7bc0bf"/><stop offset="1" stopColor="#e4e8ba"/></linearGradient>
    <linearGradient id={id+"-post"} x2="1" y2=".15"><stop stopColor="#806a4c"/><stop offset=".16" stopColor="#b89166"/><stop offset=".64" stopColor="#caa879"/><stop offset="1" stopColor="#8e7558"/></linearGradient>
    <linearGradient id={id+"-glass"} x2=".15" y2="1"><stop stopColor="#88baba"/><stop offset="1" stopColor="#d2dcb5"/></linearGradient>
    <pattern id={id+"-plaster"} width="65" height="34" patternUnits="userSpaceOnUse">
      <path d="m2 17 7-1m15 13 1-.5m21-24 3 0m-4 8 6-1m7 16 2 0" stroke="#8c7958" strokeWidth=".8" opacity=".28"/><path d="m11 5 8-1m9 13 7-1" stroke="#fff4cf" opacity=".64"/>
    </pattern>
    <pattern id={id+"-tile"} width="84" height="30" patternUnits="userSpaceOnUse" patternTransform="skewX(-45)">
      <path d="M0 0H84M0 15h84M0 0v15m42 0v15" stroke="#7d826f" opacity=".5" fill="none" strokeWidth="1.2"/><path d="M2 1H84M1 1V14m0 2h83m-41 0v14" stroke="#f6e8c3" opacity=".55" fill="none"/>
      <path d="M18 6h10m35 17h8m-27-3h3m33-13h3" stroke="#9a8764" opacity=".3" strokeWidth=".8"/>
    </pattern>
    <pattern id={id+"-timber"} width="48" height="9" patternUnits="userSpaceOnUse">
      <rect width="48" height="9" fill="#b98759"/><path d="M0 2q12-1 21 .5T48 2M8 7q7-2 13-1m5-2 6 .3" strokeWidth=".65" stroke="#7c6247" fill="none"/>
    </pattern>
    <g id={id+"-leaf"} strokeLinejoin="round">
      <path d="M0 0Q4-5 8-6l-1 2 5-3-1 2 5-2-1 2 6-1q-2 5-6 7l1-2-5 3 .4-2Q5 3 0 0Z" fill="var(--leaf)" stroke="#315744" strokeWidth=".8"/>
      <path d="M1 0q9-.6 19-6" stroke="#cadb92" strokeWidth=".6" fill="none"/>
    </g>
    <g id={id+"-bud"} stroke="#536642" strokeWidth=".75">
      <path d="M0 1q-5-1-4-5-3-1-1-4-1-3 2-4 0-3 2-4 4 2 3 5 3 0 2 4 3 4 0 6Z" fill="var(--bud)"/>
      <path d="m-3-5 3-2m-2-2 2-2m.2 8 2-2" stroke="#f4c981" fill="none"/>
    </g>
  </defs>;
}

export function GrowRoomShell({ id, left, width, count }: { id: string; left: number; width: number; count: number }) {
  const start = left - 4, end = left + width + 4;
  return <g strokeLinejoin="round">
    <rect x={start} width={width+8} height="166" fill={grain(id,"wall")}/>
    <rect x={start} width={width+8} height="166" fill={grain(id,"plaster")}/>
    <path d={`M${start} 143 H${end} V163 H${start}Z`} fill="#899c89"/>
    <path d={`M${start} 146 H${end} M${start} 161 H${end}`} stroke="#516d61" strokeWidth="1.5"/>
    <rect x={start} y="164" width={width+8} height="96" fill={grain(id,"floor")}/>
    <rect x={start} y="164" width={width+8} height="96" fill={grain(id,"tile")}/>
    <path d={`M${start} 8H${end}v14H${start}Z`} fill="#8d7756" opacity=".22"/>
    <path d={`M${start} 4H${end}V15H${start}Z`} stroke="#665a44" strokeWidth="1.5" fill={grain(id,"timber")}/>
    {Array.from({ length: count }, (_, i) => {
      const x = left + i * BAY_WIDTH;
      return <g key={x}>
        <g transform={`translate(${x+237} 0)`}>
          <path d="M-3 7h11v154l-10 3Z" fill="#8e896b" opacity=".3"/>
          <path d="M-6 10h8v152h-8Z" fill={grain(id,"post")} stroke="#665a46" strokeWidth="1.05"/>
          <path d="m-5 11-30 13 3 5L1 14Z" fill={grain(id,"timber")} stroke="#706149" strokeWidth="1"/>
          <path d="m-4 118 2-27m1 9 1-55m-4 97 .8-12" stroke="#846e52" fill="none" strokeWidth=".9"/>
          <path d="M-7 155h10v7H-7Z" fill="#75897b" stroke={INK} strokeWidth=".9"/>
          <circle cx="-2" cy="158" r="1" fill="#cfceb0"/>
        </g>
        <g transform={`translate(${x+63} 106)`} fill="#ba936e" fillOpacity=".59" stroke="#a68b6a" strokeWidth=".55">
          <path d="m1 1 16-1-1 5-15 .5Zm18 0 11-1 1 4-12 1ZM-5 7l12-1v4l-13 .5Zm14-.7 15-.5-.5 4-15 .5Z"/>
        </g>
        <g transform={`translate(${x+48} 27)`} stroke={INK} strokeLinejoin="round">
          <path d="M0 1 77 0 78 45 0 46Z" fill="#bda57a" strokeWidth="1.6"/>
          <rect x="3" y="3" width="71" height="39" fill={grain(id,"sky")}/>
          {i===0 && left===0 && <circle cx="20" cy="13" r="6.2" fill="#ffdd91" stroke="none"/>}
          <path d="M4 31q10-10 18-5l12-12 13 14q13-7 27-7v20H4Z" fill="#77a894" stroke="none"/>
          <path d="m4 35 9-8 9 4 8-3 16 8 14-7 14 3v9H4Z" fill="#527f71" stroke="none"/>
          <path d="M13 41q2-4 11-6t9-5q-2 5-10 7l-5 4Z" fill="#c3c691" stroke="none"/>
          {i===1 && <g stroke="#667c69" strokeWidth=".7"><path d="M47 36v-9h13v10Z" fill="#eee1b9"/><path d="m45 28 8-7 9 7Z" fill="#ae8165"/><path d="M52 36v-4h3v4" fill="#799990"/></g>}
          {i===2 && <g fill="#608c74" stroke="none"><path d="m21 22-7 13h5l-5 5h15l-5-6h5Z"/><path d="m12 27-6 10h4l-3 4h12l-4-5h3Z"/></g>}
          <path d="M4 13h69M36 3v39" stroke="#d0b891" strokeWidth="3"/>
          <path d="m10 9 5-3m3 7 6-5m30 10 6-5" stroke="#f8f0cd" strokeWidth="2" opacity=".64"/>
          <path d="m-3 44 84-1-2 6-83 1Z" fill={grain(id,"timber")}/>
        </g>
        <path d={`M${x+145} 20h79q7 0 7 7v14`} stroke="#758777" strokeWidth="4" fill="none"/>
        <path d={`M${x+145} 19h79q7 0 7 7`} stroke="#e2dfb9" strokeWidth="1.5" fill="none"/>
        <path d={`M${x+189} 17v6m23-6v6`} stroke="#536558" strokeWidth="2"/>
      </g>;
    })}
    <g transform={`translate(${end-74} 36)`} stroke={INK} strokeLinejoin="round">
      <path d="M1 1 54 0l-1 126-52 2Z" fill="#6f806d" strokeWidth="2.4"/>
      <path d="m5 5 45-.6-.8 118-45 .8Z" fill="#bea47a" strokeWidth="1.2"/>
      <path d="m8 8 39-.5v56l-39 1Z" fill={grain(id,"glass")} strokeWidth="1.5"/>
      <path d="m9 56 7-9 6 4 10-12 14 10v13l-37 1Z" fill="#79a28a" stroke="none"/>
      <path d="m10 61 8-5 6 3 10-6 12 3v6H10Z" fill="#648572" stroke="none"/>
      <path d="M9 34h36M26 9l.4 54" stroke="#c5ad85" strokeWidth="2.3"/>
      <path d="m10 72 32-1-1 43-31 1Z" fill="#b0956f" stroke="#887b60"/>
      <path d="m14 77 23-1m-22 29 20-.5M15 21l5-5" fill="none" stroke="#e0caa4"/>
      <path d="M39 66v6m-3-4h6" stroke="#485b50" strokeWidth="2.3"/>
      <path d="m-3 128 55-1 4-2-55 1Z" fill="#889a85" strokeWidth=".9"/>
    </g>
    {left === 0 && <g stroke={INK} strokeWidth="1.4">
      <path d="M0 0 49 14 49 164 0 213Z" fill="#c9bc97"/><path d="M0 0 49 14 49 164 0 213Z" fill={grain(id,"plaster")}/>
      <path d="m4 76 25-15v120L4 202Z" fill="#708876"/><path d="m7 83 19-12v101L7 188Z" fill="#8f9d80"/>
      <path d="m8 102 16-10m-16 25 16-10m-16 24 16-9" stroke="#667b69"/><circle cx="21.5" cy="128" r="2" fill="#eccb80"/>
      <path d="m0 4 49 10v8L0 10Z" fill={grain(id,"timber")}/>
    </g>}
  </g>;
}

function Plant({ id, stage, variant }: { id: string; stage: ReturnType<typeof plantStage>; variant: number }) {
  if (stage === "empty" || stage === "complete" || stage === 5) return null;
  if (stage === "dead") return <g stroke="#796447" strokeWidth="1.8" fill="#9b8055">
    <path d="M0 0q2-11-3-17m4 10q9-8 13-1M0-9q-8-8-12-2" fill="none"/>
    <path d="M13-9q5 4 3 10-5-3-3-10Zm-24-4q-6 4-5 9 6-1 5-9Z"/>
  </g>;
  if (stage === 0) return <g stroke="#365d45" strokeWidth="1.25"><path d="M0 1q-1-5 1-8" fill="none"/>
    <path d="M1-5q-9 0-10-7 8-1 10 7Zm0-1q2-9 9-9-1 6-9 9Z" fill="#bad47f"/></g>;
  const height = [0, 20, 39, 51, 55][stage] + variant % 4;
  const levels = stage === 1 ? 2 : stage === 2 ? 4 : 5;
  const direction = variant % 2 ? -1 : 1;
  return <g transform={`scale(${direction*(.89+variant%5*.055)} 1) rotate(${variant%7-3})`}>
    <path d={`M0 0Q-2 ${-height*.5} 2 ${-height}`} stroke="#426043" fill="none" strokeWidth={stage < 2 ? 1.6 : 2.2}/>
    {Array.from({ length: levels }, (_, n) => {
      const t = n / levels, y = -height * (.19 + t * .79);
      const reach = (stage === 1 ? 5 : 13) * (1 - t * .6);
      const scale = (stage === 1 ? .50 : .84) * (1 - t * .44);
      return [-1,1].map(side => <g key={n+"-"+side} transform={`translate(0 ${y+side*1.7}) scale(${side} 1)`}>
        <path d={`M0 1 Q${reach*.65} 0 ${reach} -5`} fill="none" stroke="#496b44" strokeWidth="1.3"/>
        <g transform={`translate(${reach} -5) scale(${scale})`}>
          {[-34, 0, 36].map((angle,j) => <use key={angle} href={href(id,"leaf")} transform={`rotate(${angle}) scale(${j===1 ? 1 : .75})`}/>)}
          {stage >= 3 && n % 2 === 0 && <use href={href(id,"bud")} transform={`scale(${stage === 4 ? .83 : .54})`}/>}
        </g>
      </g>);
    })}
    {stage >= 3 && <use href={href(id,"bud")} transform={`translate(2 ${-height+3}) scale(${stage === 4 ? 1.05 : .72})`}/>}
  </g>;
}

function Pot({ x, z, support }: { x: number; z: number; support?: string }) {
  const [px, py] = point(x,z,17);
  return <g transform={`translate(${px} ${py})`} stroke={INK} strokeWidth="1" strokeLinejoin="round">
    <ellipse cx="4" cy="1" rx="14" ry="3" fill="#655a43" opacity=".23" stroke="none"/>
    <path d="m-9-12 18 0-2 12Q0 3-7 0Z" fill={support ? "#51665b" : "#b67550"}/>
    <path d="m-8-10 3 8m10-8-1.2 7" stroke={support ? "#9bafa0" : "#e4a070"} fill="none"/>
    <ellipse cy="-12" rx="10" ry="3.6" fill={support ? "#819886" : "#d89462"}/>
    <ellipse cy="-12" rx="7.7" ry="2" fill="#594738" stroke="none"/>
  </g>;
}

function DryingRail({ id, complete }: { id: string; complete: boolean }) {
  if (complete) return <g>
    {[0,1].map(i => <g key={i}><Box x={42+i*48} z={49+i*8} h={15} w={38} d={17} rise={15} colors={["#d5b77e","#bd975e","#947849"]}/>
      <path d={`M${65+i*51} ${172-i*3}h28m-25 4h23`} fill="none" stroke="#7b714b" strokeWidth="1"/></g>)}
  </g>;
  return <g transform="translate(58 109)" stroke={INK} strokeWidth="2" fill="none">
    <path d="M1 68V3l114-2v67m-114-63 9-10h114v66M2 6h113" stroke="#53665c"/>
    {[14,34,54,75,96].map((x,i) => <g key={x} transform={`translate(${x} 7)`}>
      <path d={`M0 0q-4 16 1 ${40-i%3*4}m-2-23-6 11m7-4 5 7`} stroke="#877748" strokeWidth="1.6"/>
      {[[-6,29],[5,34],[1,41]].map(([dx,dy]) => <use key={dx} href={href(id,"bud")} transform={`translate(${dx} ${dy-i%3*4}) rotate(175) scale(.86)`}/>)}
    </g>)}
  </g>;
}

function Fixture({ id, zone }: { id: string; zone: KqGrowRoomZone }) {
  const light = zone.lightingCode, air = zone.airCode;
  const illuminated = zone.powered !== false && (zone.status === "growing" || (!zone.status && typeof plantStage(zone) === "number"));
  const opts = [...new Set([...(zone.optionCodes ?? []), ...(zone.supportCode ? [zone.supportCode] : [])])];
  const tier = light ? getKqWarehouseDevice(light)?.tier ?? (light === "LED-500" ? "premium" : light === "LED-300" ? "standard" : "economy") : null;
  return <g strokeLinejoin="round">
    {light && <g data-grow-equipment={light}>
      <path d="M84 14v35m81-35v35" stroke="#5f6b60" strokeWidth="1.15"/>
      <path d="m74 52 83 0 14-8-83 0Z" fill="#6c8277" stroke={INK} strokeWidth="1.6"/>
      {Array.from({ length: tier === "premium" ? 6 : tier === "standard" ? 2 : 1 }, (_, i) => {
        const n = tier === "premium" ? 6 : tier === "standard" ? 2 : 1, w = 83/n;
        return <path key={i} d={`M${73+i*w} 51h${w-1.6}l11-6h${-w+1.6}Z`} fill="#dbd9bc" stroke={INK} strokeWidth="1"/>;
      })}
      <path d="M73 51h83v3H73Z" fill={illuminated?"#ffe499":"#9caaa1"} stroke={INK}/>
      {illuminated && <path d="m73 55 83 0 44 111-166 0Z" fill={grain(id,"light")}/>}
    </g>}
    {air && <g data-grow-equipment={air}>
      <path d="M203 86v-17q0-12-15-12h-6" stroke="#4e645b" fill="none" strokeWidth="9"/>
      <path d="M202 84V69q0-10-14-11h-5" stroke="#a3b6a7" fill="none" strokeWidth="6" strokeDasharray="2.3 1.4"/>
      <image href={getKqWarehouseProductArtwork(air)?.src ?? (air.includes("STARTER") ? "/placard/warehouse-v2/air-starter.webp" : "/placard/warehouse-v2/air-pro.webp")} x="183" y="69" width="40" height="35"/>
    </g>}
    {opts.map((code,i) => {
      const art = getKqWarehouseProductArtwork(code);
      if (!art) return null;
      const shelf = i % 4;
      return <g key={code} data-grow-equipment={code} transform={`translate(${179+shelf*13} ${i<4?131:148})`}>
        <path d="m-2 1 17 0 4-2" stroke="#7c7760" strokeWidth="2"/>
        <image href={art.src} x="-1" y="-15" width="18" height="16"/>
      </g>;
    })}
  </g>;
}

export function GrowRoomBay({ zone, index, id, selected }: { zone: KqGrowRoomZone; index: number; id: string; selected: boolean }) {
  const stage = plantStage(zone);
  const seed = plantSeed(zone.variety || zone.id);
  const support = zone.supportCode ?? zone.optionCodes?.find(code => getKqWarehouseOption(code)?.family === "substrate");
  const colors = [["#78a467","#c2bb7c"],["#629862","#caa58a"],["#549773","#c6bd73"],["#819654","#ae99aa"]][seed%4];
  const foliage = stage === 4 ? ["#9aa464","#91a165","#81a06d","#ad9f5b"][seed%4] : colors[0];
  return <g transform={`translate(${bayOrigin(index)} 0)`} style={{ "--leaf":foliage, "--bud":colors[1] } as CSSProperties} data-grow-stage={stage} data-grow-bay={zone.id}>
    <Fixture id={id} zone={zone}/>
    <polygon points={face([point(12,10),point(160,10),point(173,90),point(14,90)])} fill="#726d51" opacity=".24"/>
    {[32,120,148].map((x,i) => <Box key={x} x={x} z={i===1?75:30} w={5} d={6} rise={21} colors={["#abb4a0","#738a76","#53685c"]}/>)}
    <Box x={22} z={27} h={12} w={145} d={65} rise={5} colors={["#aea87e","#b7aa79","#8a8d69"]}/>
    {stage === 5 || stage === "complete" ? <DryingRail id={id} complete={stage === "complete"}/> :
      [75,42].map((z,row) => [40,85,131].map((x,col) => {
        const [sx,sy] = point(x,z,29), variant = (seed+row*7+col*3)%17;
        return <g key={x+"-"+z}><Pot x={x} z={z} support={support}/>
          <g transform={`translate(${sx} ${sy}) scale(${.9+(variant%4)*.035})`}><Plant id={id} stage={stage} variant={variant}/></g></g>;
      }))}
    <path d="m34 188 144 0" stroke={selected?"#f3c859":"#bcc3a9"} strokeWidth="2.3"/>
    <Box x={184} z={27} h={0} w={4} d={4} rise={26} colors={["#97a896","#667f73","#516a62"]}/>
    <Box x={213} z={31} h={0} w={4} d={4} rise={26} colors={["#97a896","#667f73","#516a62"]}/>
    <Box x={180} z={23} h={25} w={38} d={18} rise={3} colors={["#d5b07a","#ab865f","#847456"]}/>
    <path d="m202 180 16 0 3-2-16 0Z" fill="#6e8876" stroke={INK} strokeWidth=".8"/>
    {Boolean(zone.effects?.length) && <g transform="translate(149 187)" data-grow-effect-count={zone.effects?.length}>
      <path d="m-8-3 12-1 4 5-4 5H-8Z" fill="#4d8172" stroke={INK}/><path d="m-4 1 2 3 5-5" stroke="#fff2bb" strokeWidth="1.5" fill="none"/>
    </g>}
    {zone.attention && <g transform="translate(179 164)" aria-hidden="true"><circle r="7" fill="#ffcf77" stroke={INK}/><path d="M0-4v5m0 2v1" stroke={INK} strokeWidth="2"/></g>}
    <path d="m14 211 155 0" stroke={selected ? "#a27d33" : "#8c9783"} strokeDasharray="7 4" strokeWidth="1.3"/>
  </g>;
}
