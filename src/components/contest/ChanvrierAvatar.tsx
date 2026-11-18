"use client";
import { useEffect, useRef, useState } from "react";
import { CHANVRIER_APPEARANCE_OPTIONS as options, getChanvrierAppearance, type ChanvrierAvatarProfile } from "@/lib/arena-chanvrier";

export function ChanvrierAvatar({ profile, className, view = "full" }: { profile: ChanvrierAvatarProfile; className?: string; view?: "full" | "portrait" }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [result, setResult] = useState({ key: "", ok: false });
  const appearance = getChanvrierAppearance(profile);
  const signature = JSON.stringify({ gender: profile.gender, skin: profile.skin, clothing: profile.clothing, appearance });
  const key = view + signature;
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const controller = new AbortController();
    const paint = async () => {
      try {
        const { renderChanvrierSnapshot } = await import("./chanvrier-snapshot");
        controller.signal.throwIfAborted();
        const width = Math.min(448, Math.max(72, Math.ceil(node.getBoundingClientRect().width * Math.min(devicePixelRatio, 2) / 32) * 32));
        const stamp = await renderChanvrierSnapshot({ profile: JSON.parse(signature), view, width }, controller.signal);
        if (controller.signal.aborted) return;
        node.width = stamp.width;
        node.height = stamp.height;
        node.getContext("2d")!.drawImage(stamp, 0, 0);
        setResult({ key, ok: true });
      } catch { if (!controller.signal.aborted) setResult({ key, ok: false }); }
    };
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); void paint(); }
    }, { rootMargin: "60px" });
    observer.observe(node);
    return () => { observer.disconnect(); controller.abort(); };
  }, [key, signature, view]);
  const state = result.key === key ? result.ok ? "ready" : "error" : "loading";
  const name = (items: readonly { code: string; name: string }[], id: string) => items.find(item => item.code === id)?.name;
  return <canvas ref={canvas} className={className} width={160} height={view === "full" ? 237 : 160}
    role="img" aria-busy={state === "loading"} data-avatar-state={state} style={{ opacity: state === "ready" ? 1 : 0 }}
    aria-label={`Ton personnage dans le style cartoon de Loïc : ${name(options.hair, appearance.hair)}, visage ${name(options.face, appearance.face)}, ${name(options.top, appearance.top)}, ${name(options.headwear, appearance.headwear)}`} />;
}
