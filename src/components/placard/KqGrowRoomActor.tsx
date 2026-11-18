import { useEffect, useRef } from "react";
import { CHANVRIER_CLOTHES, CHANVRIER_SKINS, getChanvrierAppearance, type ChanvrierAvatarProfile } from "@/lib/arena-chanvrier";
import type { ChanvrierStampPose } from "../contest/chanvrier-snapshot";
import { bayOrigin, growRoomGestureDuration, type KqGrowRoomEvent } from "./KqGrowRoomModel";
import styles from "./KqGrowRoom.module.css";

const INK = "#34463c";
const AISLE = 221;
const STATION = 207;
const visitor = { gender:"male", skin:"peach", clothing:"sage" } as const;
const cloth = (code: string) => CHANVRIER_CLOTHES.find(color => color.code === code)?.color ?? "#758e71";
type Position = { x: number; y: number };
type Gesture = KqGrowRoomEvent["gesture"];
const translate = (x: number, y: number) => `translate(${x.toFixed(2)} ${y.toFixed(2)})`;

function VisitorFace() {
  return <g className={styles.face}>
    <g className={styles.visitorHead} stroke={INK} strokeWidth="1.3">
      <path d="M-8-75q-1-11 8-11 14 2 11 14l3 4-4 1q-1 8-9 7-8-2-9-15Z" fill="#c79066"/>
      <path d="M-11-75q-2-14 10-15 10-1 14 9l-13-1-6 6Z" fill="#587c70"/>
      <path d="M-3-82q7-4 18 1l-3 3-14-1Z" fill="#94a790"/><circle cx="6" cy="-74" r="1.2"/>
    </g>
  </g>;
}

function heldTool(gesture: Gesture) {
  switch (gesture) {
    case "water": case "pour": return <g fill="#5a998e"><path d="M0 0q-8-3-6 3m0-2h12l1 9H-7Z"/><path d="m5 5 9-5 1 2-8 7"/><path d="m15 4 2 2m0 2 1 2" stroke="#78b7bc"/></g>;
    case "spread": return <g><path d="M-4-1 8 0q4-3 11-1-2 7-11 4L-4 1Z" fill="#b7c6b3"/><path d="m8 0 4-3 6 2-3 2Z" fill="#93673e"/><path d="m20 3 1 1m2 3h1m-4 1 1 1" stroke="#7f5838" strokeWidth="1.8"/></g>;
    case "sweep": return <g><path d="m-5-11 17 44" stroke={INK} strokeWidth="3.3"/><path d="m-5-11 17 44" stroke="#c59a63" strokeWidth="1.8"/>
      <path d="m5 29 13-5 5 7-15 6Z" fill="#dab05f"/><path d="m9 30 2 4m2-6 2 5m2-6 2 4" fill="none" stroke="#976b3b"/></g>;
    case "pbi": return <g><path d="m-5-2 10 1-1 13-9-1Z" fill="#f3db9b"/><path d="m-4 0 8 1m-6 4 2 2 2-3" fill="none" stroke="#397258"/></g>;
    case "repair": return <path d="m-1 1 7-11q-1-4 3-6v4l3 1 2-3q2 6-4 7L3 2Z" fill="#a8b4a4"/>;
    case "harvest": return <g fill="#e5a55c"><path d="M0 0 12-10 5-1l9-2-10 5Z" fill="#d9decb"/><circle r="2.3"/><circle cx="2" cy="4" r="2.1"/></g>;
    case "card": return <g transform="rotate(12)"><rect x="-3" y="-9" width="9" height="12" rx="1" fill="#f4dfa6"/><path d="m-1-4 2-2 2 2-2 2Z" fill="#4f9178"/></g>;
    case "dice": return <path d="m-2-4 3-2 4 2-1 4-3 2-4-2Zm0 0 3 2 4-2m-4 2v4" fill="#f8e9b5"/>;
    case "inspect": return <g><circle cx="4" cy="-5" r="4" fill="#bbded3" fillOpacity=".7"/><path d="m1-2-3 4" strokeWidth="2"/></g>;
    default: return null;
  }
}

