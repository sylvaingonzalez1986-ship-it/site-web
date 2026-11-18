import { describe, expect, it } from "vitest";
import { getGrowRoomShellRegistration } from "./KqGrowRoomShellRegistration";
import { cameraScale, OVERVIEW, projectRoomPoint } from "./KqGrowRoomProjection";
import type { WarehouseSpatialLayout } from "@/lib/kanab-quest-warehouse-spatial";

const floors: WarehouseSpatialLayout[] = [ [10,10], [40,25] ].map(([width,depth]) => ({
  version: 1, width, depth, entry: {x:0, z:depth / 2 + .7}, items: [],
}));

describe("registration of the renovated overhead room", () => {
  it("registers the same painted door with the two existing SVG grids", () => {
    const starter = getGrowRoomShellRegistration(floors[0]);
    // The compact head-on artwork occupies 400 CSS viewBox units, with 30 units per metre.
    expect(starter.x(128)).toBeCloseTo(-5);
    expect(starter.z(896)).toBeCloseTo(5);
    expect(starter.landmark("south-door").x).toBeCloseTo(0);
    expect(starter.landmark("south-door").z).toBeCloseTo(5.625);
    const legacy = getGrowRoomShellRegistration(floors[1]);
    // Archived plan projects the 1024px image into a 1536 × 1024 viewBox before the grid transform.
    expect(legacy.x(112)).toBeCloseTo(-20);
    expect(legacy.z(870)).toBeCloseTo(12.5);
    expect(legacy.landmark("south-door").z).toBeCloseTo(14.9666667);
    for(const plan of floors){
      const s=getGrowRoomShellRegistration(plan);
      expect(plan.entry.x).toBeGreaterThan(s.x(409));
      expect(plan.entry.x).toBeLessThan(s.x(615));
      expect(plan.entry.z).toBeGreaterThanOrEqual(s.z(889));
      expect(plan.entry.z).toBeLessThan(s.z(988));
    }
  });

  it.each(floors)("keeps fixture side, the existing paid floor and the complete building in the overview", layout => {
    const s=getGrowRoomShellRegistration(layout), width=304,height=308,scale=cameraScale(layout,width,height,1);
    expect(s.landmark("west-power").x).toBeLessThan(-layout.width/2);
    expect(s.landmark("east-lamp").x).toBeGreaterThan(layout.width/2);
    expect(s.landmark("north-extractor").z).toBeLessThan(-layout.depth/2);
    expect(s.landmark("north-power").x).toBeGreaterThan(s.landmark("north-extractor").x);
    for(const id of s.landmarks){
      const marker=s.landmark(id);
      for(const elevation of [0,s.wallHeight]){
        const p=projectRoomPoint(marker.x,elevation,marker.z,OVERVIEW,scale,width,height);
        expect(p.x).toBeGreaterThan(0); expect(p.x).toBeLessThan(width);
        expect(p.y).toBeGreaterThan(0); expect(p.y).toBeLessThan(height);
      }
    }
  });
});
