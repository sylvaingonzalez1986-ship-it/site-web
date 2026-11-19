import * as THREE from "three";
import type { InteriorRoom } from "./interior-types";
import { VILLAGE_LIGHT } from "./village-lighting";

type Position = [x: number, y: number, z: number];
type RoomLight = {
  key: Position;
  intensity: number;
  exposure: number;
  ground: number;
  fill: number;
  source: Position;
  target: Position;
  color: number;
  power: number;
};

const LIGHTS: Partial<Record<InteriorRoom["id"], RoomLight>> = {
  bank: { key: [-8, 19, 7], intensity: 2, exposure: 1.14, ground: 0x9b7958, fill: .82, source: [-3.58, 2.58, -4.04], target: [-.7, .28, -.15], color: 0xffdfb0, power: 45 },
  office: { key: [-8, 20, 13], intensity: 2.14, exposure: 1.12, ground: 0xa98d6c, fill: .91, source: [2, 2.29, -4.02], target: [1.13, .7, .5], color: 0xe5f5ff, power: 26 },
  market: { key: [-6, 16, 8], intensity: 2.17, exposure: 1.10, ground: 0xad9071, fill: .92, source: [-.92, 2.68, -2.92], target: [-2.3, .9, -1.49], color: 0xffc677, power: 12 },
  shop: { key: [-7, 18, 11], intensity: 2.21, exposure: 1.11, ground: 0xb79672, fill: .94, source: [.08, 2.58, -4.10], target: [-.7, .73, .85], color: 0xdff8ff, power: 28 },
  arena: { key: [-6, 21, 6], intensity: 1.98, exposure: 1.15, ground: 0xa37760, fill: .81, source: [-2.6, 2.77, -3.05], target: [-.56, 1.02, -1.85], color: 0xffce86, power: 15 },
  missions: { key: [-10, 23, 10], intensity: 2.1, exposure: 1.14, ground: 0xa79479, fill: .9, source: [-2.25, 3.2, -2.92], target: [1.5, .7, .1], color: 0xffe3b8, power: 18 },
};

export function lightBuildingRoom(scene: THREE.Scene, key: THREE.DirectionalLight, room: InteriorRoom) {
  const light = LIGHTS[room.id];
  key.position.fromArray(light?.key ?? VILLAGE_LIGHT.key.position);
  key.intensity = light?.intensity ?? VILLAGE_LIGHT.key.power;
  key.castShadow = true;
  const size = Math.hypot(room.width, room.depth, room.height) / 2 + 1;
  Object.assign(key.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 1, far: 60 });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.normalBias = .013;
  key.shadow.bias = -.00023;
  const rim = new THREE.DirectionalLight(VILLAGE_LIGHT.rim.color, VILLAGE_LIGHT.rim.power);
  rim.position.fromArray(VILLAGE_LIGHT.rim.position);
  scene.add(key, rim, new THREE.HemisphereLight(VILLAGE_LIGHT.sky, light?.ground ?? VILLAGE_LIGHT.ground, light?.fill ?? VILLAGE_LIGHT.hemi),
    new THREE.AmbientLight(0xffffff, light ? .19 : VILLAGE_LIGHT.ambient));
  if (light) {
    // The fill from the venue's window or hanging lamp lends color to its station without another shadow pass.
    const local = new THREE.SpotLight(light.color, light.power, 13, .8, .72, 2);
    local.position.fromArray(light.source);
    local.target.position.fromArray(light.target);
    scene.add(local, local.target);
  }
  return light?.exposure ?? VILLAGE_LIGHT.exposure;
}
