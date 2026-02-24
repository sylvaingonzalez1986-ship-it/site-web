"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { ScratchResult } from "@/types/lottery";

type ScratchCardProps = {
  ticketNumber: string;
  onScratch: () => Promise<ScratchResult>;
  disabled: boolean;
};

const REVEAL_THRESHOLD = 0.86;
const CELL_SIZE = 28;
const SCRATCH_RADIUS = 42;
const STAMP_STEP = 18;

function drawCover(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  coverImage: HTMLImageElement | null,
) {
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, width, height);

  if (coverImage) {
    ctx.fillStyle = "#efe7d8";
    ctx.fillRect(0, 0, width, height);

    const imageRatio = coverImage.width / coverImage.height;
    const canvasRatio = width / height;
    let drawWidth = width;
    let drawHeight = height;
    let offsetX = 0;
    let offsetY = 0;

    if (imageRatio > canvasRatio) {
      drawWidth = width;
      drawHeight = width / imageRatio;
      offsetY = (height - drawHeight) / 2;
    } else {
      drawHeight = height;
      drawWidth = height * imageRatio;
      offsetX = (width - drawWidth) / 2;
    }

    ctx.drawImage(coverImage, offsetX, offsetY, drawWidth, drawHeight);
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fillRect(0, 0, width, height);
  } else {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#e4e4e4");
    gradient.addColorStop(0.5, "#b9b9b9");
    gradient.addColorStop(1, "#dfdfdf");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "rgba(255,255,255,0.35)";
    for (let y = 0; y < height; y += 16) {
      for (let x = 0; x < width; x += 16) {
        ctx.beginPath();
        ctx.arc(x + 4, y + 4, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.fillStyle = "rgba(0,0,0,0.72)";
  ctx.font = "700 16px var(--font-display, sans-serif)";
  ctx.textAlign = "center";
  ctx.fillText("GRATTE LE PERSO", width / 2, height - 10);
}

export function ScratchCard({ ticketNumber, onScratch, disabled }: ScratchCardProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const coverImageRef = useRef<HTMLImageElement | null>(null);
  const pointerDownRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const scratchedCellsRef = useRef<Set<number>>(new Set());
  const totalCellsRef = useRef(1);
  const revealedRef = useRef(false);
  const progressRef = useRef(0);

  const [progress, setProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ScratchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [coverImageReady, setCoverImageReady] = useState(false);

  const canInteract = !disabled && !submitting && !result;

  useEffect(() => {
    const image = new window.Image();
    image.src = "/charles.png";
    image.onload = () => {
      coverImageRef.current = image;
      setCoverImageReady(true);
    };
  }, []);

  const markCells = useCallback((x: number, y: number, width: number) => {
    const colMin = Math.max(0, Math.floor((x - SCRATCH_RADIUS) / CELL_SIZE));
    const colMax = Math.max(0, Math.floor((x + SCRATCH_RADIUS) / CELL_SIZE));
    const rowMin = Math.max(0, Math.floor((y - SCRATCH_RADIUS) / CELL_SIZE));
    const rowMax = Math.max(0, Math.floor((y + SCRATCH_RADIUS) / CELL_SIZE));
    const cols = Math.max(1, Math.ceil(width / CELL_SIZE));

    for (let row = rowMin; row <= rowMax; row += 1) {
      for (let col = colMin; col <= colMax; col += 1) {
        scratchedCellsRef.current.add(row * cols + col);
      }
    }

    const nextProgress = Math.min(scratchedCellsRef.current.size / totalCellsRef.current, 1);
    progressRef.current = nextProgress;
    setProgress(nextProgress);
    return nextProgress;
  }, []);

  const submitScratch = useCallback(async () => {
    if (revealedRef.current || submitting || result || disabled) {
      return;
    }

    revealedRef.current = true;
    setSubmitting(true);
    setError(null);

    try {
      const scratchResult = await onScratch();
      setResult(scratchResult);

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      progressRef.current = 1;
      setProgress(1);
    } catch (scratchError) {
      revealedRef.current = false;
      setError(scratchError instanceof Error ? scratchError.message : "Erreur grattage.");
    } finally {
      setSubmitting(false);
    }
  }, [disabled, onScratch, result, submitting]);

  const scratchAt = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas || !canInteract) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        return;
      }

      const scaleX = canvas.width / rect.width;
      const drawX = x * scaleX;
      const drawY = y * scaleX;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }

      let coverage = progressRef.current;
      const scratchStamp = (stampX: number, stampY: number) => {
        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath();
        ctx.arc(stampX, stampY, SCRATCH_RADIUS * scaleX, 0, Math.PI * 2);
        ctx.fill();
        coverage = Math.max(coverage, markCells(stampX, stampY, canvas.width));
      };

      const previous = lastPointRef.current;
      if (previous) {
        const dx = drawX - previous.x;
        const dy = drawY - previous.y;
        const distance = Math.hypot(dx, dy);
        const steps = Math.max(1, Math.ceil(distance / STAMP_STEP));
        for (let step = 1; step <= steps; step += 1) {
          const ratio = step / steps;
          scratchStamp(previous.x + dx * ratio, previous.y + dy * ratio);
        }
      } else {
        scratchStamp(drawX, drawY);
      }

      lastPointRef.current = { x: drawX, y: drawY };

      if (coverage >= REVEAL_THRESHOLD) {
        void submitScratch();
      }
    },
    [canInteract, markCells, submitScratch],
  );

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) {
      return;
    }

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(220, Math.floor(rect.width));
      const height = Math.max(220, Math.floor(rect.height));
      canvas.width = width;
      canvas.height = height;
      drawCover(
        canvas.getContext("2d") as CanvasRenderingContext2D,
        width,
        height,
        coverImageRef.current,
      );

      const cols = Math.max(1, Math.ceil(width / CELL_SIZE));
      const rows = Math.max(1, Math.ceil(height / CELL_SIZE));
      totalCellsRef.current = cols * rows;
      scratchedCellsRef.current = new Set();
      progressRef.current = 0;
      setProgress(0);
      revealedRef.current = false;
      lastPointRef.current = null;
    };

    resize();

    const observer = new ResizeObserver(() => {
      if (!result) {
        resize();
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [coverImageReady, result]);

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!canInteract) {
      return;
    }
    pointerDownRef.current = true;
    lastPointRef.current = null;
    event.currentTarget.setPointerCapture(event.pointerId);
    scratchAt(event.clientX, event.clientY);
  };

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!pointerDownRef.current || !canInteract) {
      return;
    }
    scratchAt(event.clientX, event.clientY);
  };

  const onPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    pointerDownRef.current = false;
    lastPointRef.current = null;
    if (progressRef.current >= REVEAL_THRESHOLD) {
      void submitScratch();
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const revealLabel = useMemo(() => {
    if (!result) {
      return "Gratte le personnage jusqu'au bout pour reveler le lot";
    }
    return result.isWin ? "Ticket valide: gain confirme" : "Ticket valide: sans gain";
  }, [result]);

  return (
    <div className="relative overflow-hidden rounded-[18px] border-[3px] border-[#1a1a1a] bg-[#fffaf0] shadow-[8px_8px_0_rgba(26,26,26,0.2)]">
      <div className="bg-[#0a7b61] px-4 py-2 text-center text-xs font-bold uppercase tracking-[0.14em] text-white">
        Ticket promo - grattage instantane
      </div>

      <div className="pointer-events-none absolute left-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 rounded-full border-2 border-[#1a1a1a] bg-cream md:block" />
      <div className="pointer-events-none absolute right-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 rounded-full border-2 border-[#1a1a1a] bg-cream md:block" />

      <div className="grid gap-4 p-4 md:grid-cols-[260px_1fr] md:items-start md:p-5">
        <div className="rounded-[12px] border-2 border-[#1a1a1a] bg-[#f7f4ee] p-3">
          <p className="mb-2 text-center text-xs font-bold uppercase tracking-[0.08em] text-charcoal">
            Zone a gratter
          </p>
          <div
            ref={containerRef}
            className="relative mx-auto aspect-square w-full max-w-[230px] overflow-hidden rounded-[10px] border-2 border-[#1a1a1a] bg-white"
          >
            <div className="absolute inset-0 bg-[#fffaf0]" />
            <div className="absolute inset-x-2 bottom-2 rounded-[8px] border border-[#1a1a1a] bg-[#fffaf0]/90 px-2 py-1 text-center">
              <p className="font-display text-sm text-ink">Lot masque</p>
            </div>
            {!result && (
              <canvas
                ref={canvasRef}
                className={`absolute inset-0 h-full w-full touch-none ${
                  canInteract ? "cursor-crosshair" : "cursor-not-allowed"
                }`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
              />
            )}
          </div>

          {!result && (
            <>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full border border-[#1a1a1a] bg-[#efe7d8]">
                <div className="h-full bg-[#0a7b61]" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <p className="mt-1 text-center text-[11px] text-charcoal">
                Progression: {Math.round(progress * 100)}% - grattage complet requis
              </p>
              {progress >= REVEAL_THRESHOLD && (
                <div className="mt-2 flex justify-center">
                  <button
                    type="button"
                    className="btn-cartoon btn-primary h-9 px-3 text-xs"
                    onClick={() => void submitScratch()}
                    disabled={submitting}
                  >
                    {submitting ? "Verification..." : "Reveler le lot"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-charcoal">Les Chanvriers Bretons</p>
          <p className="mt-1 font-mono text-xs font-semibold text-ink">{ticketNumber}</p>
          <p className="mt-2 font-display text-3xl text-ink">Ticket de grattage</p>
          <p className="mt-2 text-sm text-charcoal">
            Gratte la zone argent pour découvrir immédiatement ton résultat.
          </p>
          <p className="mt-2 text-[11px] uppercase tracking-[0.08em] text-charcoal">
            1 ticket = 1 seul grattage - tirage securise cote serveur
          </p>
        </div>
      </div>

      <div className="border-t-2 border-[#1a1a1a] bg-[#f2e9d8] px-4 py-2 text-center text-xs font-semibold text-charcoal">
        {revealLabel}
      </div>

      {error && <p className="px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
    </div>
  );
}
