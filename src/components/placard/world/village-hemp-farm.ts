import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { HEMP_FARM, HEMP_FARM_SITE, mainlandToGround } from "./village-layout";
import { projectVillageSurface, villageMaterial } from "./village-surfaces";

type Point = readonly [across: number, depth: number];

/** The barn silhouette is a separate pick target, excluding its fields and road. */
export function createVillageHempFarmCollider() {
  const { width, depth, wall, rise } = HEMP_FARM.footprint;
  const profile = new THREE.Shape();
  profile.moveTo(-width / 2, 0);
  profile.lineTo(width / 2, 0);
  profile.lineTo(width / 2, wall);
  profile.lineTo(0, wall + rise);
  profile.lineTo(-width / 2, wall);
  profile.closePath();
  return new THREE.ExtrudeGeometry(profile, { depth: depth + .3, bevelEnabled: false })
    .translate(0, 0, -(depth + .3) / 2);
}

export function createVillageHempFarmLandscape(groundHeight: (x: number, z: number) => number) {
  const group = new THREE.Group();
  group.name = "village-hemp-farm-landscape";
  const position = (across: number, depth: number, lift = 0) => {
    const [x, z] = mainlandToGround(across, depth);
    return new THREE.Vector3(x, groundHeight(x, z) + lift, z);
  };
  const mount = (geometry: THREE.BufferGeometry, material: THREE.Material, name: string, castShadow = false) => {
    const surface = new THREE.Mesh(geometry, material);
    surface.name = name;
    surface.receiveShadow = true;
    surface.castShadow = castShadow;
    surface.raycast = () => {};
    group.add(surface);
  };
  function ribbon(points: readonly Point[], halfWidth: number, color: string, name: string) {
    const curve = new THREE.CatmullRomCurve3(points.map(([across, depth]) => new THREE.Vector3(across, 0, depth)));
    const vertices: number[] = [], pigments: number[] = [], indices: number[] = [];
    const paint = new THREE.Color(color);
    const sections = Math.max(6, Math.ceil(curve.getLength() * 5));
    for (let i = 0; i <= sections; i++) {
      const s = i / sections, point = curve.getPoint(s), tangent = curve.getTangent(s);
      for (const side of [-1, 0, 1]) {
        const offset = side * halfWidth * (1 + .11 * Math.sin(i * .76 + side));
        vertices.push(...position(point.x + tangent.z * offset, point.z - tangent.x * offset, .075).toArray());
        pigments.push(...paint.clone().multiplyScalar(1 + .045 * Math.sin(i * 1.3 + side)).toArray());
      }
      if (i === 0) continue;
      const j = (i - 1) * 3;
      indices.push(j, j + 3, j + 1, j + 1, j + 3, j + 4);
      indices.push(j + 1, j + 4, j + 2, j + 2, j + 4, j + 5);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(pigments, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const surface = geometry.toNonIndexed();
    geometry.dispose();
    projectVillageSurface(surface, "silt");
    mount(surface, villageMaterial({ vertexColors: true, roughness: 1 }, "silt"), name);
  }

  ribbon([[HEMP_FARM_SITE.across - 1.45, HEMP_FARM_SITE.depth + 1.45], [3.05, -24.1], [2, -24.8],
    [.2, -25.9], [-1.8, -27.25], [-4.1, -28.6], [-7.25, -29.9], [-8.9, -31.9], [-9.6, -38]], .73, "#c7b294", "hemp-farm-track");
  const stems: THREE.BufferGeometry[] = [], leaves: THREE.BufferGeometry[] = [], stubble: THREE.BufferGeometry[] = [];
  const add = (batch: THREE.BufferGeometry[], geometry: THREE.BufferGeometry, at: THREE.Vector3) => {
    geometry.translate(at.x, at.y, at.z);
    batch.push(geometry);
  };
  for (let row = 0; row < 4; row++) {
    const depth = -29.1 - row * .87;
    const across = -3.05 + row * .20;
    ribbon([[across, depth], [across + 2.75, depth + .22], [across + 5.6, depth + .07]], .31, "#91734e", "hemp-farm-furrow");
    for (let col = 0; col < 10; col++) {
      const at = position(across + .22 + col * .55, depth + .15 * Math.sin(col * .32) + .035 * Math.sin(col * 2.9 + row), .065);
      const height = .59 + .23 * (.5 + .5 * Math.sin(col * 2.14 + row));
      add(stems, new THREE.CylinderGeometry(.022, .043, height, 5).translate(0, height / 2, 0), at);
      add(stubble, new THREE.CylinderGeometry(.027, .046, .19, 5).rotateZ(Math.sin(col + row) * .28).translate(0, .095, 0), at);
      for (let tier = 0; tier < 2; tier++) for (let leaflet = 0; leaflet < 5; leaflet++) {
        const angle = leaflet * Math.PI * .4 + col * 1.45 + tier * .62;
        const reach = tier ? .14 : .22;
        add(leaves, new THREE.IcosahedronGeometry(1).scale(reach, .038, .058).rotateZ(tier ? .37 : .18)
          .translate(reach * .67, height * (tier ? .92 : .66), 0).rotateY(angle), at);
      }
    }
  }
  for (const [batch, name, color] of [[stems, "hemp-farm-stems", "#668341"], [leaves, "hemp-farm-leaves", "#51894a"],
    [stubble, "hemp-farm-stubble", "#9a794a"]] as const) {
    const geometry = mergeGeometries(batch)!;
    batch.forEach(part => part.dispose());
    mount(geometry, villageMaterial({ color, roughness: 1, flatShading: true }), name, true);
  }
  group.getObjectByName("hemp-farm-stubble")!.visible = false;
  return group;
}
