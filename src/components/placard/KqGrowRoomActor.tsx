import { useEffect, useRef } from "react";
import type { ChanvrierAvatarProfile } from "@/lib/arena-chanvrier";
import type { ChanvrierStampPose } from "../contest/chanvrier-snapshot";
import { bayOrigin, growRoomGestureDuration, type KqGrowRoomEvent } from "./KqGrowRoomModel";
import { GROW_ROOM_VISITOR } from "./kq-grow-worker-profile";

const AISLE = 221;
const STATION = 207;
type Position = { x: number; y: number };
const translate = (x: number, y: number) => `translate(${x.toFixed(2)} ${y.toFixed(2)})`;

type ActorProps = { index: number; stage: number | null; event?: KqGrowRoomEvent | null; profile?: ChanvrierAvatarProfile | null;
  motion: boolean; visible: boolean; left: number; width: number };
export function GrowRoomActor({ index, stage, event, profile, motion, visible, left, width }: ActorProps) {
  const root = useRef<SVGGElement>(null);
  const sprite = useRef<HTMLCanvasElement>(null);
  const position = useRef<Position | null>(null);
  const distance = useRef(0);
  const completed = useRef("");
  const actorProfile = profile ?? GROW_ROOM_VISITOR;
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
    const rig = node.querySelector<SVGGElement>("[data-rig]")!;
    const controller = new AbortController();
    let pending: ChanvrierStampPose | undefined, painting = false, lastStamp = "";
    const paintStamp = async () => {
      if (painting) return;
      painting = true;
      try {
        const { renderChanvrierSnapshot } = await import("../contest/chanvrier-snapshot");
        while (pending && !controller.signal.aborted) {
          const pose = pending;
          pending = undefined;
          const stamp = await renderChanvrierSnapshot({ profile: actorProfile, view: "full", width: 144, pose }, controller.signal);
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
    function paint(walking: boolean, gestureProgress: number) {
      const act = gestureProgress >= 0 && gestureProgress < 1;
      node!.setAttribute("transform", translate(pos.x, pos.y));
      rig.setAttribute("transform", `scale(${direction} 1)`);
      const walkFrame = walking ? Math.floor(distance.current / 2.5) % 8 : 0;
      const pose = { distance: walkFrame * .12, walking: Number(walking), gesture: act ? gesture : null,
        phase: act ? Math.round(gestureProgress * 12) / 12 : 0, stage };
      const key = JSON.stringify(pose);
      if (lastStamp !== key) {
        lastStamp = key;
        pending = pose;
        void paintStamp();
      }
      node!.setAttribute("data-actor-state", walking ? "walking" : act ? gesture : "idle");
      position.current = { ...pos };
    }
    if (!visible) return;
    if (!motion) {
      pos.x=targetX; pos.y=targetY; direction=facing; completed.current=token;
      paint(false,accepted ? .47 : -1);
      return () => controller.abort();
    }
    const arrived = Math.abs(pos.x-targetX)<.05 && Math.abs(pos.y-targetY)<.05;
    if (arrived && completed.current===token) { direction=facing; paint(false,-1); return () => controller.abort(); }
    function frame(now: number) {
      const dt = last ? Math.min(40,now-last) : 0;
      last=now;
      while (waypoint<waypoints.length && Math.hypot(waypoints[waypoint].x-pos.x,waypoints[waypoint].y-pos.y)<.01) waypoint++;
      if (waypoint<waypoints.length) {
        const next=waypoints[waypoint], dx=next.x-pos.x, dy=next.y-pos.y, remaining=Math.hypot(dx,dy);
        const step=Math.min(remaining,dt*.105);
        if (Math.abs(dx)>1) direction=Math.sign(dx);
        pos.x+=dx/remaining*step; pos.y+=dy/remaining*step; distance.current+=step;
        paint(true,-1);
      } else {
        direction=facing;
        elapsed+=dt;
        const progress = completed.current===token ? 1 : Math.min(1,elapsed/(1000*growRoomGestureDuration(gesture)));
        paint(false,progress);
        if (progress===1) { completed.current=token; return; }
      }
      request=requestAnimationFrame(frame);
    }
    request=requestAnimationFrame(frame);
    return () => { controller.abort(); cancelAnimationFrame(request); };
  }, [accepted, atTable, facing, gesture, left, actorProfile, motion, stage, targetX, targetY, token, visible, width]);

  return <g ref={root} transform={translate(targetX,STATION)} data-grow-actor={profile?"player":"visitor"} aria-hidden="true">
    <ellipse cy=".5" rx="14" ry="3.3" fill="#435d4c" opacity=".27"/>
    <g data-rig=""><foreignObject x="-36" y="-103" width="72" height="107">
      <canvas ref={sprite} width={144} height={213} style={{ width: "100%", height: "100%" }} />
    </foreignObject></g>
  </g>;
}
