"use client";

import Image from "next/image";
import type { MouseEvent } from "react";
import { shouldUseNativeImg } from "@/lib/image-source";
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
  const useNativeImg = shouldUseNativeImg(producer.image);

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
        {useNativeImg ? (
          <img
            src={producer.image}
            alt={producer.name}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        ) : (
          <Image
            src={producer.image}
            alt={producer.name}
            fill
            sizes="40px"
            className="object-cover"
          />
        )}
      </span>
      <span className="truncate text-sm font-bold text-ink">{producer.name}</span>
    </button>
  );
}
