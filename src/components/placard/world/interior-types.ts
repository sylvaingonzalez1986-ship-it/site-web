import type { VillageBuildingKind } from "./village-buildings";
import type { ChanvrierAvatarProfile } from "@/lib/arena-chanvrier";

export type InteriorObjectKind = "culture" | "drying" | "storage" | "partition" | "workbench" | "counter" | "desk" | "bookshelf" | "board" | "cards" | "podium" | "safe" | "character" | "exit";
export type InteriorRotation = 0 | 90 | 180 | 270;
/** Metres. x/z are footprint centres; width/depth describe the final rotated footprint. */
export type InteriorObject = {
  id: string;
  kind: InteriorObjectKind;
  label: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  rotation: InteriorRotation;
  href?: string;
  detail?: string;
  deviceCode?: string;
  movable?: boolean;
  active?: boolean;
  solid?: boolean;
};
export type InteriorRoom = {
  id: VillageBuildingKind;
  name: string;
  width: number;
  depth: number;
  height: number;
  spawn: [number, number];
  objects: InteriorObject[];
  /** Existing warehouse floor, kept clear of the surrounding circulation apron. */
  workArea?: { width: number; depth: number };
};
export type InteriorPlacement = { id: string; x: number; z: number; rotation: InteriorRotation };
export type InteriorQuality = "auto" | "high" | "low";
export type InteriorSceneProps = {
  profile?: ChanvrierAvatarProfile | null;
  followPlayer?: boolean;
  room: InteriorRoom;
  suspended: boolean;
  editing: boolean;
  overhead: boolean;
  grid: boolean;
  sensitivity: number;
  quality: InteriorQuality;
  selectedId: string | null;
  selectedCell?: { x: number; z: number } | null;
  preview: InteriorObject | null;
  previewValid: boolean;
  onSelect: (id: string) => void;
  onInteract: (id: string) => void;
  onPlace: (x: number, z: number) => void;
  onExit: () => void;
  onReady: () => void;
  onUnavailable: () => void;
};
