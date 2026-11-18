import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { villageFootLift, villageFootPhase, villageFootTravel } from "./village-character-gait";
import { createVillageContactShadowGeometry } from "./village-contact-shadow";
import { paintingToGround } from "./village-layout";
import { disposeVillageObject } from "./village-terrain";
import type { VillageLifeController, VillageWalkSurface } from "./village-life-types";

type XYZ = [number, number, number];
type State = "wander" | "pause" | "sniff" | "watch";
const INK = "#294942", CREAM = "#fff0ca";
const SPECS = [
  // Open circulation spaces keep low silhouettes clear of the projected roofs and labels.
  { species: "wolf" as const, painting: [590, 570], coat: "#718887", dark: "#455d60", scale: 0.8, speed: 0.44, radius: 0.8, territory: 1.65, rest: 3.2,
    cycle: 0.48, stance: 0.68, footfalls: [0, 0.5, 0.75, 0.25], lift: 0.085 },
  { species: "fox" as const, painting: [960, 590], coat: "#c78345", dark: "#78553c", scale: 0.65, speed: 0.57, radius: 0.7, territory: 1.6, rest: 2.1,
    cycle: 0.41, stance: 0.61, footfalls: [0, 0.5, 0.56, 0.06], lift: 0.105 },
  { species: "weasel" as const, painting: [700, 930], coat: "#9b704d", dark: "#654e3c", scale: 0.45, speed: 0.66, radius: 0.5, territory: 1.3, rest: 1.5,
    cycle: 0.25, stance: 0.59, footfalls: [0, 0.09, 0.5, 0.59], lift: 0.078 },
];

/** Colours are merged into each articulated part: seven draw calls per animal. */
function anatomy(material: THREE.Material, shapes: { at: XYZ; size: XYZ; color: string; coneInterior?: string; segments?: number }[]) {
  const parts = shapes.map(({ at, size, color, coneInterior, segments = 8 }) => {
    const primitive = coneInterior ? new THREE.ConeGeometry(1, 2, 5) : new THREE.SphereGeometry(1, segments, segments / 2 + 2);
    const geometry = primitive.toNonIndexed(); primitive.dispose();
    geometry.deleteAttribute("uv");
    const tint = new THREE.Color(color), colors = new Float32Array(geometry.getAttribute("position").count * 3);
    const inner = coneInterior ? new THREE.Color(coneInterior) : null;
    const normal = geometry.getAttribute("normal");
    for (let i = 0; i < normal.count; i++) (inner && normal.getZ(i) > 0.7 ? inner : tint).toArray(colors, i * 3);
    geometry.scale(...size).translate(...at);
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geometry;
  });
  const geometry = mergeGeometries(parts, false)!;
  parts.forEach(part => part.dispose());
  const mesh = new THREE.Mesh(geometry, material);
  mesh.raycast = () => {};
  return mesh;
}

