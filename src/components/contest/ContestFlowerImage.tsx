"use client";

import Image from "next/image";
import { useState } from "react";
import { Flower2 } from "lucide-react";
import type { ContestEntrySummary } from "@/types/contest";

type Props = {
  entry: Pick<ContestEntrySummary, "id" | "imageUrl" | "product" | "galleryUrls">;
  alt: string;
  sizes: string;
  fallbackSize?: number;
};

function ImageCandidates({ sources, alt, sizes, fallbackSize }: Omit<Props, "entry"> & { sources: string[] }) {
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const src = sources.find((source) => !failedSources.includes(source));

  if (!src) {
    return <Flower2 size={fallbackSize} strokeWidth={1} role="img" aria-label="Image de la fleur indisponible" />;
  }

  return <Image key={src} src={src} alt={alt} fill sizes={sizes} onError={() => {
    setFailedSources((previous) => previous.includes(src) ? previous : [...previous, src]);
  }} />;
}

export function ContestFlowerImage({ entry, alt, sizes, fallbackSize = 32 }: Props) {
  // Lot photos may outlive the product upload they originally referenced.
  // Preserve a valid editorial image, then try the current product and gallery.
  const sources = [...new Set([entry.imageUrl, entry.product?.image, ...entry.galleryUrls]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value)))];

  return <ImageCandidates key={JSON.stringify([entry.id, sources])} sources={sources} alt={alt} sizes={sizes} fallbackSize={fallbackSize} />;
}
