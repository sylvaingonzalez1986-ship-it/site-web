import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getKqWarehouseZoneLightingLayout } from "@/lib/kanab-quest-warehouse-fixtures";
import { findLightingAt, getRoomLightingRows, projectLightingHit, RoomLightingOverlay, type LightingZone } from "./KqGrowRoomLightingOverlay";

const zone: LightingZone = { id: "culture", x: 2, y: 3, width: 4, height: 3, rotation: 90, active: true, lightingCode: "SIM-LIGHT-02" };
const project = (x: number, height: number, y: number) => ({ x: x - y / 2, y: y + x / 3 - height });

describe("la lecture des lampes sur le plan perspectif", () => {
  it.each([0, 90, 180, 270] as const)("utilise les centres et emprises du plan tourné à %s°", rotation => {
    const rotated = { ...zone, rotation };
    const fixtures = getKqWarehouseZoneLightingLayout(rotated);
    const lamps = getRoomLightingRows(rotated);
    expect(lamps).toHaveLength(6);
    expect(new Set(lamps.map(lamp => lamp.row)).size).toBeGreaterThan(1);
    expect(lamps.reduce((area, lamp) => area + lamp.area, 0)).toBeCloseTo(zone.width * zone.height);
    for (const [index, lamp] of lamps.entries()) {
      expect(lamp.center).toEqual({ x: zone.x + fixtures[index].x, y: zone.y + fixtures[index].z });
      expect(lamp.index).toBe(index);
      for (const point of lamp.footprint) {
        expect(point.x).toBeGreaterThanOrEqual(zone.x);
        expect(point.x).toBeLessThanOrEqual(zone.x + zone.width);
        expect(point.y).toBeGreaterThanOrEqual(zone.y);
        expect(point.y).toBeLessThanOrEqual(zone.y + zone.height);
      }
    }
  });

  it("conserve les limites des autres lampes lors d’une inspection ciblée et retire le faisceau en pause", () => {
    const lamps = getRoomLightingRows(zone);
    const render = (state: "lit" | "paused") => renderToStaticMarkup(createElement("svg", null,
      createElement(RoomLightingOverlay, { zoneId: zone.id, lamps, state, showCoverage: true, flat: true, project, zoom: 1, lightingIndex: 2 })));
    const inspected = render("lit");
    expect(inspected.match(/data-lighting-footprint=/g)).toHaveLength(lamps.length);
    expect(inspected.match(/data-lighting-beam=/g)).toHaveLength(1);
    expect(inspected).toContain('data-lighting-beam="true" data-lighting-index="2"');
    expect(render("paused")).not.toContain("data-lighting-beam");
    expect(getRoomLightingRows({ ...zone, lightingCode: "UNLIT" })).toEqual([]);
  });

  it("groupe les luminaires illustrés sans perdre les unités sur une grande surface", () => {
    const lamps = getRoomLightingRows({ ...zone, width: 30, height: 20, lightingCode: "MH-TS1000" });
    const markup = renderToStaticMarkup(createElement("svg", null,
      createElement(RoomLightingOverlay, { zoneId: zone.id, lamps, state: "lit", showCoverage: false, flat: true, project, zoom: 1 })));
    const bodies = [...markup.matchAll(/data-lighting-body="true" data-lighting-batch="(\d+)"/g)];
    expect(bodies.length).toBeGreaterThan(1);
    expect(bodies.reduce((total, match) => total + Number(match[1]), 0)).toBe(lamps.length);
    expect(markup).not.toContain("data-lighting-beam");
  });

  it("distingue la première lampe de la cible clavier centrale à la projection", () => {
    const lamps = getRoomLightingRows(zone);
    const rows = [{ zone, lamps }];
    const first = projectLightingHit(lamps[0], project);
    expect(findLightingAt(rows, { x: first.x + .05, y: first.y }, project, .4)).toEqual({ zoneId: zone.id, index: 0 });
    expect(findLightingAt(rows, { x: -12, y: 8 }, project, .4)).toBeUndefined();
  });
});
