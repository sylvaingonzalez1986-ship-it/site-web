"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { isRemoteImageUrl } from "@/lib/image-source";
import type { Producer } from "@/types/store";

type ProducerHoverCardProps = {
  producer: Producer;
  x: number;
  y: number;
};

export function ProducerHoverCard({ producer, x, y }: ProducerHoverCardProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => {
      setMounted(false);
    };
  }, []);

  const producerLocation = useMemo(
    () =>
      [producer.department, producer.region].filter(Boolean).join(", ") ||
      producer.location,
    [producer.department, producer.location, producer.region],
  );

  if (!mounted) {
    return null;
  }

  return createPortal(
    <aside
      className="producer-hover-card cartoon-border bg-cream p-3"
      style={{ left: `${x}px`, top: `${y}px` }}
      aria-hidden="true"
    >
      <div className="flex items-start gap-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 border-[#1a1a1a] bg-white">
          <Image
            src={producer.image}
            alt={producer.name}
            fill
            sizes="64px"
            unoptimized={isRemoteImageUrl(producer.image)}
            className="object-cover"
          />
        </div>
        <div className="min-w-0">
          <p className="font-display text-xl leading-none text-ink">{producer.name}</p>
          <p className="mt-2 inline-flex rounded-full border-2 border-[#1a1a1a] bg-yellow px-2 py-1 text-[11px] font-bold text-ink">
            {producerLocation}
          </p>
        </div>
      </div>
      <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-charcoal">
        {producer.description}
      </p>
      {producer.website && (
        <p className="mt-2 truncate text-[11px] font-semibold text-ink">{producer.website}</p>
      )}
    </aside>,
    document.body,
  );
}
