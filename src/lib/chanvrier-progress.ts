import catalog from "./chanvrier-achievements.json";
import type { KqMission } from "./kanab-quest-missions";

export type AchievementCategory = "culture" | "dice" | "commerce" | "arena";
export const ACHIEVEMENTS = catalog as Array<{
  code: string; category: AchievementCategory; name: string; description: string;
  thresholds: number[]; unit: string; title: string | null;
}>;
export const ACHIEVEMENT_CATEGORIES: Record<AchievementCategory, string> = { culture: "Culture", dice: "Dés", commerce: "Commerce", arena: "Arène" };
export const BADGE_TIERS = ["Bronze", "Argent", "Or"];
export type ChanvrierBadge = { id: string; code: string; label: string; description: string; origin: "game" | "notebook" | "season"; awardedAt: string | null };
export type ChanvrierShowcase = { badges: string[]; title: string | null; tracked: string | null };
export type ChanvrierProgress = {
  metrics: Record<string, number>; reputation: number; rating: number; rank: number | null; rankAsOf: string | null;
  badges: ChanvrierBadge[]; missions: KqMission[]; showcase: ChanvrierShowcase;
  unlockedFamilies: number; packsGranted: number; newBadgeCount: number; badgeCount: number;
};
export function achievementProgress(code: string, metrics: Record<string, number>) {
  const definition = ACHIEVEMENTS.find(item => item.code === code)!;
  const value = Math.max(0, metrics[code] ?? 0);
  const tier = definition.thresholds.filter(threshold => value >= threshold).length;
  const target = definition.thresholds[tier] ?? definition.thresholds.at(-1)!;
  return { ...definition, value, tier, target, completed: tier === definition.thresholds.length, percent: Math.min(100, value / target * 100) };
}
export function parseChanvrierShowcase(value: unknown): ChanvrierShowcase | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (!Array.isArray(item.badges) || item.badges.length > 3 || item.badges.some(id => typeof id !== "string" || !id || id.length > 120) || new Set(item.badges).size !== item.badges.length) return null;
  if (item.title !== null && !ACHIEVEMENTS.some(a => a.code === item.title && a.title)) return null;
  if (item.tracked !== null && !ACHIEVEMENTS.some(a => a.code === item.tracked)) return null;
  return { badges: item.badges as string[], title: item.title as string | null, tracked: item.tracked as string | null };
}
