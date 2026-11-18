import type { ChanvrierAppearance } from "@/lib/arena-chanvrier";

export type WornHeadwear = Exclude<ChanvrierAppearance["headwear"], "none">;

// Heights use the unscaled scalp profile, with the front at +Z.
export const chanvrierHeadwearFit = {
  "watch-cap": { front: .238, back: .213, sourceHeight: .267, sourceRadius: .195 },
  "sailor-cap": { front: .253, back: .225, sourceHeight: .270, sourceRadius: .191 },
  bachi: { front: .245, back: .222, sourceHeight: .270, sourceRadius: .191 },
  souwester: { front: .253, back: .220, sourceHeight: .285, sourceRadius: .209 },
  "round-hat": { front: .252, back: .227, sourceHeight: .285, sourceRadius: .209 },
  "bigouden-coif": { front: .266, back: .218, sourceHeight: .286, sourceRadius: .185 },
  "lace-coif": { front: .252, back: .203, sourceHeight: .272, sourceRadius: .185 },
  headscarf: { front: .244, back: .177, sourceHeight: .253, sourceRadius: .177 },
} as const satisfies Record<WornHeadwear, { front: number; back: number; sourceHeight: number; sourceRadius: number }>;

export function chanvrierHeadwearEdge(style: ChanvrierAppearance["headwear"], angle: number) {
  if (style === "none") return null;
  const { front, back } = chanvrierHeadwearFit[style];
  return back + (front - back) * (.5 + .5 * Math.cos(angle));
}
