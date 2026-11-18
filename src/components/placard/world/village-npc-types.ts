import type { VillageLifeFrame } from "./village-life-types";
import type * as THREE from "three";

export type VillageNpcId = "breton" | "fisherman" | "loic";
export type NpcPoint = [number, number, number];
export type NpcActivity = "walking" | "idle" | "observing" | "playing" | "greeting" | "singing" | "fishing" | "drinking";
export type FishingPhase = "adjust" | "wait" | "watch" | "reach" | "sip" | "replace";
/** Model-space gaze is bounded by the routine; the rig keeps accessory contacts. */
export type VillageNpcPose = {
  activity: NpcActivity;
  speed: number;
  stride: number;
  lookYaw: number;
  lookPitch: number;
  emphasis: number;
  attention: number;
  fishingPhase: FishingPhase;
  phaseProgress: number;
};
export type VillageNpcRig = {
  object: THREE.Group;
  update: (frame: VillageLifeFrame, pose?: VillageNpcPose) => void;
  dispose: () => void;
};
export type VillageNpcInteraction = { type: "speech" | "song" | "tutorial"; emphasis: number };
export type VillageNpcRoutineState = { position: NpcPoint; yaw: number; pose: VillageNpcPose; destination: number };
