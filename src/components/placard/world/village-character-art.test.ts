import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { characterDisposer, characterMaterial, createCharacterFace } from "./village-character-art";

describe("shared illustrated village face", () => {
  it("blinks on the shared clock, holds the reduced pose and keeps its mouth contact anchor", () => {
    const rig = new THREE.Group(), material = characterMaterial();
    const face = createCharacterFace(rig, material, "breton");
    const mouthAnchor = face.mouth.position.clone();
    const offset = ("breton".charCodeAt(0) % 11) * 0.25;
    face.setExpression(2.58 - offset, false, 0, 0, 0.1);
    expect(face.eyes.scale.y).toBeLessThan(0.1);
    const closedMouth = face.mouth.scale.y;
    face.setExpression(2.58 - offset, true, 1, 0.7, 1, 0.8);
    expect(face.eyes.scale.y).toBeGreaterThan(0.9);
    expect(face.mouth.scale.y).toBeGreaterThan(closedMouth * 2);
    expect(face.mouth.position.equals(mouthAnchor)).toBe(true);
    expect(face.brows[0].position.y).toBeGreaterThan(face.brows[1].position.y);
    expect(face.eyes.rotation.y).toBeGreaterThan(0);
    expect(material.flatShading).toBe(false);
    characterDisposer(rig).dispose();
  });
});
