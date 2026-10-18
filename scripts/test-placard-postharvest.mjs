// Isolated PostgreSQL only; no credentials and no deployed database writes.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";
import { PGlite } from "@electric-sql/pglite";
import { climateBillingChecks } from "./test-placard-climate-billing.mjs";
import { qualityTierChecks } from "./test-placard-quality-tiers.mjs";

async function postHarvestChecks({ db, sql, scalar, equal, reject, player, layout, start, harvest, buddieCodes }) {
  const vite = await createServer({ configFile: false, envDir: false, resolve: { alias: { "@": path.resolve("src") } }, server: { middlewareMode: true, watch: null, hmr: false, ws: false } });
  try {
    const warehouse = await vite.ssrLoadModule("/src/lib/kanab-quest-warehouse.ts");
    const storage = await vite.ssrLoadModule("/src/lib/kanab-quest-storage.ts");
    const model = await vite.ssrLoadModule("/src/lib/kanab-quest-post-harvest.ts");
    const catalog = await vite.ssrLoadModule("/src/lib/kanab-quest-warehouse-catalog.ts");
    const energy = await vite.ssrLoadModule("/src/lib/kanab-quest-warehouse-run.ts");
    const oldLots = await scalar("SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY flower_id),'[]'::jsonb) FROM kq_storage_lots s");
    await db.exec(await sql("20261018000500_kq_postharvest_quality.sql"));
    equal(await scalar("SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY flower_id),'[]'::jsonb) FROM kq_storage_lots s"), oldLots, "migration leaves every existing lot and revision unchanged");
    const seedOwner = await player(), seedPlan = (await layout(seedOwner)).state;
    const legacyPlan = warehouse.getKqWarehouseQuote({ ...seedPlan, storageClimateCode: "SIM-STORAGE-CLIMATE-01" }, seedPlan).nextState;
    const legacyOwner = await player(legacyPlan), legacyLayout = await layout(legacyOwner);
    const legacyWarehouse = warehouse.getKqWarehouseRunSnapshot(legacyLayout.state, legacyLayout.revision, "zone-0", 2, 1, 1);
    const legacyState = { rulesVersion: 2, seed: 123, xp: 1, deckCodes: [], usedCards: [], playedThisStage: [], situationCodes: Array.from({ length: 6 }, (_, index) => `SIT-00${index + 1}`),
      varietyCode: buddieCodes[0], varietyName: "Fixture", stageIndex: 0, phase: "ready", history: [], domiciliation: "home", warehouse: legacyWarehouse,
      equipment: { codes: [], levels: {}, quantityPercent: 0, qualityMaxBonus: 0, regularityPercent: 0, pressureDelta: 0, powerWatts: 0, energyDiscountPercent: 0, processingPrecision: 0, processingCapacityPercent: 0, unlocks: [] }, energy: energy.quoteKqWarehouseEnergy(legacyWarehouse) };
    const legacyStart = await start(legacyOwner, "zone-0", buddieCodes[0], { state: legacyState });
    const beforeMonthly = await scalar("SELECT jsonb_build_object('runs',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM kq_runs r),'layouts',(SELECT jsonb_agg(to_jsonb(l) ORDER BY user_id) FROM kq_warehouse_layouts l),'energy',(SELECT jsonb_agg(to_jsonb(i) ORDER BY run_id) FROM kq_energy_invoices i))");
    await db.exec(await sql("20261018000600_kq_postharvest_prices_and_climate_billing.sql"));
    equal(await scalar("SELECT jsonb_build_object('runs',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM kq_runs r),'layouts',(SELECT jsonb_agg(to_jsonb(l) ORDER BY user_id) FROM kq_warehouse_layouts l),'energy',(SELECT jsonb_agg(to_jsonb(i) ORDER BY run_id) FROM kq_energy_invoices i))"), beforeMonthly, "monthly migration preserves every owned layout, run and historical invoice exactly");
    await db.exec("BEGIN");

    for (const code of ["SIM-STORAGE-CLIMATE-01", "SIM-STORAGE-CLIMATE-02", "SIM-STORAGE-CLIMATE-03"]) {
      const expected = catalog.getKqWarehouseDevice(code), actual = await scalar("SELECT kq_warehouse_device($1)", [code]);
      for (const field of ["code", "kind", "tier", "priceCents", "watts"]) equal(actual[field], expected[field], `${code} SQL/TS ${field}`);
      equal(actual.gameCapacity, { unit: expected.gameCapacity.unit, value: expected.gameCapacity.value }, `${code} coverage agrees`);
    }

    const owner = await player(), original = await layout(owner);
    const draft = { ...original.state, storageClimateCode: "SIM-STORAGE-CLIMATE-03", serviceZones: original.state.serviceZones.map(zone => ({
      ...zone, deviceCode: zone.kind === "drying" ? "SIM-DRYING-03" : "CURTEC-60L",
    })) };
    const quote = warehouse.getKqWarehouseQuote(draft, original.state);
    const requestKey = randomUUID();
    const save = (key = requestKey, state = quote.nextState, cost = quote.totalCostCents) => scalar("SELECT rpc_kq_warehouse_save($1,$2,$3,$4,$5,$6,$7)", [owner, key,
      { state: draft, expectedRevision: original.revision, expectedCostCents: cost }, original.revision, original.state, state, cost]);
    await reject(() => save(randomUUID(), { ...quote.nextState, equipment: quote.nextState.equipment.filter(item => item.code !== draft.storageClimateCode) }), "warehouse_equipment_missing");
    await reject(() => save(randomUUID(), quote.nextState, quote.totalCostCents - 1), "warehouse_price_changed");
    await reject(() => scalar("SELECT kq_warehouse_catalog_projection($1)", [{ ...quote.nextState, serviceZones: [], storageClimateCode: draft.storageClimateCode }]), "warehouse_storage_climate_invalid");
    await reject(() => scalar("SELECT kq_warehouse_catalog_projection($1)", [{ ...quote.nextState, storageClimateCode: "CURTEC-60L" }]), "warehouse_storage_climate_invalid");
    const bought = await save();
    equal(bought.cashCents, original.cashCents - quote.totalCostCents, "real warehouse transaction charges climate and room upgrades exactly once");
    equal((await save()).receipt.replayed, true, "climate purchase replay uses the original receipt");
    equal((await layout(owner)).cashCents, bought.cashCents, "climate purchase replay does not debit twice");
    const { containerQualityBonus, curingBonusWeightedMs, ...profile } = await scalar("SELECT kq_warehouse_postharvest_profile($1)", [bought.state]);
    equal(profile, model.getKqWarehousePostHarvestProfile(bought.state, 1), "historical room profile agrees with TypeScript");
    equal(profile.dryingQualityBonus, .4, "premium drying contributes 0.4 quality points");
    equal(profile.aromaRateFactor, 42, "premium storage and climate combine to 42 percent exposure");
    equal(containerQualityBonus, 0, "room profile does not invent containers");
    equal(curingBonusWeightedMs, 0, "room profile contains no elapsed bonus");
    const boundaryPlan = { ...original.state, serviceZones: [
      { ...original.state.serviceZones.find(zone => zone.kind === "storage"), id: "standard-boundary", deviceCode: "BROR-JARS-48", width: 5, height: 1 },
      { ...original.state.serviceZones.find(zone => zone.kind === "storage"), id: "premium-boundary", deviceCode: "CURTEC-60L", width: 9, height: 1 },
    ] };
    const boundaryProfile = await scalar("SELECT kq_warehouse_postharvest_profile($1)", [boundaryPlan]);
    equal(Number(boundaryProfile.storageQualityBonus), .29, "mixed rooms round the exact 0.285 bonus upwards");
    equal(model.getKqWarehousePostHarvestProfile(boundaryPlan, 1).storageQualityBonus, Number(boundaryProfile.storageQualityBonus), "mixed room centipoint rounding agrees between TypeScript and PostgreSQL");
    const boundaryCapacity = { totalUnits: 30000, allocations: [{ containerCode: "BOVEDA-1L", quantity: 58, storedUnits: 29000 }], overflowDeadlineAt: "2026-10-18T12:00:00.000Z" };
    const boundaryContainerBonus = Number(await scalar("SELECT kq_storage_container_quality_bonus($1)", [boundaryCapacity]));
    equal(boundaryContainerBonus, .15, "partial Boveda allocation rounds the exact 0.145 bonus upwards");
    equal(storage.getKqStorageContainerQualityBonus({ methodCode: "STORAGE-GLASS", capacity: boundaryCapacity }), boundaryContainerBonus, "partial container centipoint rounding agrees between TypeScript and PostgreSQL");
    const runSnapshot = warehouse.getKqWarehouseRunSnapshot(bought.state, bought.revision);
    await scalar("SELECT kq_warehouse_validate_catalog_run($1)", [runSnapshot]);
    const zoneSnapshots = bought.state.zones.filter(zone => zone.active).map(zone => warehouse.getKqWarehouseRunSnapshot(bought.state, bought.revision, zone.id));
    for (const snapshot of zoneSnapshots) await scalar("SELECT kq_warehouse_validate_postharvest_run($1)", [snapshot]);
    equal(Math.round(zoneSnapshots.reduce((sum, snapshot) => sum + snapshot.energyKwh, 0) * 1000) / 1000, runSnapshot.energyKwh, "zone runs retain culture energy while climate is billed monthly");
    await reject(() => scalar("SELECT kq_warehouse_validate_postharvest_run($1)", [{ ...zoneSnapshots[0], energyCostCents: 0 }]), "warehouse_layout_changed");

    const started = await start(owner, "zone-0", buddieCodes[0]);
    const result = await harvest(started.run.id);
    const flowerId = result.flower?.id ?? await scalar("SELECT id FROM kq_flowers WHERE run_id=$1", [started.run.id]);
    await db.query("UPDATE kq_flowers SET status='burned',burned_at=date_trunc('milliseconds',now()) WHERE id=$1", [flowerId]);
    const created = await scalar("SELECT state FROM kq_storage_lots WHERE flower_id=$1", [flowerId]);
    equal(created.postHarvest.dryingQualityBonus, .4, "new real harvest freezes the culture's premium drying room");
    equal(created.postHarvest.climateQualityBonus, .3, "new real harvest receives the installed climate");
    equal(created.postHarvest.containerQualityBonus, 0, "ordinary drums retain their actual glass protection family");
    const at = Date.parse(created.curingStartedAt), hour = 3600000;
    const projectSql = (lot, time, jury = 8) => scalar("SELECT kq_storage_condition($1,$2,$3)", [lot, jury, new Date(time).toISOString()]);
    const boundaryLot = { ...created, capacity: boundaryCapacity, postHarvest: { ...created.postHarvest, containerQualityBonus: boundaryContainerBonus } };
    equal(Number((await projectSql(boundaryLot, at + 6 * hour)).conditionScore), storage.projectKqStorageLot(boundaryLot, at + 6 * hour, 8).conditionScore, "boundary container rounding reaches the same final commercial quality");
    for (const elapsed of [0, hour, 3 * hour, 6 * hour, 8 * hour, 30 * 24 * hour]) {
      const actual = await projectSql(created, at + elapsed), expected = storage.projectKqStorageLot(created, at + elapsed, 8);
      equal(Number(actual.conditionScore), expected.conditionScore, `SQL/TS commercial quality agrees at ${elapsed / hour} hours`);
      equal(Number(actual.qualityDelta), expected.qualityDelta, `SQL/TS quality delta agrees at ${elapsed / hour} hours`);
    }
    for (const jury of [8.285, 9.995]) for (const elapsed of [6 * hour, 30 * 24 * hour]) {
      const actual = await projectSql(created, at + elapsed, jury), expected = storage.projectKqStorageLot(created, at + elapsed, jury);
      equal(Number(actual.conditionScore), expected.conditionScore, `SQL/TS decimal half rounding agrees for jury ${jury} at ${elapsed / hour} hours`);
      equal(Number(actual.qualityDelta), expected.qualityDelta, `SQL/TS delta after decimal half rounding agrees for jury ${jury} at ${elapsed / hour} hours`);
    }
    equal(Number((await projectSql(created, at + 6 * hour)).conditionScore), 9, "all six hours earn the full 0.4 drying plus 0.6 storage/climate bonus");
    equal(Number((await projectSql(created, at + 6 * hour, 9.8)).conditionScore), 10, "commercial quality cannot exceed ten");
    const half = await scalar("SELECT kq_storage_settle($1,$2)", [created, new Date(at + 3 * hour).toISOString()]);
    const weaker = { ...half, postHarvest: { ...half.postHarvest, storageQualityBonus: 0, climateQualityBonus: 0, aromaRateFactor: 100, chemistryRateFactor: 100 } };
    equal(Number((await projectSql(weaker, at + 6 * hour)).conditionScore), 8.7, "switching protection preserves the first half and changes only future curing");
    const repeated = await scalar("SELECT kq_storage_settle($1,$2)", [half, new Date(at + 3 * hour).toISOString()]);
    equal(repeated.postHarvest.curingBonusWeightedMs, half.postHarvest.curingBonusWeightedMs, "repeated settlement cannot mint curing quality");
    const complete = await scalar("SELECT kq_storage_settle($1,$2)", [created, new Date(at + 6 * hour).toISOString()]);
    const later = await scalar("SELECT kq_storage_settle($1,$2)", [complete, new Date(at + 30 * 24 * hour).toISOString()]);
    equal(later.postHarvest.curingBonusWeightedMs, complete.postHarvest.curingBonusWeightedMs, "quality accumulation ends when curing finishes");

    const overflow = { ...created, capacity: { totalUnits: 1000, allocations: [], overflowDeadlineAt: new Date(at + hour).toISOString() } };
    const exposed = await scalar("SELECT kq_storage_settle($1,$2)", [overflow, new Date(at + hour).toISOString()]);
    equal(Number(exposed.exposure.aromaWeightedMs), hour * 100, "climate does not protect stock without a container");
    equal(Number(exposed.postHarvest.curingBonusWeightedMs), 0, "unprotected surplus earns no curing bonus");
    const mixed = { ...created, capacity: { totalUnits: 1000, allocations: [{ containerCode: "CVAULT-2OZ", quantity: 1, storedUnits: 500 }], overflowDeadlineAt: new Date(at + hour).toISOString() } };
    mixed.postHarvest = { ...mixed.postHarvest, containerQualityBonus: .1 };
    equal(Number(await scalar("SELECT kq_storage_container_quality_bonus($1)", [mixed.capacity])), .1, "container quality is weighted by protected mass");
    const mixedSettled = await scalar("SELECT kq_storage_settle($1,$2)", [mixed, new Date(at + hour).toISOString()]);
    const mixedTs = storage.settleKqStorageLot(mixed, at + hour);
    equal(mixedSettled.exposure, mixedTs.exposure, "mixed container and overflow exposure matches TypeScript");
    equal(Number(mixedSettled.postHarvest.curingBonusWeightedMs), mixedTs.postHarvest.curingBonusWeightedMs, "mixed protected bonus matches TypeScript");

    const legacy = { ...created }; delete legacy.postHarvest;
    equal(Number((await projectSql(legacy, at + 6 * hour)).conditionScore), 8, "old lot without a profile keeps historical quality");

    const oldOwner = await player(), oldPlan = await layout(oldOwner);
    const oldStarted = await start(oldOwner, "zone-0", buddieCodes[0]);
    await harvest(oldStarted.run.id);
    const oldFlower = await scalar("SELECT id FROM kq_flowers WHERE run_id=$1", [oldStarted.run.id]);
    const nextDraft = { ...oldPlan.state, storageClimateCode: "SIM-STORAGE-CLIMATE-02", serviceZones: oldPlan.state.serviceZones.map(zone => ({
      ...zone, deviceCode: zone.kind === "drying" ? "SIM-DRYING-03" : "CURTEC-60L",
    })) };
    const nextQuote = warehouse.getKqWarehouseQuote(nextDraft, oldPlan.state);
    await scalar("SELECT rpc_kq_warehouse_save($1,$2,$3,$4,$5,$6,$7)", [oldOwner, randomUUID(),
      { state: nextDraft, expectedRevision: oldPlan.revision, expectedCostCents: nextQuote.totalCostCents }, oldPlan.revision, oldPlan.state, nextQuote.nextState, nextQuote.totalCostCents]);
    await db.query("UPDATE kq_flowers SET status='burned',burned_at=date_trunc('milliseconds',now()) WHERE id=$1", [oldFlower]);
    const oldCreated = await scalar("SELECT state FROM kq_storage_lots WHERE flower_id=$1", [oldFlower]);
    equal(oldCreated.postHarvest.dryingQualityBonus, 0, "buying premium drying after harvest cannot rewrite its frozen culture");
    equal(oldCreated.postHarvest.climateQualityBonus, .2, "new storage conditions apply when the lot actually enters conservation");

    const historic = { ...oldCreated, curingStartedAt: new Date(at - 3 * hour).toISOString(),
      lastSettledAt: new Date(at - 3 * hour).toISOString(), readyAt: new Date(at + 3 * hour).toISOString() };
    delete historic.postHarvest;
    await db.query("UPDATE kq_storage_lots SET state=$2 WHERE flower_id=$1", [oldFlower, historic]);
    const beforeClimate = await layout(oldOwner), strongerDraft = { ...beforeClimate.state, storageClimateCode: "SIM-STORAGE-CLIMATE-03" };
    const stronger = warehouse.getKqWarehouseQuote(strongerDraft, beforeClimate.state);
    await scalar("SELECT rpc_kq_warehouse_save($1,$2,$3,$4,$5,$6,$7)", [oldOwner, randomUUID(),
      { state: strongerDraft, expectedRevision: beforeClimate.revision, expectedCostCents: stronger.totalCostCents }, beforeClimate.revision, beforeClimate.state, stronger.nextState, stronger.totalCostCents]);
    const migrated = await scalar("SELECT state FROM kq_storage_lots WHERE flower_id=$1", [oldFlower]);
    equal(Number(migrated.postHarvest.curingBonusWeightedMs), 0, "real room upgrade never grants past curing bonuses to a historical lot");
    equal(migrated.postHarvest.dryingQualityBonus, 0, "real room upgrade never rewrites historical drying quality");
    equal(Number(migrated.exposure.aromaWeightedMs), 3 * hour * 100, "real room upgrade settles all earlier unmodified exposure");
    equal(Number((await projectSql(migrated, at + 3 * hour)).conditionScore), 8.3, "historical lot gains only the remaining half of its new room and climate benefit");
    for (const role of ["anon", "authenticated", "service_role"]) for (const signature of [
      "kq_warehouse_postharvest_profile(jsonb,jsonb)", "kq_storage_container_quality_bonus(jsonb)", "kq_warehouse_validate_postharvest_run(jsonb)",
      "kq_warehouse_catalog_before_postharvest(jsonb)", "kq_warehouse_device_before_postharvest(text)", "kq_storage_postharvest_lot()", "kq_warehouse_postharvest_sync()",
    ]) equal(await scalar("SELECT has_function_privilege($1,$2,'EXECUTE')", [role, signature]), false, `${role} cannot call private ${signature}`);
    await climateBillingChecks({ db, scalar, equal, reject, player, layout, warehouse, catalog, owner, bought, legacyOwner, legacyWarehouse, legacyStart, harvest });
    await qualityTierChecks({ db, sql, scalar, equal, reject, player, layout, start, harvest, warehouse, storage, model, energy, buddieCodes, premiumPlan: bought.state, legacyState });
    console.log("Postharvest: paid climate, SQL/TS quality, actual harvest, non-retroactive settlement, overflow and private grants passed.");
  } finally { await vite.close(); }
}

const sourceUrl = new URL("./test-placard-zone-cultures.mjs", import.meta.url);
let source = (await readFile(sourceUrl, "utf8")).replaceAll("\r\n", "\n");
const marker = '  console.log("Zone cultures: actual start/play/finish, capacity, replay, preservation and grants passed.");';
assert(source.includes(marker), "zone fixture completion marker changed");
source = source.replace(marker, `  await postHarvestChecks({ db, sql, scalar, equal, reject, player, layout, start, finish, harvest, buddieCodes });\n${marker}`)
  .replace(/^import .*;\n/gm, "").replace('new URL("./test-placard-warehouse.mjs", import.meta.url)', `new URL("./test-placard-warehouse.mjs", ${JSON.stringify(sourceUrl.href)})`);
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
await new AsyncFunction("assert", "randomUUID", "readFile", "path", "createServer", "PGlite", "postHarvestChecks", source)(assert, randomUUID, readFile, path, createServer, PGlite, postHarvestChecks);
