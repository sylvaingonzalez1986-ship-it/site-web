import type { LotteryCardRarity } from "@/types/lottery";

/* ─────────────────────────────────────────────
   Shared TCG visual vocabulary
   Single source-of-truth for rarity display tokens.
   ───────────────────────────────────────────── */

/** Human-readable French labels for each card rarity. */
export const rarityLabels: Record<LotteryCardRarity, string> = {
  common: "Commune",
  silver: "Silver",
  gold: "Gold",
  epic: "Épique",
  legendary: "Légendaire",
};

/** Ordered list of rarities (album page order). */
export const RARITY_ORDER: readonly LotteryCardRarity[] = [
  "common",
  "silver",
  "gold",
  "epic",
  "legendary",
];

/* ── Pack-opening shell gradient classes ── */

export const rarityShellClasses: Record<LotteryCardRarity, string> = {
  common: "bg-[radial-gradient(circle_at_top,#fffaf1_0%,#f3e8da_62%,#e5d8c6_100%)] text-ink",
  silver: "bg-[radial-gradient(circle_at_top,#fbfdff_0%,#dbe4ec_58%,#b7c2cc_100%)] text-[#46525c]",
  gold: "bg-[radial-gradient(circle_at_top,#fff4ba_0%,#f3d46f_54%,#d19a24_100%)] text-[#7d5800]",
  epic: "bg-[radial-gradient(circle_at_top,#ffe6ff_0%,#d89bff_56%,#8f58d8_100%)] text-[#64208d]",
  legendary:
    "bg-[radial-gradient(circle_at_top,#fff3b6_0%,#ffca6e_46%,#10172f_100%)] text-[#8a3d00]",
};

/* ── Glow / box-shadow per rarity ── */

export const rarityGlowClasses: Record<LotteryCardRarity, string> = {
  common: "shadow-[0_0_0_2px_rgba(26,26,26,0.14),0_18px_32px_rgba(26,26,26,0.12)]",
  silver: "shadow-[0_0_34px_rgba(219,228,236,0.75),0_18px_34px_rgba(79,91,102,0.2)]",
  gold: "shadow-[0_0_40px_rgba(243,212,111,0.9),0_18px_36px_rgba(125,88,0,0.22)]",
  epic: "shadow-[0_0_48px_rgba(216,155,255,0.95),0_18px_40px_rgba(100,32,141,0.25)]",
  legendary:
    "shadow-[0_0_56px_rgba(255,202,110,0.95),0_0_86px_rgba(255,245,180,0.65),0_18px_44px_rgba(16,23,47,0.4)]",
};

/* ── Backdrop overlay gradient (pack reveal) ── */

export const rarityBackdropClasses: Record<LotteryCardRarity, string> = {
  common: "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.94)_0%,rgba(247,242,231,0.92)_55%,rgba(238,228,213,0.9)_100%)]",
  silver: "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.98)_0%,rgba(225,233,240,0.95)_52%,rgba(199,209,218,0.92)_100%)]",
  gold: "bg-[radial-gradient(circle_at_top,rgba(255,248,214,0.98)_0%,rgba(255,224,150,0.95)_48%,rgba(225,170,44,0.92)_100%)]",
  epic: "bg-[radial-gradient(circle_at_top,rgba(255,239,255,0.98)_0%,rgba(233,191,255,0.95)_48%,rgba(145,81,219,0.92)_100%)]",
  legendary:
    "bg-[radial-gradient(circle_at_top,rgba(255,248,202,0.98)_0%,rgba(255,206,120,0.92)_40%,rgba(20,24,46,0.96)_100%)]",
};

/* ── Flat card background classes (profile grid, album) ── */

export const rarityCardClasses: Record<LotteryCardRarity, string> = {
  common: "bg-[#efe6d9] text-ink",
  silver: "bg-[linear-gradient(180deg,#edf2f6_0%,#cfd8df_100%)] text-[#46525c]",
  gold: "bg-[linear-gradient(180deg,#ffe89b_0%,#efc85f_100%)] text-[#7d5800]",
  epic: "bg-[linear-gradient(180deg,#ffdff7_0%,#d8a7ff_100%)] text-[#6d2b87]",
  legendary: "bg-[linear-gradient(180deg,#ffe7a8_0%,#ffb86b_100%)] text-[#8a3d00]",
};

/* ── Accent colour (solid, for badges / borders / highlights) ── */

export const rarityAccentColor: Record<LotteryCardRarity, string> = {
  common: "#c9b99a",
  silver: "#a8b8c8",
  gold: "#d4a835",
  epic: "#a855f7",
  legendary: "#f59e0b",
};

/* ── Ring / border ring class (Tailwind ring) ── */

export const rarityRingClasses: Record<LotteryCardRarity, string> = {
  common: "ring-[#c9b99a]",
  silver: "ring-[#a8b8c8]",
  gold: "ring-[#d4a835]",
  epic: "ring-[#a855f7]",
  legendary: "ring-[#f59e0b]",
};
