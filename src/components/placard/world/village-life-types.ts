import type * as THREE from "three";

/** Local decoration only. The atmosphere owns the single, pausable clock. */
export type VillageLifeFrame = {
  time: number;
  delta: number;
  reduced: boolean;
  quality: "low" | "high";
  /** Visibility of fine articulation at the current projected scale, from 0 to 1. */
  detail?: number;
  visible: (object: THREE.Object3D, radius: number) => boolean;
};

export type VillageLifeController = {
  object: THREE.Group;
  update: (frame: VillageLifeFrame) => void;
  dispose: () => void;
};

export type VillageWalkSurface = {
  isWalkable: (x: number, z: number, radius: number) => boolean;
  heightAt: (x: number, z: number) => number;
};
