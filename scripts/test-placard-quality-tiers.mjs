// Runs only against the isolated PGlite fixture from test-placard-postharvest.mjs.
// This exercises the production migration and real culture/storage triggers.
import { randomUUID } from "node:crypto";

export async function qualityTierChecks({ db, sql, scalar, equal, reject, player, layout, start, harvest, warehouse, storage, model, energy, buddieCodes, premiumPlan, legacyState }) {
  const hour = 3600000;
  const checkpoint = Date.parse(await scalar("SELECT date_trunc('milliseconds',now())"));
  const at = milliseconds => new Date(checkpoint + milliseconds).toISOString();
  const stateFor = async (owner, version = 1) => {
    const saved = await layout(owner);
    const snapshot = warehouse.getKqWarehouseRunSnapshot(saved.state, saved.revision, "zone-0", 2, 2, version);
    return { ...legacyState, warehouse: snapshot, energy: energy.quoteKqWarehouseEnergy(snapshot) };
  };
  const beforeOwner = await player(premiumPlan), beforeState = await stateFor(beforeOwner);
  const beforeStart = await start(beforeOwner, "zone-0", buddieCodes[0], { state: beforeState });
  const oldLot = async (startHoursAgo, withProfile = true) => {
    const owner = await player(premiumPlan);
    const started = await start(owner, "zone-0", buddieCodes[0], { state: await stateFor(owner) });
    await harvest(started.run.id);
    const flower = await scalar("SELECT id FROM kq_flowers WHERE run_id=$1", [started.run.id]);
    await db.query("UPDATE kq_flowers SET status='burned',burned_at=date_trunc('milliseconds',now()) WHERE id=$1", [flower]);
    const original = await scalar("SELECT state FROM kq_storage_lots WHERE flower_id=$1", [flower]);
    const lot = { ...original, harvestedAt: at(-startHoursAgo * hour), curingStartedAt: at(-startHoursAgo * hour), lastSettledAt: at(-startHoursAgo * hour), readyAt: at((6 - startHoursAgo) * hour), exposure: { aromaWeightedMs: 0, chemistryWeightedMs: 0 } };
    if (!withProfile) delete lot.postHarvest;
    else lot.postHarvest = { ...lot.postHarvest, curingBonusWeightedMs: 0 };
    await db.query("UPDATE kq_storage_lots SET state=$2 WHERE flower_id=$1", [flower, lot]);
    return { owner, flower, lot };
  };
  const ongoing = await oldLot(3), completed = await oldLot(9), ancient = await oldLot(3, false);
  const stable = () => scalar("SELECT jsonb_build_object('runs',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM kq_runs r),'layouts',(SELECT jsonb_agg(to_jsonb(l) ORDER BY user_id) FROM kq_warehouse_layouts l),'wallets',(SELECT jsonb_agg(to_jsonb(w) ORDER BY user_id) FROM kq_equipment_wallets w),'invoices',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM kq_storage_climate_invoices i))");
  const preserved = await stable();
  await db.exec(await sql("20261018000700_kq_postharvest_quality_tiers.sql"));
  equal(await stable(), preserved, "quality balance preserves every run, owned plan, wallet and monthly invoice");
  await db.exec("BEGIN");
  const projectSql = (lot, time, jury = 6) => scalar("SELECT kq_storage_condition($1,$2,$3)", [lot, jury, new Date(time).toISOString()]);
  const readLot = flower => scalar("SELECT state FROM kq_storage_lots WHERE flower_id=$1", [flower]);
  const migratedAt = Date.parse((await readLot(ongoing.flower)).lastSettledAt);

  for (const fixture of [ongoing, completed, ancient]) {
    const migrated = await readLot(fixture.flower);
    const oldSettled = storage.settleKqStorageLot(fixture.lot, migratedAt);
    equal(migrated.exposure, oldSettled.exposure, "migration preserves all exposure at the previous protection rate");
    equal(migrated.postHarvest.curingBonusWeightedMs, oldSettled.postHarvest?.curingBonusWeightedMs ?? 0, "migration keeps exactly the previously earned quality");
    equal(migrated.postHarvest.dryingQualityBonus, oldSettled.postHarvest?.dryingQualityBonus ?? 0, "migration never upgrades historical drying");
    equal([migrated.postHarvest.storageQualityBonus, migrated.postHarvest.climateQualityBonus, migrated.postHarvest.aromaRateFactor], [.6, .5, 33], "remaining exposure adopts the stronger installed premium equipment");
    equal(Date.parse(migrated.lastSettledAt), migratedAt, "migration records the same exact checkpoint for every lot");
    equal(Number((await projectSql(migrated, migratedAt)).conditionScore), Number((await projectSql(fixture.lot, migratedAt)).conditionScore), "quality is identical immediately before and after the balance update");
  }
  equal(Number((await projectSql(await readLot(ongoing.flower), checkpoint + 3 * hour)).conditionScore), 7.25, "half-old half-new curing grants .4 drying plus .3 old and .55 new curing");
  equal(Number((await projectSql(await readLot(completed.flower), checkpoint + 3 * hour)).conditionScore), 7, "completed curing receives no retroactive upgrade");
  equal(Number((await projectSql(await readLot(ancient.flower), checkpoint + 3 * hour)).conditionScore), 6.55, "a historical lot without a profile only earns the remaining half of new curing");

  for (const [drying, storing, climate, bonus, factor] of [
    ["SJ-DRYIT90", "LP-SUPER-1L", "SIM-STORAGE-CLIMATE-01", .1, 90],
    ["SIM-DRYING-02", "BROR-JARS-48", "SIM-STORAGE-CLIMATE-02", .9, 57],
    ["SIM-DRYING-03", "CURTEC-60L", "SIM-STORAGE-CLIMATE-03", 1.8, 33],
  ]) {
    const plan = { ...premiumPlan, storageClimateCode: climate, serviceZones: premiumPlan.serviceZones.map(zone => ({ ...zone, deviceCode: zone.kind === "drying" ? drying : storing })) };
    const { containerQualityBonus, curingBonusWeightedMs, ...profile } = await scalar("SELECT kq_warehouse_postharvest_profile($1)", [plan]);
    equal(profile, model.getKqWarehousePostHarvestProfile(plan), `${climate} authoritative room profile matches TypeScript`);
    equal(Math.round((profile.dryingQualityBonus + profile.storageQualityBonus + profile.climateQualityBonus) * 100) / 100, bonus, `${climate} has a distinct maximum quality improvement`);
    equal(profile.aromaRateFactor, factor, `${climate} protection combines multiplicatively with its storage tier`);
    const lot = { ...ongoing.lot, curingStartedAt: at(0), lastSettledAt: at(0), readyAt: at(6 * hour), exposure: { aromaWeightedMs: 0, chemistryWeightedMs: 0 }, postHarvest: { ...profile, containerQualityBonus, curingBonusWeightedMs } };
    for (const elapsed of [0, hour, 3 * hour, 6 * hour, 30 * 24 * hour]) {
      const actual = await projectSql(lot, checkpoint + elapsed), expected = storage.projectKqStorageLot(lot, checkpoint + elapsed, 6);
      equal(Number(actual.conditionScore), expected.conditionScore, `${climate} SQL/TS commercial quality agrees at ${elapsed / hour} hours`);
    }
    equal(Number((await projectSql(lot, checkpoint + 6 * hour)).conditionScore), 6 + bonus, `${climate} complete curing earns its exact announced improvement`);
  }
  const mixed = { ...premiumPlan, serviceZones: [
    ...premiumPlan.serviceZones.filter(zone => zone.kind === "drying"),
    { ...premiumPlan.serviceZones.find(zone => zone.kind === "storage"), id: "standard-mixed", deviceCode: "BROR-JARS-48", width: 5, height: 1 },
    { ...premiumPlan.serviceZones.find(zone => zone.kind === "storage"), id: "premium-mixed", deviceCode: "CURTEC-60L", width: 9, height: 1 },
  ] };
  const mixedProfile = await scalar("SELECT kq_warehouse_postharvest_profile($1)", [mixed]);
  equal(mixedProfile.storageQualityBonus, .57, "mixed storage quality is capacity-weighted, never a sum of equipped rooms");
  equal(mixedProfile.aromaRateFactor, model.getKqWarehousePostHarvestProfile(mixed).aromaRateFactor, "mixed protection rounding agrees with the UI");
  equal((await scalar("SELECT kq_warehouse_postharvest_profile_v1($1)", [premiumPlan])).dryingQualityBonus, .4, "archived v1 drying profile remains available for old snapshots");

  await harvest(beforeStart.run.id);
  const legacyFlower = await scalar("SELECT id FROM kq_flowers WHERE run_id=$1", [beforeStart.run.id]);
  await db.query("UPDATE kq_flowers SET status='burned',burned_at=date_trunc('milliseconds',now()) WHERE id=$1", [legacyFlower]);
  const legacyLot = await readLot(legacyFlower);
  equal([legacyLot.postHarvest.dryingQualityBonus, legacyLot.postHarvest.storageQualityBonus, legacyLot.postHarvest.climateQualityBonus], [.4, .6, .5], "old culture finishes with original drying and newly installed storage protection");
  equal((await scalar("SELECT state FROM kq_runs WHERE id=$1", [beforeStart.run.id])).warehouse, beforeState.warehouse, "finishing an old culture does not rewrite its frozen warehouse snapshot");

  const freshOwner = await player(premiumPlan), freshState = await stateFor(freshOwner, 2);
  for (const marker of [undefined, 0, 1, 3, "2", null]) {
    const snapshot = { ...freshState.warehouse, postHarvestBalanceVersion: marker };
    if (marker === undefined) delete snapshot.postHarvestBalanceVersion;
    await reject(() => scalar("SELECT kq_validate_warehouse_run_start($1,$2,$3)", [freshOwner, randomUUID(), { ...freshState, warehouse: snapshot }]), "warehouse_layout_changed");
  }
  const freshStart = await start(freshOwner, "zone-0", buddieCodes[0], { state: freshState });
  await harvest(freshStart.run.id);
  const freshFlower = await scalar("SELECT id FROM kq_flowers WHERE run_id=$1", [freshStart.run.id]);
  await db.query("UPDATE kq_flowers SET status='burned',burned_at=date_trunc('milliseconds',now()) WHERE id=$1", [freshFlower]);
  const freshLot = await readLot(freshFlower);
  equal([freshLot.postHarvest.dryingQualityBonus, freshLot.postHarvest.storageQualityBonus, freshLot.postHarvest.climateQualityBonus], [.7, .6, .5], "new real culture receives the full new premium drying and curing balance");
  equal(Number((await projectSql(freshLot, Date.parse(freshLot.readyAt), 9)).conditionScore), 10, "larger bonuses still obey the commercial-quality ceiling of ten");

  for (const role of ["anon", "authenticated", "service_role"]) for (const signature of ["kq_warehouse_postharvest_profile(jsonb,jsonb)", "kq_warehouse_postharvest_profile_v1(jsonb,jsonb)", "kq_storage_postharvest_lot()"]) {
    equal(await scalar("SELECT has_function_privilege($1,$2,'EXECUTE')", [role, signature]), false, `${role} cannot invoke private ${signature}`);
  }
  console.log("Quality tiers: SQL/TS tiers, weighted protection, migration checkpoints, old/new actual harvests, score ceiling and private grants passed.");
}
