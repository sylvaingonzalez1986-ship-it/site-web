// Real campaign RPC integration in local PGlite, with the chronological
// campaign schema installed before the new condition migration.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";
import { PGlite } from "@electric-sql/pglite";
import { conditionChecks } from "./test-placard-warehouse-condition.mjs";

async function conditionCampaignChecks({ db, scalar, equal, reject, player, plan, layout, row, start, makeState, buddieCodes,
  vite, game, campaignEngine, battle, profiles, launch, action }) {
  const warehouse = await vite.ssrLoadModule("/src/lib/kanab-quest-warehouse.ts");
  const condition = await vite.ssrLoadModule("/src/lib/kanab-quest-warehouse-condition.ts");
  const prepareCondition = async owner => {
    const saved = await layout(owner), initial = condition.initializeKqWarehouseCondition(saved.state, false, randomUUID);
    await scalar("SELECT rpc_kq_warehouse_condition_initialize($1,$2,$3)", [owner, saved.revision, initial.assets]);
    const assets = initial.assets.map(asset => ({ ...asset, wearPercent: [20, 50, 80][Number(asset.zoneId?.split("-")[1])] ?? 0 }));
    await db.query("UPDATE kq_warehouse_layouts SET culture_assets=$2 WHERE user_id=$1", [owner, assets]);
    return layout(owner);
  };
  const buildCampaign = async owner => {
    const saved = await layout(owner);
    const members = saved.state.zones.filter(zone => zone.active && zone.buddieCode).map(zone => ({ runId: randomUUID(), zoneId: zone.id, buddieCode: zone.buddieCode,
      warehouse: warehouse.getKqWarehouseRunSnapshot(saved.state, saved.revision, zone.id, 2, 1, 1, saved.cultureEquipment),
      cultivationProfile: profiles.getKqBuddieCultivationProfile(zone.buddieCode) }));
    const campaign = { version: 1, id: randomUUID(), leaderRunId: members[0].runId, members };
    const lead = game.startKqGame(123, { warehouse: members[0].warehouse, varietyCode: members[0].buddieCode, domiciliation: "home", startingXp: 1 });
    lead.deckCodes = []; lead.handCodes = []; lead.collectionCodes = [];
    lead.campaign = campaign; lead.cultivationProfile = members[0].cultivationProfile;
    lead.xp += Math.max(...members.map(member => game.KQ_BUDDIES.find(buddie => buddie.code === member.buddieCode).advantageLevel))
      - game.KQ_BUDDIES.find(buddie => buddie.code === members[0].buddieCode).advantageLevel;
    return { members: members.map(member => ({ runId: member.runId, state: campaignEngine.getKqCampaignMemberState(lead, member) })),
      request: { campaign: true, buddieCode: members[0].buddieCode, deckCodes: [], cultureTokens: 0, heritageCode: null, energyMode: "balanced", expectedEnergyCents: null }, tokens: 0, heritageCode: null };
  };
  const owner = await player(plan(3)), before = await prepareCondition(owner), prepared = await buildCampaign(owner);
  equal(prepared.members.map(member => member.state.warehouse.estimatedHarvestGrams), [225, 187.5, 150], "three zones freeze their distinct 20/50/80 percent wear yields");
  for (const member of prepared.members) {
    const projection = await scalar("SELECT kq_warehouse_condition_projection($1)", [member.state.warehouse]);
    equal(projection.estimatedHarvestGrams, member.state.warehouse.estimatedHarvestGrams, "V2 projection ignores the other active zones in the complete sourceState");
    await scalar("SELECT kq_warehouse_validate_options_run($1)", [member.state.warehouse]);
  }
  const forged = structuredClone(prepared);
  forged.members[1].state.warehouse.yieldFactor = 1;
  await reject(() => launch(owner, forged), "warehouse_condition_changed");
  const key = randomUUID(), launched = await launch(owner, prepared, key);
  equal((await layout(owner)).activeRuns.length, 3, "the real campaign start accepts all three condition-aware member snapshots");
  equal((await layout(owner)).reservedHarvestGrams, 562.5, "shared capacity reserves the sum of the three distinct worn harvest caps");
  const saved = await row(launched.run.id);
  let completed = saved.state;
  while (completed.phase !== "complete") {
    if (completed.phase === "prepare") completed = game.rollKqDice(completed);
    else if (completed.phase === "rolled") completed = game.resolveKqStage({ ...completed, dice: [6, 6, 6] });
    else completed = game.advanceKqStage(completed);
  }
  const endings = completed.campaign.members.map(member => {
    const state = campaignEngine.getKqCampaignMemberState(completed, member), flower = battle.createKqFlower(state);
    return { runId: member.runId, state, flower: { varietyCode: state.varietyCode, varietyName: state.varietyName,
      quality: state.quality, traits: flower.traits, combos: state.combos, battleStats: flower.stats,
      integrityCode: flower.integrityCode, cannabinoidReport: flower.cannabinoidReport,
      cultivationProfile: flower.cultivationProfile, terpeneReport: flower.terpeneReport } };
  });
  const final = await action(owner, saved, completed, "advance", endings), after = await layout(owner);
  equal(final.flowers.length, 3, "the real campaign finalizer harvests each worn zone independently within one atomic command");
  equal(after.cultureEquipment.assets.map(asset => asset.wearPercent), before.cultureEquipment.assets.map(asset => asset.wearPercent + 5), "each member wears only its own assigned devices once despite earlier member updates");
  equal(Number(await scalar("SELECT count(*) FROM kq_warehouse_wear_receipts WHERE user_id=$1", [owner])), 3, "one distinct wear receipt is recorded per member run");
  equal(after.revision, before.revision + 3, "each member completion updates authoritative condition revision");
  equal((await action(owner, saved, completed, "advance", endings)).replayed, true, "campaign completion retry returns the original result");
  equal((await layout(owner)).cultureEquipment, after.cultureEquipment, "campaign retry does not wear any device again");
  equal((await launch(owner, prepared, key)).replayed, true, "start retry remains valid after wear changed all member conditions");

  // Independent runs exercise the same full-ledger capture across separate
  // commits. The first completion must not invalidate another active zone.
  const independent = await player(plan(3)), independentBefore = await prepareCondition(independent), runs = [];
  for (let index = 0; index < 2; index++) {
    const state = await makeState(independent, `zone-${index}`, buddieCodes[index]);
    state.warehouse = warehouse.getKqWarehouseRunSnapshot(independentBefore.state, independentBefore.revision, `zone-${index}`, 2, 1, 1, independentBefore.cultureEquipment);
    runs.push(await start(independent, `zone-${index}`, buddieCodes[index], { state }));
  }
  const finishOwn = async started => {
    const current = await row(started.run.id), next = { ...current.state, phase: "complete", harvestGrams: 100, quality: 9 };
    return scalar("SELECT rpc_kq_update_run_state($1,$2,$3,'advance',$4,$5)", [independent, current.id, current.updated_at, next,
      { varietyCode: next.varietyCode, varietyName: next.varietyName, quality: 9, traits: [], combos: [],
        battleStats: { appearance: 90, aroma: 90, vigor: 90, mastery: 90, regularity: 90 }, integrityCode: "KQ-1234ABCD" }]);
  };
  await finishOwn(runs[0]);
  equal((await row(runs[1].run.id)).status, "active", "first completion leaves the other captured zone running");
  await finishOwn(runs[1]);
  const independentAfter = await layout(independent);
  equal(independentAfter.cultureEquipment.assets.map(asset => asset.wearPercent), independentBefore.cultureEquipment.assets.map(asset => asset.wearPercent + (asset.zoneId === "zone-2" ? 0 : 5)), "independent completion tolerates another zone's changed ledger and preserves unused equipment");
  console.log("Warehouse condition campaigns: three distinct wear levels, full snapshots, actual campaign start/finalization/replays and independent completion passed.");
}

