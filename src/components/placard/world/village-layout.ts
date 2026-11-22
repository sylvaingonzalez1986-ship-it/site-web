import type { VillageBuildingKind } from "./village-buildings";
import { MAP_ENTRANCES } from "../KqPlacardMap.scene";

export const VILLAGE_SEA_SIZE = 160;
export const VILLAGE_SEA_LEVEL = -.32;
export const HEMP_FARM_ID = "hemp-farm";
export const HEMP_FARM_HREF = "/arene/placard?support=1";

export type VillagePlaceId = VillageBuildingKind | typeof HEMP_FARM_ID;

/** Coordinates in the mainland shoreline's across/depth frame. */
export const HEMP_FARM_SITE = { across: 5.15, depth: -25.45, height: 1.87 } as const;

export function mainlandToGround(across: number, depth: number): [number, number] {
  return [(depth + across) * Math.SQRT1_2, (depth - across) * Math.SQRT1_2];
}

const [hempFarmX, hempFarmZ] = mainlandToGround(HEMP_FARM_SITE.across, HEMP_FARM_SITE.depth);
export const HEMP_FARM = {
  id: HEMP_FARM_ID,
  name: "Ferme chanvrière",
  href: HEMP_FARM_HREF,
  scale: 1.03,
  position: [hempFarmX, HEMP_FARM_SITE.height, hempFarmZ] as [number, number, number],
  footprint: { width: 4.25, depth: 3.05, wall: 2.38, rise: 1.28 },
} as const;

/** Inverse ground-plane projection of the existing painting; never economy coordinates. */
export function paintingToGround(px: number, py: number): [number, number] {
  const horizontal = (px - 768) / 49;
  const depth = (py - 485) / (49 / Math.sqrt(3));
  return [(horizontal + depth) / Math.sqrt(2), (depth - horizontal) / Math.sqrt(2)];
}

const [oakX, oakZ] = paintingToGround(780, 680);
export const VILLAGE_KORRIGAN_GLADE = { x: oakX, z: oakZ, orbitRadius: 2.17, trunkRadius: 1.18 } as const;

// Foot of KqMailbox's separate overlay: left 59%, top 35%, width 12%.
const [mailboxX, mailboxZ] = paintingToGround(998, 533);
export const VILLAGE_MAILBOX_POSITION: [number, number, number] = [mailboxX, 0.04, mailboxZ];

type VillagePlace = {
  id: VillageBuildingKind;
  name: string;
  description: string;
  href: string;
  scale: number;
  depth: number;
  doorX?: number;
};

export const VILLAGE_PLACES: readonly VillagePlace[] = [
  { id: "warehouse", name: "La ferme", description: "La grange, les cultures, les récoltes et l’atelier.", href: "/arene/placard?view=workshop", scale: 1.3, depth: 3.8 },
  { id: "bank", name: "Banque", description: "Les prêts, l’épargne, la bourse et les cryptos du quartier.", href: "/arene/placard?view=treasury&pole=bank&section=loans", scale: 1, depth: 3.5 },
  { id: "office", name: "Personnel", description: "Le bureau de ton équipe et de la comptabilité.", href: "/arene/placard?view=staff", scale: 1.1, depth: 3.6 },
  { id: "market", name: "Commerce", description: "Le marché et son étal de produits sous la toile dorée.", href: "/arene/placard?view=market", scale: 1.15, depth: 3.2 },
  { id: "missions", name: "Missions", description: "Le tableau des missions, au croisement des chemins.", href: "/arene/placard?view=missions", scale: 1.05, depth: 0.7 },
  { id: "arena", name: "Jury & duels", description: "Le kiosque du jury, sa coupe et ses guirlandes.", href: "/arene/placard?view=arena", scale: 1.15, depth: 3.8 },
  { id: "collection", name: "QuizzShow", description: "L’encyclopédie et les pupitres du tournoi du chanvre.", href: "/arene/placard?view=school", scale: 1.1, depth: 3.6, doorX: 1.6 },
  { id: "shop", name: "Maison des cartes", description: "L’album, les collections et les packs sous l’auvent turquoise.", href: "/arene/placard?view=shop", scale: 1.1, depth: 3.5, doorX: -1 },
];

export function villagePlacePosition(place: VillagePlace): [number, number, number] {
  const [x, z] = paintingToGround(...MAP_ENTRANCES[place.id]);
  return [x - (place.doorX ?? 0) * place.scale, 0.04, z - place.depth * place.scale / 2];
}
