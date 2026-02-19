"use client";

import Image from "next/image";
import type { MouseEvent } from "react";
import type { Producer } from "@/types/store";

type ProducerBadgeProps = {
  producer: Producer;
  isSelected: boolean;
  onClick: () => void;
  controlsId?: string;
  onMouseEnter?: (event: MouseEvent<HTMLButtonElement>) => void;
  onMouseMove?: (event: MouseEvent<HTMLButtonElement>) => void;
  onMouseLeave?: () => void;
};

export function ProducerBadge({
  producer,
  isSelected,
  onClick,
  controlsId,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
}: ProducerBadgeProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={`producer-badge ${isSelected ? "producer-badge--active" : ""}`}
      aria-pressed={isSelected}
      aria-expanded={isSelected}
      aria-controls={controlsId}
    >
      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-[#1a1a1a] bg-white">
        <Image src={producer.image} alt={producer.name} fill sizes="40px" className="object-cover" />
      </span>
      <span className="truncate text-sm font-bold text-ink">{producer.name}</span>
    </button>
  );
}