function model(spec: typeof SPECS[number], material: THREE.Material) {
  const object = new THREE.Group(); object.name = `village-animal-${spec.species}`;
  const rig = new THREE.Group(); rig.scale.setScalar(spec.scale); object.add(rig);
  const low = spec.species === "weasel", fox = spec.species === "fox";
  const hip = low ? 0.2 : 0.38, bodyY = low ? 0.27 : 0.48;
  const body = anatomy(material, [
    { at: [0, bodyY, 0], size: [low ? 0.15 : 0.22, low ? 0.16 : 0.27, low ? 0.49 : 0.44], color: spec.coat },
    { at: [0, bodyY - 0.07, 0.26], size: [0.17, low ? 0.1 : 0.23, 0.22], color: CREAM },
    ...(!low ? [{ at: [0, bodyY + 0.07, 0.21] as XYZ, size: [0.26, 0.28, 0.25] as XYZ, color: spec.coat }] : []),
  ]); body.name = "body"; rig.add(body);
  const skull: XYZ = [low ? 0.16 : 0.23, low ? 0.14 : 0.22, 0.23];
  const skullZ = 0.04;
  const eyeX = skull[0] * 0.63, eyeY = low ? 0.034 : 0.045;
  const eyeZ = skullZ + skull[2] * Math.sqrt(1 - (eyeX / skull[0]) ** 2 - (eyeY / skull[1]) ** 2) - 0.013;
  const head = anatomy(material, [
    { at: [0, 0, skullZ], size: skull, color: spec.coat, segments: 12 },
    { at: [0, -0.065, 0.21], size: [0.14, 0.095, 0.2], color: CREAM },
    { at: [0, -0.04, 0.38], size: [0.07, 0.055, 0.045], color: INK },
    ...[-1, 1].flatMap(side => {
      const earX = side * (low ? 0.105 : 0.15);
      return [
        ...(low ? [
          { at: [earX, 0.112, 0.013] as XYZ, size: [0.061, 0.059, 0.041] as XYZ, color: spec.coat },
          { at: [earX, 0.121, 0.047] as XYZ, size: [0.035, 0.036, 0.014] as XYZ, color: spec.dark },
        ] : [
          { at: [earX, 0.198, 0.006] as XYZ, size: [0.092, fox ? 0.17 : 0.133, 0.073] as XYZ, color: spec.coat, coneInterior: spec.dark },
        ]),
        { at: [side * eyeX, eyeY, eyeZ] as XYZ, size: [low ? 0.029 : 0.034, low ? 0.033 : 0.04, 0.032] as XYZ, color: INK },
        { at: [side * (eyeX + 0.005), eyeY + 0.013, eyeZ + 0.025] as XYZ, size: [0.011, 0.012, 0.009] as XYZ, color: CREAM },
      ];
    }),
  ]); head.position.set(0, low ? 0.34 : 0.68, 0.39); head.name = "head"; rig.add(head);
  const tail = anatomy(material, [
    { at: [0, -0.015, -0.22], size: [fox ? 0.2 : 0.105, fox ? 0.17 : 0.1, low ? 0.32 : 0.34], color: spec.coat },
    { at: [0, -0.025, -0.46], size: [fox ? 0.14 : 0.07, fox ? 0.12 : 0.065, 0.13], color: fox ? CREAM : spec.dark },
  ]); tail.position.set(0, bodyY, -0.35); tail.rotation.x = low ? -0.1 : -0.3; tail.name = "tail"; rig.add(tail);
  const legGeometry = anatomy(material, [
    { at: [0, -hip * 0.34, 0], size: [low ? 0.057 : 0.075, hip * 0.66, 0.077], color: spec.coat },
    { at: [0, -hip + 0.05, 0.025], size: [low ? 0.062 : 0.073, 0.05, low ? 0.085 : 0.102], color: spec.dark },
  ]);
  const legs = Array.from({ length: 4 }, (_, i) => {
    const leg = i === 0 ? legGeometry : legGeometry.clone();
    leg.position.set(i % 2 ? 0.14 : -0.14, hip, i < 2 ? 0.28 : -0.3);
    leg.name = `leg-${i}`; leg.raycast = () => {};
    leg.matrixAutoUpdate = false;
    rig.add(leg); return leg;
  });
  return { object, body, head, tail, legs, hip };
}

function posePaws(surface: VillageWalkSurface, animal: ReturnType<typeof model>, spec: typeof SPECS[number], phase: number, gait: number, bob: number) {
  const { object, legs, hip } = animal;
  const { x, y, z } = object.position;
  const sin = Math.sin(object.rotation.y), cos = Math.cos(object.rotation.y);
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i], localX = leg.position.x, localZ = leg.position.z;
    const footPhase = villageFootPhase(phase, spec.footfalls[i]);
    const advance = villageFootTravel(footPhase, spec.stance, spec.cycle / spec.scale) * gait;
    const lift = villageFootLift(footPhase, spec.stance) * spec.lift * gait;
    const soleZ = localZ + advance + 0.025;
    const ground = surface.heightAt(x + (localX * cos + soleZ * sin) * spec.scale, z + (soleZ * cos - localX * sin) * spec.scale);
    const soleY = (ground - y) / spec.scale + lift;
    // Moving the bottom of each low-poly leg keeps the paws planted in one mesh each.
    leg.matrix.set(1, 0, 0, localX, 0, (hip + bob - soleY) / hip, 0, hip + bob, 0, -advance / hip, 1, localZ, 0, 0, 0, 1);
    leg.matrixWorldNeedsUpdate = true;
  }
}

