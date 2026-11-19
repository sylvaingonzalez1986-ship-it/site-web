import * as THREE from "three";
import type { IsometricBuilding } from "@/lib/kanab-quest-world-mode";
import { isIsometricBuilding } from "@/lib/kanab-quest-world-mode";
import type { InteriorRoom } from "./interior-types";

// Six plates share one 768 × 512 atlas. The first, third and last are details
// from the original venue paintings: the banker's landscape, the market square
// outside the stall and the three framed cards behind Loïc.
const PRINTS: Record<IsometricBuilding, { tile: number; width: number; height: number; y: number; z: number }> = {
  bank:     { tile: 0, width: 1.8, height: 1.46, y: 1.53, z: -.6 },
  office:   { tile: 1, width: 3.36, height: 1.12, y: 1.58, z: -.75 },
  market:   { tile: 2, width: 3.12, height: 2.13, y: 1.57, z: -.63 },
  missions: { tile: 3, width: 2.28, height: 1.48, y: 1.56, z: -.89 },
  arena:    { tile: 4, width: 1.63, height: 1.48, y: 1.36, z: -1.26 },
  shop:     { tile: 5, width: 3.06, height: 1.51, y: 1.55, z: -.55 },
};

export function addBuildingWallPrint(model: THREE.Group, id: InteriorRoom["id"], onSettled: () => void) {
  if (!isIsometricBuilding(id)) { onSettled(); return; }
  const { tile, width, height, y, z } = PRINTS[id];
  const frame = new THREE.Group();
  frame.name = `venue-print-${id}`;
  frame.rotation.y = Math.PI / 2;
  frame.position.set(id === "shop" ? -5.2 : -5.34, y, z);
  const wood = new THREE.MeshStandardMaterial({ color: "#855536", roughness: 1 });
  const trim = new THREE.MeshStandardMaterial({ color: id === "market" ? "#237773" : "#d5a552", roughness: .83 });
  function timber(w: number, h: number, d: number, x: number, y: number, z: number, material = wood) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    beam.position.set(x, y, z);
    beam.castShadow = beam.receiveShadow = true;
    frame.add(beam);
  }
  timber(width + .19, height + .2, .142, 0, 0, 0);
  timber(width + .08, height + .08, .035, 0, 0, .081, trim);
  if (id === "market") {
    // A reveal, sill and awning turn the painted view onto the square into a stall window.
    timber(width + .38, .13, .4, 0, -height / 2 - .11, .065);
    timber(width + .42, .15, .68, 0, height / 2 + .13, .14, trim);
  }
  const atlas = new THREE.TextureLoader().load("/placard/building-rooms/wall-prints.webp", onSettled, undefined, onSettled);
  atlas.colorSpace = THREE.SRGBColorSpace;
  const inset = 3 / 256;
  atlas.repeat.set((1 - 2 * inset) / 3, (1 - 2 * inset) / 2);
  atlas.offset.set((tile % 3 + inset) / 3, (1 - Math.floor(tile / 3) + inset) / 2);
  const print = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({
    color: "#fffbec", map: atlas, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1,
  }));
  print.position.z = .104;
  print.receiveShadow = true;
  frame.add(print);
  model.add(frame);
}
