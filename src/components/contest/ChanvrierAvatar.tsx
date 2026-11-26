"use client";
import { useEffect, useRef, useState } from "react";
import { CHANVRIER_APPEARANCE_OPTIONS as options, getChanvrierAppearance, type ChanvrierAvatarProfile } from "@/lib/arena-chanvrier";
import type { ChanvrierExpression } from "../placard/kq-grow-worker-model";
import type { ChanvrierDetail } from "./chanvrier-snapshot";

export function ChanvrierAvatar({ profile, className, view = "full", detail, label, expression }: { profile: ChanvrierAvatarProfile; className?: string; view?: "full" | "portrait"; detail?: ChanvrierDetail; label?: string; expression?: ChanvrierExpression }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [result, setResult] = useState({ key: "", ok: false });
  const appearance = getChanvrierAppearance(profile);
  const signature = JSON.stringify({ gender: profile.gender, skin: profile.skin, clothing: profile.clothing, appearance });
  const key = JSON.stringify([view, detail, expression, signature]);
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const controller = new AbortController();
    const paint = async () => {
      try {
        const { renderChanvrierSnapshot } = await import("./chanvrier-snapshot");
        controller.signal.throwIfAborted();
        const width = Math.min(448, Math.max(72, Math.ceil(node.getBoundingClientRect().width * Math.min(devicePixelRatio, 2) / 32) * 32));
        const stamp = await renderChanvrierSnapshot({ profile: JSON.parse(signature), view, width, detail, expression }, controller.signal);
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
  }, [key, signature, view, detail, expression]);
  const state = result.key === key ? result.ok ? "ready" : "error" : "loading";
  const name = (items: readonly { code: string; name: string }[], id: string) => items.find(item => item.code === id)?.name;
  return <canvas ref={canvas} className={className} width={160} height={detail ? 108 : view === "full" ? 237 : 160}
    role="img" aria-busy={state === "loading"} data-avatar-state={state} style={{ opacity: state === "ready" ? 1 : 0 }}
    aria-label={`${label ?? "Ton personnage dans le style cartoon de Loïc"} : ${name(options.hair, appearance.hair)}, visage ${name(options.face, appearance.face)}, ${name(options.top, appearance.top)}, ${name(options.headwear, appearance.headwear)}`} />;
}