function drawLeg(group: SVGGElement, side: number, foot: Position, hipY: number, bottom: string) {
  const hx = side*3, hy = hipY;
  const ky = hy + (foot.y - hy)*.54;
  const kx = hx + (foot.x-hx)*.55 + 2 + Math.max(0,-foot.y)*.4;
  const leg = group.querySelector("path")!;
  leg.setAttribute("d",`M${hx} ${hy} Q${kx-1} ${ky-1} ${(kx+foot.x)/2} ${(ky+foot.y-3)/2} L${foot.x} ${foot.y-3}`);
  const cuff = group.querySelector("path:nth-child(2)")!;
  cuff.setAttribute("d",`M${hx} ${hy} L${bottom === "shorts" || bottom === "skirt" ? kx : foot.x} ${bottom === "shorts" || bottom === "skirt" ? ky-2 : foot.y-4}`);
  group.querySelector("g")!.setAttribute("transform",translate(foot.x,foot.y));
}

function drawArm(group: SVGGElement, shoulder: Position, hand: Position) {
  const elbowX = (shoulder.x+hand.x)*.5 - 3.3, elbowY = (shoulder.y+hand.y)*.5 + 3.7;
  const arm = `M${shoulder.x} ${shoulder.y}Q${elbowX} ${elbowY+1.2} ${hand.x} ${hand.y}`;
  const sleeve = `M${shoulder.x} ${shoulder.y}L${elbowX} ${elbowY}`;
  const parts = group.children;
  parts[0].setAttribute("d",arm); parts[1].setAttribute("d",arm); parts[2].setAttribute("d",sleeve);
  parts[3].setAttribute("cx",String(hand.x)); parts[3].setAttribute("cy",String(hand.y));
}

/** During the contact half of each stride, world translation exactly cancels the foot's offset. */
function footOffset(distance: number, side: number) {
  const stride = 20;
  const phase = (distance / stride + (side > 0 ? .5 : 0)) % 1;
  const swing = (phase-.5)*2;
  return phase < .5 ? { along:stride*(.25-phase), lift:0 } :
    { along:-stride*.25*Math.cos(swing*Math.PI), lift:4.2*Math.sin(swing*Math.PI) };
}

type ActorProps = { index: number; stage: number | null; event?: KqGrowRoomEvent | null; profile?: ChanvrierAvatarProfile | null;
  motion: boolean; visible: boolean; left: number; width: number };
