"use client";
import { useEffect, useRef, useState } from "react";
import { renderChanvrierHead } from "./chanvrier-head-renderer";
import { renderChanvrierBody } from "./chanvrier-body-renderer";
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
    image.src = `/contest/avatars/sylvain-v3/accessory-${name}.webp`;
  });
  accessories.set(name, promise);
  return promise;
}

/** Head and clothing share a fixed drawing frame, including every ankle and hem. */
export function ChanvrierAvatar({ profile, className, view = "full" }: { profile: Profile; className?: string; view?: "full" | "portrait" }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState("");
  const [failed, setFailed] = useState(false);
  const signature = JSON.stringify([profile.gender, profile.clothing, profile.skin, profile.appearance, view]);
  useEffect(() => {
    let cancelled = false;
    const accessory = getChanvrierAppearance(profile).accessory;
    const ornament = accessory === "earrings" || accessory === "scarf" ? loadAccessory(accessory) : Promise.resolve(null);
    void Promise.all([renderChanvrierBody(profile), renderChanvrierHead(profile), ornament]).then(([body, head, ornament]) => {
      if (cancelled || !canvas.current) return;
      const frame = document.createElement("canvas");
      frame.width = 768; frame.height = 1280;
      const context = frame.getContext("2d")!;
      context.imageSmoothingQuality = "high";
      context.save();
      // Scale the whole body around the collar, keeping every clothing joint intact.
      if (profile.gender === "female") { context.translate(384, 480); context.scale(.96, .96); context.translate(-384, -480); }
      context.drawImage(body, 0, 0);
      context.restore();
      context.drawImage(head, 0, -86, 768, 768);
      if (ornament) {
        const [x, y, width] = accessory === "earrings" ? [238, 402, 24] : [332, 484, 134];
        context.drawImage(ornament, x, y, width, width * ornament.height / ornament.width);
      }
      const destination = canvas.current.getContext("2d")!;
      destination.clearRect(0, 0, 768, view === "portrait" ? 768 : 1280);
      destination.imageSmoothingQuality = "high";
      if (view === "portrait") destination.drawImage(frame, 60, 0, 650, 650, 0, 0, 768, 768);
      else destination.drawImage(frame, 0, 0);
      setFailed(false); setRendered(signature);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [profile, signature, view]);
  const a = getChanvrierAppearance(profile);
  return <canvas ref={canvas} width={768} height={view === "portrait" ? 768 : 1280} className={className} role="img" aria-busy={!failed && rendered !== signature} data-avatar-state={failed ? "error" : rendered === signature ? "ready" : "loading"} aria-label={failed ? "Le portrait est indisponible. Réouvre le profil pour réessayer." : `Ton personnage dans le style cartoon de Sylvain : ${OPTIONS.hair.find(c => c.code === a.hair)?.name}, visage ${OPTIONS.face.find(c => c.code === a.face)?.name}, ${OPTIONS.top.find(c => c.code === a.top)?.name}`} />;
}
