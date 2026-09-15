"use client";
import { useEffect, useRef } from "react";
import { CHANVRIER_CLOTHES, CHANVRIER_SKINS, type ChanvrierProfile } from "@/lib/arena-chanvrier";

/** Palette swapping happens locally: changing a swatch never requests another image. */
export function ChanvrierAvatar({ profile, className }: { profile: Pick<ChanvrierProfile, "gender" | "clothing" | "skin">; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const source = "/contest/avatars/chanvrier-duo-v1.webp";
  useEffect(() => {
    let cancelled = false;
    const sprite = new window.Image();
    sprite.onload = () => {
      const context = canvas.current?.getContext("2d", { willReadFrequently: true });
      if (cancelled || !context) return;
      context.drawImage(sprite, profile.gender === "female" ? sprite.width / 2 : 0, 0, sprite.width / 2, sprite.height, 0, 0, 384, 512);
      const frame = context.getImageData(0, 0, 384, 512);
      const rgb = (hex: string) => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
      const clothing = rgb(CHANVRIER_CLOTHES.find(item => item.code === profile.clothing)!.color);
      const skin = rgb(CHANVRIER_SKINS.find(item => item.code === profile.skin)!.color);
      for (let i = 0; i < frame.data.length; i += 4) {
        const r = frame.data[i], g = frame.data[i + 1], b = frame.data[i + 2];
        const blue = b > r * 1.4 && b > g * 1.25 && b > 35;
        const peach = r > 80 && g > 35 && r - g > 30 && g - b > 25 && b > 20;
        if (!blue && !peach) continue;
        const palette = blue ? clothing : skin;
        const shade = Math.min(1.12, blue ? b / 206 : r / 250);
        for (let channel = 0; channel < 3; channel++) frame.data[i + channel] = Math.min(255, palette[channel] * shade);
      }
      context.putImageData(frame, 0, 0);
    };
    sprite.src = source;
    return () => { cancelled = true; };
  }, [profile.gender, profile.clothing, profile.skin]);
  return <canvas ref={canvas} width={384} height={512} className={className} role="img" aria-label={`Ton personnage ${profile.gender === "female" ? "féminin" : "masculin"}, vêtements ${CHANVRIER_CLOTHES.find(item => item.code === profile.clothing)?.name}, peau ${CHANVRIER_SKINS.find(item => item.code === profile.skin)?.name}`} />;
}