export function GrowRoomActor({ index, stage, event, profile, motion, visible, left, width }: ActorProps) {
  const root = useRef<SVGGElement>(null);
  const sprite = useRef<HTMLCanvasElement>(null);
  const position = useRef<Position | null>(null);
  const distance = useRef(0);
  const completed = useRef("");
  const look = getChanvrierAppearance(profile ?? visitor);
  const shirt = cloth(profile?.clothing ?? visitor.clothing), trousers = cloth(look.bottomColor), shoes = cloth(look.shoeColor);
  const skin = CHANVRIER_SKINS.find(s => s.code === (profile?.skin ?? visitor.skin))!.color;
  const gesture = event?.gesture ?? "inspect";
  const accepted = !!event;
  const token = JSON.stringify([index, event?.zoneId, event?.id, gesture]);
  const anchor = bayOrigin(index);
  const atTable = gesture === "dice" || gesture === "card";
  const targetX = anchor + (atTable ? 184 : gesture === "repair" ? 173 : gesture === "sweep" ? 126 : 83);
  const targetY = gesture === "sweep" ? AISLE : STATION;
  const facing = atTable || gesture === "repair" ? 1 : -1;
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const rig = node.querySelector<SVGGElement>("[data-rig]")!, body = node.querySelector<SVGGElement>("[data-body]")!;
    const legs = Array.from(node.querySelectorAll<SVGGElement>("[data-leg]")), arms = Array.from(node.querySelectorAll<SVGGElement>("[data-arm]"));
    const tool = node.querySelector<SVGGElement>("[data-tool]")!;
    const controller = new AbortController();
    let pending: ChanvrierStampPose | undefined, painting = false, lastStamp = "";
    const paintStamp = async () => {
      if (!profile || painting) return;
      painting = true;
      try {
        const { renderChanvrierSnapshot } = await import("../contest/chanvrier-snapshot");
        while (pending && !controller.signal.aborted) {
          const pose = pending;
          pending = undefined;
          const stamp = await renderChanvrierSnapshot({ profile, view: "full", width: 144, pose }, controller.signal);
          const canvas = sprite.current;
          if (canvas && !controller.signal.aborted) {
            const context = canvas.getContext("2d");
            context?.clearRect(0, 0, canvas.width, canvas.height);
            context?.drawImage(stamp, 0, 0, canvas.width, canvas.height);
          }
        }
      } catch { /* Unmount cancels any outstanding portrait job. */ }
      finally { painting = false; }
    };
    const start = position.current ?? { x: Math.max(left+10,targetX-42), y:AISLE };
    const pos = { x:Math.max(left-17,Math.min(left+width+17,start.x)), y:start.y };
    const waypoints: Position[] = [];
    if (Math.abs(pos.x-targetX)>7) {
      waypoints.push({ x:pos.x, y:AISLE },{ x:targetX, y:AISLE });
    }
    waypoints.push({ x:targetX, y:targetY });
    let waypoint = 0, last = 0, elapsed = 0, request = 0;
    let direction = Math.abs(targetX-pos.x)>2 ? Math.sign(targetX-pos.x) : facing;
    function paint(walking: boolean, dx: number, dy: number, gestureProgress: number) {
      const act = gestureProgress>=0 && gestureProgress<1;
      const reach = act ? Math.sin(Math.PI*gestureProgress) : 0;
      const sweeping = gesture === "sweep";
      const work = act ? Math.sin(gestureProgress*Math.PI*(sweeping ? 6 : 4))*reach : 0;
      const low = !sweeping && (stage === 0 || stage === 1 || gesture === "water" || gesture === "pour" || gesture === "spread") && !atTable && gesture !== "repair";
      const crouch = (low ? 7 : 2)*reach;
      const bob = walking ? -.8*Math.abs(Math.sin(distance.current*Math.PI/10)) : 0;
      node!.setAttribute("transform",translate(pos.x,pos.y));
      rig.setAttribute("transform",`scale(${direction} 1)`);
      if (profile) {
        const walkFrame = walking ? Math.floor(distance.current / 2.5) % 8 : 0;
        const pose = { distance: walkFrame * .12, walking: Number(walking), gesture: act ? gesture : null,
          phase: act ? Math.round(gestureProgress * 12) / 12 : 0, stage };
        const key = JSON.stringify(pose);
        if (lastStamp !== key) { lastStamp = key; pending = pose; void paintStamp(); }
        node!.setAttribute("data-actor-state", walking ? "walking" : act ? gesture : "idle");
        position.current = { ...pos };
        return;
      }
      body.setAttribute("transform",translate(0,bob+crouch)+` rotate(${reach*(low?9:4)} 0 -29)`);
      node!.setAttribute("data-actor-state",walking ? "walking" : act ? gesture : "idle");
      legs.forEach((leg,i) => {
        const side = i===0 ? -1 : 1, foot = walking ? footOffset(distance.current,side) : { along:0, lift:0 };
        drawLeg(leg,side,{ x:side*4+dx*foot.along*direction, y:dy*foot.along-foot.lift },-29+bob+crouch,look.bottom);
      });
      const armSwing = walking ? 7*Math.sin(distance.current*Math.PI/10) : 0;
      const workHeight = sweeping ? -37 : atTable ? -31 : gesture === "repair" ? -49 : gesture === "pour" || gesture === "spread" ? -36 : stage === 0 ? -34 : stage===1 ? -40 : stage===2 ? -49 : -58;
      const hand = { x:5-armSwing+reach*(atTable?19:17) + (sweeping ? work*9 : 0), y:-34+reach*(workHeight+34)+work*2 };
      drawArm(arms[0],{ x:-4,y:-56 },sweeping && act ? { x:hand.x-3, y:hand.y-8 } : { x:-6+armSwing,y:-36-reach*4 });
      drawArm(arms[1],{ x:4,y:-56 },hand);
      tool.style.display = act ? "" : "none";
      tool.setAttribute("transform",translate(hand.x,hand.y)+` rotate(${gesture === "pour" ? reach*28 : work*(sweeping ? 16 : gesture === "water" ? 18 : 8)})`);
      position.current = { ...pos };
    }
    if (!visible) return;
    if (!motion) {
      pos.x=targetX; pos.y=targetY; direction=facing; completed.current=token;
      paint(false,0,0,accepted ? .47 : -1);
      return () => controller.abort();
    }
    const arrived = Math.abs(pos.x-targetX)<.05 && Math.abs(pos.y-targetY)<.05;
    if (arrived && completed.current===token) { direction=facing; paint(false,0,0,-1); return () => controller.abort(); }
    function frame(now: number) {
      const dt = last ? Math.min(40,now-last) : 0;
      last=now;
      while (waypoint<waypoints.length && Math.hypot(waypoints[waypoint].x-pos.x,waypoints[waypoint].y-pos.y)<.01) waypoint++;
      if (waypoint<waypoints.length) {
        const next=waypoints[waypoint], dx=next.x-pos.x, dy=next.y-pos.y, remaining=Math.hypot(dx,dy);
        const step=Math.min(remaining,dt*.105);
        if (Math.abs(dx)>1) direction=Math.sign(dx);
        pos.x+=dx/remaining*step; pos.y+=dy/remaining*step; distance.current+=step;
        paint(true,dx/remaining,dy/remaining,-1);
      } else {
        direction=facing;
        elapsed+=dt;
        const progress = completed.current===token ? 1 : Math.min(1,elapsed/(1000*growRoomGestureDuration(gesture)));
        paint(false,0,0,progress);
        if (progress===1) { completed.current=token; return; }
      }
      request=requestAnimationFrame(frame);
    }
    request=requestAnimationFrame(frame);
    return () => { controller.abort(); cancelAnimationFrame(request); };
  }, [accepted, atTable, facing, gesture, left, look.bottom, profile, motion, stage, targetX, targetY, token, visible, width]);

  function leg(side: number) {
    return <g data-leg={side} strokeLinecap="round" strokeLinejoin="round">
      <path stroke={skin} strokeWidth="6" fill="none"/><path stroke={trousers} strokeWidth="7.5" fill="none"/>
      <g><path d={look.shoes === "boots" || look.shoes === "high-tops" ? "M-4-8h6l.5 3.6 4 1.6q2 1 1 3H-4Z" : "M-4-4.5h6l5 2q2 1 1 2.5H-4Z"} fill={shoes} stroke={INK} strokeWidth="1"/>
        <path d="M-3 1h10" stroke="#e2d3af" strokeWidth="1.25"/></g>
    </g>;
  }
  function arm(side: number) {
    return <g data-arm={side} strokeLinecap="round" fill="none"><path stroke={INK} strokeWidth="6"/>
      <path stroke={skin} strokeWidth="4.5"/><path stroke={shirt} strokeWidth={look.top==="tee" ? 5.3:6}/>
      <circle r="2.5" fill={skin} stroke={INK} strokeWidth=".7"/></g>;
  }
  return <g ref={root} transform={translate(targetX,STATION)} data-grow-actor={profile?"player":"visitor"} aria-hidden="true">
    <ellipse cy=".5" rx="14" ry="3.3" fill="#435d4c" opacity=".27"/>
    <g data-rig="">{profile ? <foreignObject x="-36" y="-103" width="72" height="107">
      <canvas ref={sprite} width={144} height={213} style={{ width: "100%", height: "100%" }} />
    </foreignObject> : <><g>{leg(-1)}{leg(1)}</g>
      <g data-body="">{arm(-1)}
        <path d="M-6-59q5-4 11-1 6 8 5 16l1 14q-10 4-21 0l2-19Z" fill={shirt} stroke={INK} strokeWidth="1.5"/>
        {(look.top==="overalls" || look.top==="apron") && <path d="m-6-58 3-1 2 10h6l-1-10h2l3 15 1 14-19 .5 2-16Z" fill={look.top==="apron"?"#b7a279":trousers} stroke={INK} strokeWidth="1"/>}
        {look.top==="hoodie" && <path d="m-8-55-2-6q6-4 13-1l4 4-6 3-4 8-1-8Z" fill={shirt} stroke={INK}/>}
        {(look.top==="jacket" || look.top==="shirt") && <path d="m-4-59 4 4 4-5m-4 5 1 23m-7-16h4" fill="none" stroke={INK} strokeWidth="1"/>}
        {look.bottom==="skirt" && <path d="M-8-34h17l3 12q-10 3-23-.5Z" fill={trousers} stroke={INK}/>}
        {look.bottom==="cargo" && <path d="m-7-29 6 .5-1 5-5-.5Z" fill={trousers} stroke={INK} strokeWidth=".8"/>}
        <path d="M-5-66h9l1 8q-4 3-8 0Z" fill={skin} stroke={INK}/>
        <VisitorFace/>
        {look.accessory==="scarf" && <path d="m-7-61 13-1 1 3-8 3-3 9-4-2 4-9Z" fill="#ce9460" stroke={INK}/>}
        {arm(1)}
        <g data-tool="" style={{display:"none"}} stroke={INK} strokeWidth="1" strokeLinejoin="round">{heldTool(gesture)}</g>
      </g>
    </>}
    </g>
  </g>;
}
