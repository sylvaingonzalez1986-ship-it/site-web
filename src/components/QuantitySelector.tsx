"use client";

import { Minus, Plus } from "lucide-react";

type QuantitySelectorProps = {
  value: number;
  min?: number;
  max?: number;
  onChange: (qty: number) => void;
  /** Compact mode for tight spaces (cart drawer) */
  compact?: boolean;
};

export function QuantitySelector({
  value,
  min = 1,
  max = 999,
  onChange,
  compact = false,
}: QuantitySelectorProps) {
  const clamp = (n: number) => Math.max(min, Math.min(max, Math.round(n)));

  const handleInputChange = (raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) return;
    onChange(clamp(parsed));
  };

  const handleBlur = () => {
    if (value < min) onChange(min);
    if (value > max) onChange(max);
  };

  const btnClass = compact
    ? "cartoon-chip inline-flex min-h-[36px] min-w-[36px] items-center justify-center p-2"
    : "cartoon-chip inline-flex min-h-[44px] min-w-[44px] items-center justify-center p-3";

  const inputClass = compact
    ? "h-[36px] w-14 border-2 border-[#1a1a1a] bg-white text-center text-sm font-bold"
    : "h-[44px] w-16 border-2 border-[#1a1a1a] bg-white text-center text-sm font-bold";

  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
        className={`${btnClass} disabled:opacity-40`}
        aria-label="Diminuer la quantité"
      >
        <Minus size={compact ? 14 : 16} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        onBlur={handleBlur}
        className={inputClass}
        aria-label="Quantité"
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        className={`${btnClass} disabled:opacity-40`}
        aria-label="Augmenter la quantité"
      >
        <Plus size={compact ? 14 : 16} />
      </button>
    </div>
  );
}