function segmentClear(surface: VillageWalkSurface, ax: number, az: number, bx: number, bz: number, radius: number) {
  const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.12));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (!surface.isWalkable(ax + (bx - ax) * t, az + (bz - az) * t, radius)) return false;
  }
  return true;
}

export function createVillageAnimals(surface: VillageWalkSurface): VillageLifeController {
  const object = new THREE.Group(); object.name = "village-animals";
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
  const shadowGeometry = createVillageContactShadowGeometry();
  const shadowMaterial = new THREE.MeshBasicMaterial({ color: INK, vertexColors: true, transparent: true, opacity: 0.3, depthWrite: false });
  let seed = 4097, disposed = false;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const animals = SPECS.map((spec, index) => {
    const art = model(spec, material), preferred = paintingToGround(spec.painting[0], spec.painting[1]);
    let home = preferred, found = false;
    for (let ring = 0; ring <= 12 && !found; ring++) {
      for (let i = 0; i < Math.max(1, ring * 10); i++) {
        const angle = i / Math.max(1, ring * 10) * Math.PI * 2;
        const x = preferred[0] + Math.cos(angle) * ring * 0.35, z = preferred[1] + Math.sin(angle) * ring * 0.35;
        if (surface.isWalkable(x, z, spec.radius)) { home = [x, z]; found = true; break; }
      }
    }
    art.object.visible = found;
    art.object.position.set(home[0], surface.heightAt(...home), home[1]);
    art.object.rotation.y = index * 2;
    const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadow.name = "animal-contact-shadow"; shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.005;
    shadow.scale.set(0.94 * spec.scale, 1.57 * spec.scale, 1);
    shadow.raycast = () => {}; art.object.add(shadow);
    posePaws(surface, art, spec, index * 2, 0, 0);
    Object.assign(art.object.userData, { species: spec.species, state: "watch", speed: 0, radius: spec.radius, position: [...home], active: found });
    object.add(art.object);
    return { ...art, spec, home, active: found, state: "watch" as State, time: index * 2, remaining: 0.8 + index,
      decision: 0, target: null as [number, number] | null, speed: 0, phase: index * 2, gait: 0 };
  });
  return {
    object,
    update(frame) {
      if (disposed) return;
      const dt = Math.min(0.05, Math.max(0, Number.isFinite(frame.delta) ? frame.delta : 0));
      for (const animal of animals) {
        if (!animal.active || !frame.visible(animal.object, 1.5)) continue;
        if (frame.reduced) {
          if (animal.gait || animal.head.rotation.x || animal.head.rotation.y || animal.tail.rotation.y) {
            animal.speed = 0; animal.gait = 0; animal.object.userData.speed = 0;
            posePaws(surface, animal, animal.spec, animal.phase, 0, 0);
            animal.body.position.y = 0; animal.body.rotation.x = 0;
            animal.head.rotation.set(0, 0, 0); animal.tail.rotation.y = 0;
          }
          continue;
        }
        if (!dt) continue;
        animal.time += dt; animal.remaining -= dt; animal.decision -= dt;
        const p = animal.object.position, spec = animal.spec, oldYaw = animal.object.rotation.y;
        // Decisions are staggered and capped at four per second; every actual step is checked too.
        if (animal.decision <= 0) {
          animal.decision = 0.25;
          if (animal.state !== "wander" && animal.remaining <= 0) {
            for (let attempt = 0; attempt < 12; attempt++) {
              const angle = random() * Math.PI * 2, distance = 0.7 + random() * 1.6;
              const x = p.x + Math.sin(angle) * distance, z = p.z + Math.cos(angle) * distance;
              if (Math.hypot(x - animal.home[0], z - animal.home[1]) > spec.territory) continue;
              if (animals.some(other => other !== animal && other.active && Math.hypot(x - other.object.position.x, z - other.object.position.z) < spec.radius + other.spec.radius + 0.2)) continue;
              if (!segmentClear(surface, p.x, p.z, x, z, spec.radius)) continue;
              animal.target = [x, z]; animal.state = "wander"; break;
            }
            if (!animal.target) animal.remaining = 1;
          }
        }
        let moved = 0;
        if (animal.target) {
          const dx = animal.target[0] - p.x, dz = animal.target[1] - p.z, distance = Math.hypot(dx, dz);
          if (distance < 0.012) {
            animal.target = null;
            const choice = random();
            animal.state = choice < (spec.species === "fox" ? 0.65 : 0.35) ? "sniff" : choice < 0.85 ? "watch" : "pause";
            animal.remaining = spec.rest * (0.7 + random());
          } else {
            const heading = Math.atan2(dx, dz), turn = Math.atan2(Math.sin(heading - animal.object.rotation.y), Math.cos(heading - animal.object.rotation.y));
            animal.object.rotation.y += Math.max(-dt * 4.2, Math.min(dt * 4.2, turn));
            if (Math.abs(turn) <= 0.29) {
              const desired = Math.min(spec.speed, Math.sqrt(distance * 0.9));
              const speed = animal.speed + Math.max(-dt * 2, Math.min(dt * 1.5, desired - animal.speed));
              const step = Math.min(distance, speed * dt), x = p.x + dx / distance * step, z = p.z + dz / distance * step;
              const clearOfAnimals = animals.every(other => other === animal || !other.active || Math.hypot(x - other.object.position.x, z - other.object.position.z) > spec.radius + other.spec.radius + 0.15);
              if (clearOfAnimals && segmentClear(surface, p.x, p.z, x, z, spec.radius)) {
                p.x = x; p.z = z; moved = step;
              } else { animal.target = null; animal.state = "watch"; animal.remaining = 1; }
            }
          }
        }
        animal.speed = moved / dt;
        if (moved) p.y = surface.heightAt(p.x, p.z);
        animal.phase = (animal.phase + moved / spec.cycle * Math.PI * 2) % (Math.PI * 2);
        const easing = 1 - Math.exp(-dt * 10);
        const oldGait = animal.gait;
        animal.gait += (Math.min(1, animal.speed / (spec.speed * 0.7)) - animal.gait) * easing;
        if (animal.gait < 0.0001) animal.gait = 0;
        const gait = animal.gait, phase = animal.phase;
        const bob = Math.abs(Math.sin(phase)) * 0.019 * gait;
        if (gait || oldGait || moved || animal.object.rotation.y !== oldYaw) posePaws(surface, animal, spec, phase, gait, bob);
        animal.body.position.y = bob;
        animal.body.rotation.x = spec.species === "weasel" ? Math.sin(phase) * 0.055 * gait : 0;
        const sniff = animal.state === "sniff" ? Math.min(1, Math.max(0, animal.remaining) * 2) : 0;
        const pitch = sniff * (0.65 + Math.sin(animal.time * 5) * 0.05);
        const look = animal.state === "watch" ? Math.sin(animal.time * 0.8) * 0.4 : Math.sin(phase) * 0.035 * gait;
        animal.head.rotation.x += (pitch - animal.head.rotation.x) * easing;
        animal.head.rotation.y += (look - animal.head.rotation.y) * easing;
        animal.tail.rotation.y = (Math.sin(phase) * gait * 0.65 + Math.sin(animal.time * 1.1) * 0.35) * (spec.species === "fox" ? 0.2 : 0.12);
        const data = animal.object.userData;
        data.state = animal.state; data.speed = animal.speed; data.position[0] = p.x; data.position[1] = p.z;
      }
    },
    dispose() { if (!disposed) { disposed = true; disposeVillageObject(object); } },
  };
}
