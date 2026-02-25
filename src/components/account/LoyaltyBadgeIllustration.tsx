"use client";

import { Crown, Gem, Leaf, ShieldCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LoyaltyBadgeId } from "@/types/loyalty";

type LoyaltyBadgeIllustrationProps = {
  badgeId: LoyaltyBadgeId;
  unlocked: boolean;
  size?: "xs" | "sm" | "md";
};

const sizeClasses: Record<NonNullable<LoyaltyBadgeIllustrationProps["size"]>, string> = {
  xs: "h-9 w-9",
  sm: "h-12 w-12",
  md: "h-16 w-16",
};

export function LoyaltyBadgeIllustration({
  badgeId,
  unlocked,
  size = "sm",
}: LoyaltyBadgeIllustrationProps) {
  return (
    <div
      className={cn(
        "relative shrink-0 rounded-full border-2 border-[#1a1a1a]",
        sizeClasses[size],
        unlocked ? "opacity-100" : "opacity-60 grayscale-[20%]",
      )}
      aria-hidden
    >
      {badgeId === "decouverte" && (
        <div className="relative flex h-full w-full items-center justify-center rounded-full bg-[#c18657]">
          <div className="h-7 w-7 rounded-full border-2 border-[#1a1a1a] bg-[#e6b58f]" />
          <div className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#1a1a1a]" />
        </div>
      )}

      {badgeId === "explorateur" && (
        <div className="relative flex h-full w-full items-center justify-center rounded-full bg-[#d9dde3]">
          <div className="absolute inset-[5px] rounded-full border-2 border-[#1a1a1a]" />
          <Leaf className="h-6 w-6 text-[#2f5f4f]" strokeWidth={2.3} />
        </div>
      )}

      {badgeId === "connaisseur" && (
        <div className="relative flex h-full w-full items-center justify-center rounded-full bg-[#f2cb52]">
          <div className="absolute inset-[5px] rounded-full border-2 border-[#1a1a1a]" />
          <ShieldCheck className="h-6 w-6 text-[#4a3908]" strokeWidth={2.3} />
          <div className="absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#4a3908]" />
          <div className="absolute bottom-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[#4a3908]" />
        </div>
      )}

      {badgeId === "ambassadeur" && (
        <div className="relative flex h-full w-full items-center justify-center rounded-full bg-[#b5c4d1]">
          <div className="absolute inset-[4px] rounded-full border-2 border-[#1a1a1a]" />
          <Gem className="h-6 w-6 text-[#2f4860]" strokeWidth={2.4} />
          <Sparkles className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-[#2f4860]" strokeWidth={2.2} />
        </div>
      )}

      {badgeId === "legende" && (
        <div className="relative flex h-full w-full items-center justify-center rounded-full bg-[#7ec7d5]">
          <div className="absolute inset-[4px] rounded-full border-2 border-[#1a1a1a]" />
          <Crown className="h-6 w-6 text-[#203a66]" strokeWidth={2.4} />
          <Gem className="absolute bottom-1.5 h-3.5 w-3.5 text-[#203a66]" strokeWidth={2.6} />
          <Sparkles className="absolute left-1.5 top-1.5 h-3.5 w-3.5 text-[#203a66]" strokeWidth={2.2} />
          <Sparkles className="absolute right-1.5 top-2 h-3 w-3 text-[#203a66]" strokeWidth={2.2} />
        </div>
      )}
    </div>
  );
}

