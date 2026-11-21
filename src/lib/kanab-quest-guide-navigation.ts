export const KQ_FARM_GUIDE_OPEN_EVENT = "kq:farm-guide-open";
export type FarmGuideView = "hub" | "workshop" | "collection" | "shop" | "game" | "harvests" | "arena" | "market" | "treasury" | "staff" | "social" | "missions" | "school" | "notebook" | "profile" | "ranking";
export type FarmGuideDestination = { view: FarmGuideView; section?: string; pole?: "accounting" | "bank"; href?: string };