const sourceUrl = new URL("./test-placard-shared-campaigns.mjs", import.meta.url);
let source = (await readFile(sourceUrl, "utf8")).replaceAll("\r\n", "\n");
const marker = '    console.log("Shared campaigns: profiles, replay, common cards/care/dice, atomic flowers, costs, capacity, two-variety rotation and grants passed.");';
assert(source.includes(marker), "shared campaign fixture completion marker changed");
source = source.replace("getKqWarehouseRunSnapshot, getKqWarehouseQuote }) {", "getKqWarehouseRunSnapshot, getKqWarehouseQuote, makeState, harvest }) {")
  .replace("getKqWarehouseRunSnapshot, getKqWarehouseQuote });", "getKqWarehouseRunSnapshot, getKqWarehouseQuote, makeState, harvest });")
  .replace(marker, `    await conditionChecks({ db, sql, scalar, equal, reject, player, layout, start, harvest, makeState, buddieCodes });
    await conditionCampaignChecks({ db, scalar, equal, reject, player, plan, layout, row, start, makeState, buddieCodes, vite, game, campaignEngine, battle, profiles, launch, action });
${marker}`)
  .replace(/^import .*;\n/gm, "")
  .replace('new URL("./test-placard-zone-cultures.mjs", import.meta.url)', `new URL("./test-placard-zone-cultures.mjs", ${JSON.stringify(sourceUrl.href)})`)
  .replace('new URL(`../output/shared-campaign-migration/${file}.sql`, import.meta.url)', 'new URL(`../output/shared-campaign-migration/${file}.sql`, ' + JSON.stringify(sourceUrl.href) + ')');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
await new AsyncFunction("assert", "randomUUID", "readFile", "path", "createServer", "PGlite", "conditionChecks", "conditionCampaignChecks", source)(assert, randomUUID, readFile, path, createServer, PGlite, conditionChecks, conditionCampaignChecks);
