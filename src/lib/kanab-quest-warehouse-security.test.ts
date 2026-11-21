import { describe, expect, it } from "vitest";
import { getKqCampaignMemberState, getKqCampaignParticipants } from "./kanab-quest-campaign";
import { advanceKqStage, getKqRunProjection, resolveKqStage, startKqGame, type KqGameState } from "./kanab-quest-game";
import { encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";
import { createKqWarehouseStarter, getKqWarehouseQuote, getKqWarehouseRunSnapshot } from "./kanab-quest-warehouse";
import { getKqWarehouseCameraCoverage, getKqWarehouseSecurityCoverage } from "./kanab-quest-warehouse-security";

const camera = { x: 0, y: 4, bearing: 2 };

describe("la sécurité sur le plan enregistré", () => {
  it("oriente un champ à 90 degrés et s’arrête à six mètres", () => {
    const plan = createKqWarehouseStarter();
    const east = getKqWarehouseCameraCoverage(plan, camera);
    expect(east).toContain("1,3");
    expect(east).toContain("6,4");
    expect(east).not.toContain("7,4");
    expect(east).not.toContain("1,2");
    const south = getKqWarehouseCameraCoverage(plan, { ...camera, bearing: 4 });
    expect(south).toContain("1,5");
    expect(south).not.toContain("6,4");
  });

  it("arrête la vue derrière une cloison ou une centrale et ne double pas le recouvrement", () => {
    const plan = { ...createKqWarehouseStarter(), partitions: [{ id: "partition", x: 3, y: 2, length: 5, axis: "y" as const }],
      stationPlacements: [{ id: "station", x: 1, y: 4, code: "SIM-WATER-03" as const }] };
    const wall = getKqWarehouseCameraCoverage({ ...plan, stationPlacements: [] }, camera);
    expect(wall).toContain("2,4");
    expect(wall).not.toContain("4,4");
    const devices = [{ id: "a", placement: camera }, { id: "b", placement: { x: 0, y: 1, bearing: 4 } }];
    const blocked = getKqWarehouseCameraCoverage(plan, camera);
    expect(blocked).not.toContain("2,4");
    expect(getKqWarehouseCameraCoverage(plan, { ...camera, x: 1 }).size).toBe(0);
    const full = getKqWarehouseSecurityCoverage(plan, devices);
    expect(full.visible.size).toBeLessThan(devices.reduce((total, item) => total + getKqWarehouseCameraCoverage(plan, item.placement).size, 0));
    expect(full.zones.every(zone => zone.covered <= zone.area)).toBe(true);
  });
});

function atTheft(state = startKqGame(21, { warehouse: getKqWarehouseRunSnapshot(createKqWarehouseStarter(), 1, "starter") })): KqGameState {
  while (state.stageIndex < 4) state = advanceKqStage(resolveKqStage({ ...state, phase: "rolled", dice: [6, 6, 6] }));
  state.situationCodes[4] = "SIT-027";
  return { ...state, phase: "rolled", dice: [1, 2, 2] };
}

describe("le vol simulé dans l’entrepôt", () => {
  it("consigne un vol réel et applique chaque couche de protection", () => {
    const theft = atTheft();
    expect(resolveKqStage(theft).harvestLossPercent).toBe(35);
    expect(resolveKqStage(theft, { alarm: true, monitored: false, filmed: {} }).harvestLossPercent).toBe(26);
    expect(resolveKqStage(theft, { alarm: false, monitored: false, filmed: { starter: 50 } }).harvestLossPercent).toBe(26);
    const protectedCrop = resolveKqStage(theft, { alarm: true, monitored: true, filmed: { starter: 100 } });
    expect(getKqRunProjection(protectedCrop).harvestLossPercent).toBe(0);
    expect(protectedCrop.history.at(-1)?.decision?.warehouseSecurity).toEqual({ alarm: true, monitored: true, filmed: { starter: 100 } });
    expect(parseKqGameSave(encodeKqSave(protectedCrop))?.history).toEqual(protectedCrop.history);
    expect(parseKqGameSave(encodeKqSave({ ...protectedCrop, harvestLossPercent: 10 }))).toBeNull();
  });

  it("ignore les protections pour les situations sans vol et laisse le chien protéger le lot", () => {
    const state = atTheft();
    const protection = { alarm: true, monitored: true, filmed: { starter: 100 } };
    expect(resolveKqStage({ ...state, playedThisStage: ["BOTTE-034"] }, protection).history.at(-1)?.decision?.warehouseSecurity).toBeUndefined();
    state.situationCodes[4] = "SIT-025";
    expect(resolveKqStage(state, protection)).toEqual(resolveKqStage(state));
  });

  it("conserve la perte individuelle des zones couvertes et découvertes d’une campagne", () => {
    const base = createKqWarehouseStarter();
    const plan = getKqWarehouseQuote({ ...base, zones: [
      { ...base.zones[0], id: "a", x: 0, y: 1, width: 2, height: 2, buddieCode: "HH2026-002" },
      { ...base.zones[0], id: "b", x: 5, y: 1, width: 2, height: 2, buddieCode: "HH2026-003" },
    ] }).nextState;
    const members = getKqCampaignParticipants(plan, 1).map((member, index) => ({ ...member, runId: `11111111-1111-4111-8111-11111111111${index}` }));
    const [leader, second] = members;
    const start = startKqGame(21, { warehouse: leader.warehouse, varietyCode: leader.buddieCode, cultivationProfile: leader.cultivationProfile });
    start.campaign = { version: 1, id: "22222222-2222-4222-8222-222222222222", leaderRunId: leader.runId, members };
    const resolved = resolveKqStage(atTheft(start), { alarm: false, monitored: false, filmed: { a: 100 } });
    expect(resolved.harvestLossPercent).toBe(26);
    expect(getKqRunProjection(resolved).harvestLossPercent).toBe(18);
    const neighbour = getKqCampaignMemberState(resolved, second);
    expect(getKqRunProjection(neighbour).harvestLossPercent).toBe(35);
    expect(parseKqGameSave(encodeKqSave(neighbour))?.history).toEqual(resolved.history);
  });
});
