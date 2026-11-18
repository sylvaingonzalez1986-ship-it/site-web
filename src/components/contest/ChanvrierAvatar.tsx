"use client";
import { useEffect, useRef, useState } from "react";
import { renderChanvrierHead } from "./chanvrier-head-renderer";
import { renderChanvrierBody } from "./chanvrier-body-renderer";
import { CHANVRIER_FRAME as FRAME } from "./chanvrier-composition";
import { CHANVRIER_APPEARANCE_OPTIONS as OPTIONS, getChanvrierAppearance, type ChanvrierProfile } from "@/lib/arena-chanvrier";

type Profile = Pick<ChanvrierProfile, "gender" | "clothing" | "skin" | "appearance">;
const accessories = new Map<string, Promise<HTMLImageElement>>();
function loadAccessory(name: string) {
  const cached = accessories.get(name);
  if (cached) return cached;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => { accessories.delete(name); reject(new Error("Accessoire indisponible.")); };
    image.src = `/contest/avatars/chanvrier-v6/accessory-${name}.webp`;
  });
  accessories.set(name, promise);
  return promise;
}

/** Head and clothing share a fixed drawing frame, including every ankle and hem. */
export function ChanvrierAvatar({ profile, className, view = "full" }: { profile: Profile; className?: string; view?: "full" | "portrait" }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState("");
  const [failedSignature, setFailedSignature] = useState("");
  const signature = JSON.stringify([profile.gender, profile.clothing, profile.skin, profile.appearance, view]);
  const failed = failedSignature === signature;
  useEffect(() => {
    let cancelled = false;
    const accessory = getChanvrierAppearance(profile).accessory;
    const ornament = accessory === "earrings" || accessory === "scarf" ? loadAccessory(accessory) : Promise.resolve(null);
    void Promise.all([renderChanvrierBody(profile), renderChanvrierHead(profile), ornament]).then(([body, head, ornament]) => {
      if (cancelled || !canvas.current) return;
      const frame = document.createElement("canvas");
      frame.width = FRAME.width; frame.height = FRAME.height;
      const context = frame.getContext("2d")!;
      context.imageSmoothingQuality = "high";
      context.save();
      // Scale the whole body around the collar, keeping every clothing joint intact.
      const bodyScale = FRAME.bodyScale[profile.gender];
      context.translate(FRAME.collar.x, FRAME.collar.y);
      context.scale(bodyScale, bodyScale);
      context.translate(-FRAME.collar.x, -FRAME.collar.y);
      context.drawImage(body, 0, 0);
      if (ornament && accessory === "scarf") {
        const { x, y, width } = FRAME.scarf;
        context.drawImage(ornament, x, y, width, width * ornament.height / ornament.width);
      }
      context.restore();
      context.drawImage(head, FRAME.head.x, FRAME.head.y, FRAME.head.size, FRAME.head.size);
      if (ornament && accessory === "earrings") {
        const { x, y, width } = FRAME.earring;
        context.drawImage(ornament, x, y, width, width * ornament.height / ornament.width);
      }
      const destination = canvas.current.getContext("2d")!;
      destination.clearRect(0, 0, FRAME.width, view === "portrait" ? FRAME.width : FRAME.height);
      destination.imageSmoothingQuality = "high";
      // Leave room around the registered v6 braids and the leftmost ponytail.
      if (view === "portrait") destination.drawImage(frame, FRAME.portrait.x, FRAME.portrait.y, FRAME.portrait.size, FRAME.portrait.size, 0, 0, FRAME.width, FRAME.width);
      else destination.drawImage(frame, 0, 0);
      setFailedSignature(""); setRendered(signature);
    }).catch(() => { if (!cancelled) setFailedSignature(signature); });
    return () => { cancelled = true; };
  }, [profile, signature, view]);
  const a = getChanvrierAppearance(profile);
  return <canvas ref={canvas} width={FRAME.width} height={view === "portrait" ? FRAME.width : FRAME.height} className={className} style={{ opacity: !failed && rendered === signature ? 1 : 0 }} role="img" aria-busy={!failed && rendered !== signature} data-avatar-state={failed ? "error" : rendered === signature ? "ready" : "loading"} aria-label={failed ? "Le portrait est indisponible. Réouvre le profil pour réessayer." : `Ton personnage dans le style cartoon de Loïc : ${OPTIONS.hair.find(c => c.code === a.hair)?.name}, visage ${OPTIONS.face.find(c => c.code === a.face)?.name}, yeux ${OPTIONS.eyes.find(c => c.code === a.eyes)?.name}, nez ${OPTIONS.nose.find(c => c.code === a.nose)?.name}, ${OPTIONS.top.find(c => c.code === a.top)?.name}`} />;
}
