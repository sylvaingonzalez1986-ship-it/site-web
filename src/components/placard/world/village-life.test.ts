import { describe, expect, it } from "vitest";
import { createVillageTerrain, disposeVillageObject } from "./village-terrain";
import { createVillageBuilding } from "./village-buildings";
import { VILLAGE_PLACES, villagePlacePosition } from "./village-layout";
import { createVillageAnimals } from "./village-animals";
import { createVillageWalkSurface } from "./village-walk-surface";
import { VILLAGE_BRETON_POSITION, VILLAGE_BRETON_RADIUS } from "./village-breton";

describe("life in the actual generated village", () => {
  it("keeps all three species moving on dry unobstructed ground for two minutes", () => {
    const terrain = createVillageTerrain();
    const buildings = VILLAGE_PLACES.map(place => ({ place, object: createVillageBuilding(place.id), position: villagePlacePosition(place) }));
    const surface = createVillageWalkSurface(terrain, buildings, [{ x: VILLAGE_BRETON_POSITION[0], z: VILLAGE_BRETON_POSITION[2], radius: VILLAGE_BRETON_RADIUS }]);
    const animals = createVillageAnimals(surface);
    const starts = animals.object.children.map(animal => animal.position.clone());
    const distances = [0, 0, 0], states = new Set<string>();
    try {
      expect(animals.object.children).toHaveLength(3);
      expect(terrain.userData.navigationObstacles.length).toBeGreaterThan(25);
      for (let tick = 0; tick < 3600; tick++) {
        animals.update({ time: tick / 30, delta: 1 / 30, reduced: false, quality: "low", visible: () => true });
        animals.object.children.forEach((animal, index) => {
          expect(animal.userData.active).toBe(true);
          const { x, z } = animal.position;
          expect(surface.isWalkable(x, z, animal.userData.radius)).toBe(true);
          distances[index] = Math.max(distances[index], animal.position.distanceTo(starts[index]));
          states.add(animal.userData.state);
        });
      }
      expect(distances.every(distance => distance > 0.6)).toBe(true);
      expect(states.has("sniff") && states.has("watch") && states.has("wander")).toBe(true);
    } finally { animals.dispose(); buildings.forEach(building => disposeVillageObject(building.object)); disposeVillageObject(terrain); }
  }, 20000);
});
