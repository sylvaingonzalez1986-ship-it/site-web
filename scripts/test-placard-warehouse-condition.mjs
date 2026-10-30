// Local PostgreSQL integration only; no credentials or deployed database writes.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { PGlite } from "@electric-sql/pglite";

export async function conditionChecks({ db, sql, scalar, equal, reject, player, layout, start, harvest, makeState, buddieCodes }) {
  const vite = await createServer({ configFile: false, envDir: false, resolve: { alias: { "@": path.resolve("src") } }, server: { middlewareMode: true, watch: null, hmr: false, ws: false } });
  try {
    const warehouse = await vite.ssrLoadModule("/src/lib/kanab-quest-warehouse.ts");
    const condition = await vite.ssrLoadModule("/src/lib/kanab-quest-warehouse-condition.ts");
    const migration = "20261030000100_kq_warehouse_condition_and_resale.sql";
    const legacyOwner = await player(), legacy = await start(legacyOwner, "zone-0", buddieCodes[0]);
    const before = await scalar("SELECT state FROM kq_runs WHERE id=$1", [legacy.run.id]);
    await db.exec("COMMIT");
    // The inherited fixture uses real accounts/postings but records fit-out
    // capitalization in test_assets. Install the real asset creation body now.
    const treasury = await sql("20260921000200_kq_treasury_accounting.sql");
    const addAsset = treasury.match(/CREATE FUNCTION public\.kq_treasury_add_asset\([\s\S]*?\$\$;/)[0];
    await db.exec("DROP FUNCTION public.kq_treasury_add_asset(UUID,TEXT,TEXT,TEXT,BIGINT,TIMESTAMPTZ,INTEGER,TEXT)");
    await db.exec(addAsset);
    // Refresh requires unrelated ledger tables omitted by this fixture. These
    // tests set recognized_cents explicitly; posting and asset arithmetic are real.
    await db.exec("CREATE OR REPLACE FUNCTION public.kq_treasury_refresh(UUID) RETURNS VOID LANGUAGE sql AS 'SELECT'");
    const floor = await sql("20261013000300_kq_warehouse_starter_floor.sql");
    await db.exec(floor);
    const conditionSql = await sql(migration);
    try { await db.exec(conditionSql); }
    catch (error) { console.error("Condition migration:", error.position, error.internalPosition, error.internalQuery, error.where); throw error; }
    await db.exec("BEGIN");
    equal(await scalar("SELECT state FROM kq_runs WHERE id=$1", [legacy.run.id]), before, "migration preserves immutable historical run exactly");
    equal((await layout(legacyOwner)).cultureEquipment, null, "unknown condition stays explicitly uninitialized");

    const seedAssets = state => {
      const assets = [];
      for (const zone of state.zones) {
        const quote = warehouse.getKqWarehouseZoneQuote(zone);
        for (const line of quote.devices) assets.push({ id: randomUUID(), kind: "device", code: line.code, quantity: line.quantity, purchaseUnitCents: null, wearPercent: 0, zoneId: zone.id });
        for (const line of quote.options) assets.push({ id: randomUUID(), kind: "option", code: line.code, quantity: line.quantity, purchaseUnitCents: null, wearPercent: 0, zoneId: zone.id });
      }
      for (const [kind, inventory] of [["device", state.equipment], ["option", state.optionInventory ?? []]]) for (const line of inventory) {
        if (kind === "device" && !assets.some(asset => asset.kind === kind && asset.code === line.code)) continue;
        const remainder = line.quantity - assets.filter(asset => asset.kind === kind && asset.code === line.code).reduce((sum, asset) => sum + asset.quantity, 0);
        if (remainder > 0) assets.push({ id: randomUUID(), kind, code: line.code, quantity: remainder, purchaseUnitCents: null, wearPercent: 0, zoneId: null });
      }
      return assets;
    };
    const initialize = async owner => {
      const saved = await layout(owner);
      return scalar("SELECT rpc_kq_warehouse_condition_initialize($1,$2,$3)", [owner, saved.revision, seedAssets(saved.state)]);
    };
    const remove = async (owner, zoneId, sell, key = randomUUID(), saved, amountOverride) => {
      const current = saved ?? await layout(owner), assets = current.cultureEquipment.assets;
      const sold = assets.filter(asset => sell && asset.zoneId === zoneId);
      const nextAssets = assets.filter(asset => !sold.includes(asset)).map(asset => asset.zoneId === zoneId ? { ...asset, zoneId: null } : asset);
      const nextState = { ...current.state, zones: current.state.zones.filter(zone => zone.id !== zoneId),
        equipment: current.state.equipment.map(item => ({ ...item, quantity: item.quantity - sold.filter(asset => asset.kind === "device" && asset.code === item.code).reduce((sum, asset) => sum + asset.quantity, 0) })),
        ...(current.state.optionInventory ? { optionInventory: current.state.optionInventory.map(item => ({ ...item, quantity: item.quantity - sold.filter(asset => asset.kind === "option" && asset.code === item.code).reduce((sum, asset) => sum + asset.quantity, 0) })) } : {}),
      };
      const resale = amountOverride ?? sold.reduce((sum, asset) => sum + Math.floor((asset.purchaseUnitCents ?? 0) * asset.quantity * (100 - asset.wearPercent) / 100), 0);
      return scalar("SELECT rpc_kq_warehouse_remove_zone($1,$2,$3,$4,$5,$6,$7,$8,$9)", [owner, key,
        { action: "remove-zone", zoneId, sell, expectedResaleCents: resale, expectedRevision: current.revision }, current.revision, current.state, assets, nextState, nextAssets, resale]);
    };

    const owner = await player(), initial = await initialize(owner);
    equal(initial.cultureEquipment.version, 1, "tracking is explicit and versioned");
    equal(initial.cultureEquipment.assets.every(asset => asset.purchaseUnitCents === null && asset.wearPercent === 0), true, "old prices are unknown and past wear is not invented");
    equal((await scalar("SELECT rpc_kq_warehouse_condition_initialize($1,0,'[]')", [owner])).cultureEquipment, initial.cultureEquipment, "initialization replay cannot reset equipment");
    await reject(() => scalar("SELECT rpc_kq_warehouse_save($1,$2,$3,$4,$5,$5,0)", [owner, randomUUID(), { expectedCostCents: 0 }, initial.revision, initial.state]), "warehouse_condition_required");
    await reject(() => remove(owner, "zone-0", true), "warehouse_purchase_basis_unknown");
    const kept = await remove(owner, "zone-0", false);
    equal(kept.cashCents, initial.cashCents, "removing a historical zone without sale creates no money");
    equal(kept.state.preparedAreaM2, initial.state.preparedAreaM2, "funded preparation remains available");
    equal(kept.cultureEquipment.assets.filter(asset => asset.zoneId === null).length, 2, "equipment and unknown basis remain in reserve");

    // Purchase a separate new zone, preserving every existing asset identity.
    const buyer = await player(), original = await initialize(buyer);
    const zone = { ...original.state.zones[0], id: "paid-zone", name: "Paid zone", x: 5, y: 0, buddieCode: buddieCodes[3], optionCodes: ["SIM-WATER-02"] };
    const quote = warehouse.getKqWarehouseQuote({ ...original.state, zones: [...original.state.zones, zone] }, original.state);
    const key = randomUUID(), charged = Math.max(0, quote.totalCostCents - original.migrationCreditCents);
    const nextAssets = condition.reconcileKqWarehouseCondition(original.state, quote.nextState, original.cultureEquipment,
      { requestKey: key, fundedFraction: charged / quote.totalCostCents }, randomUUID).assets;
    const purchased = nextAssets.filter(asset => asset.sourceAssetKey === `warehouse:${key}`);
    const request = { state: quote.nextState, expectedRevision: original.revision, expectedCostCents: quote.totalCostCents };
    const buy = (assets = nextAssets) => scalar("SELECT rpc_kq_warehouse_save_condition($1,$2,$3,$4,$5,$6,$7,$8,$9)", [buyer, key, request,
      original.revision, original.state, quote.nextState, quote.totalCostCents, original.cultureEquipment.assets, assets]);
    await reject(() => buy(nextAssets.map((asset, index) => index === 0 ? { ...asset, wearPercent: 1 } : asset)), "warehouse_condition_changed");
    const bought = await buy();
    equal(bought.cashCents, original.cashCents - charged, "condition save charges the true existing fit-out quote once");
    equal((await buy()).receipt.replayed, true, "save replays before stale revision and condition checks");
    equal((await layout(buyer)).cultureEquipment.assets, nextAssets, "paid assets retain historic paid principal and source key");
    const paidAsset = await scalar("SELECT to_jsonb(a) FROM kq_treasury_assets a WHERE user_id=$1 AND source_key=$2", [buyer, `warehouse:${key}`]);
    equal(Number(paidAsset.cost_cents), charged, "real capitalization retains the complete cash-funded investment");

    const conditionState = async (account, zoneId, code) => {
      const state = await makeState(account, zoneId, code), saved = await layout(account);
      const ownAssets = saved.cultureEquipment.assets.filter(asset => asset.zoneId === zoneId);
      const quantity = ownAssets.reduce((sum, asset) => sum + asset.quantity, 0), wear = ownAssets.reduce((sum, asset) => sum + asset.quantity * asset.wearPercent, 0) / quantity;
      const base = state.warehouse.estimatedHarvestGrams, potential = Math.round(base * (1 - wear / 200) * 1000) / 1000;
      state.warehouse = { ...state.warehouse, wearVersion: 1, cultureEquipment: saved.cultureEquipment, estimatedHarvestGrams: potential, yieldFactor: potential / base };
      return state;
    };
    await reject(() => start(buyer, zone.id, buddieCodes[3]), "warehouse_condition_changed");
    const game = await conditionState(buyer, zone.id, buddieCodes[3]);
    const active = await start(buyer, zone.id, buddieCodes[3], { state: game });
    await reject(() => remove(buyer, zone.id, false), "warehouse_zone_busy");
    await harvest(active.run.id);
    const worn = await layout(buyer);
    equal(worn.cultureEquipment.assets.filter(asset => asset.zoneId === zone.id).map(asset => asset.wearPercent), [5, 5, 5], "completing one culture wears its actual assigned devices and module once");
    equal(worn.cultureEquipment.assets.filter(asset => asset.zoneId !== zone.id).map(asset => asset.wearPercent), original.cultureEquipment.assets.map(() => 0), "other zones and reserve do not wear");
    await db.query("UPDATE kq_runs SET status='completed' WHERE id=$1", [active.run.id]);
    equal((await layout(buyer)).cultureEquipment, worn.cultureEquipment, "terminal replay cannot apply wear twice");
    equal(Number(await scalar("SELECT count(*) FROM kq_warehouse_wear_receipts WHERE run_id=$1", [active.run.id])), 1, "wear has a unique run receipt");
    const projectionState = await conditionState(buyer, zone.id, buddieCodes[3]);
    const validation = { ...projectionState.warehouse, sourceState: { ...projectionState.warehouse.sourceState, zones: [zone], serviceZones: [] } };
    await scalar("SELECT kq_warehouse_validate_options_run($1)", [validation]);
    equal(validation.estimatedHarvestGrams, 248.625, "five percent equipment wear reduces the next theoretical harvest to 97.5 percent, including modules");
    await reject(() => scalar("SELECT kq_warehouse_validate_options_run($1)", [{ ...validation, estimatedHarvestGrams: 250 }]), "warehouse_condition_changed");
    const realSnapshot = warehouse.getKqWarehouseRunSnapshot(worn.state, worn.revision, zone.id, 2, 1, 1, worn.cultureEquipment);
    equal(realSnapshot.estimatedHarvestGrams, validation.estimatedHarvestGrams, "the real TypeScript snapshot agrees with SQL condition yield");
    const fullProjection = await scalar("SELECT kq_warehouse_condition_projection($1)", [realSnapshot]);
    equal(fullProjection.estimatedHarvestGrams, realSnapshot.estimatedHarvestGrams, "a complete V2 sourceState projects only its selected zone");
    await scalar("SELECT kq_warehouse_validate_options_run($1)", [realSnapshot]);
    await reject(() => remove(buyer, zone.id, true, randomUUID(), bought), "warehouse_condition_changed");
    await reject(() => remove(buyer, zone.id, true, randomUUID(), worn, 1), "warehouse_price_changed");

    // Recorded condition fixtures exercise the price curve and mixed device /
    // module allocations without replaying dozens of artificial game turns.
    for (const wear of [20, 50, 80, 100]) {
      const graded = { ...worn.cultureEquipment, assets: worn.cultureEquipment.assets.map(asset => asset.zoneId === zone.id ? { ...asset, wearPercent: wear } : asset) };
      const projected = warehouse.getKqWarehouseRunSnapshot(worn.state, worn.revision, zone.id, 2, 1, 1, graded);
      const selectedProjection = { ...projected, sourceState: { ...projected.sourceState, zones: [zone], serviceZones: [] } };
      await scalar("SELECT kq_warehouse_validate_options_run($1)", [selectedProjection]);
      equal(projected.estimatedHarvestGrams, 255 * (1 - wear / 200), `${wear} percent wear has the same reduced yield in SQL and TypeScript`);
      const resale = condition.getKqWarehouseRemovalQuote(worn.state, graded, zone.id, worn.revision).resaleCents;
      equal(resale, purchased.reduce((sum, asset) => sum + Math.floor(asset.purchaseUnitCents * asset.quantity * (100 - wear) / 100), 0), `${wear} percent wear follows remaining-state resale value`);
      await db.exec("SAVEPOINT condition_price_curve");
      await db.query("UPDATE kq_warehouse_layouts SET culture_assets=$2 WHERE user_id=$1", [buyer, graded.assets]);
      const gradedCurrent = await layout(buyer), gradedSale = await remove(buyer, zone.id, true, randomUUID(), gradedCurrent);
      equal(gradedSale.cashCents, gradedCurrent.cashCents + resale, `actual SQL resale credits ${100 - wear} percent at ${wear} percent wear`);
      await db.exec("ROLLBACK TO SAVEPOINT condition_price_curve");
    }

    // Exercise depreciation already recognized before resale. Only the sold
    // material fraction leaves the mixed asset; preparation/installation stay.
    await db.query("UPDATE kq_treasury_assets SET recognized_cents=floor(cost_cents/4) WHERE user_id=$1", [buyer]);
    const saleKey = randomUUID(), principal = purchased.reduce((sum, asset) => sum + asset.quantity * asset.purchaseUnitCents, 0);
    const sold = await remove(buyer, zone.id, true, saleKey, worn);
    equal(sold.cashCents, worn.cashCents + purchased.reduce((sum, asset) => sum + Math.floor(asset.purchaseUnitCents * asset.quantity * .95), 0), "resale credits 95 percent of paid principal at five percent wear");
    equal((await remove(buyer, zone.id, true, saleKey, worn)).receipt.replayed, true, "removal and credit replay once despite the now absent zone");
    const remaining = await scalar("SELECT to_jsonb(a) FROM kq_treasury_assets a WHERE user_id=$1 AND source_key=$2", [buyer, `warehouse:${key}`]);
    equal(Number(remaining.cost_cents), charged - principal, "resale removes only sold principal from the fit-out asset");
    equal(Number(remaining.recognized_cents), Math.floor(charged / 4) - Math.floor(Math.floor(charged / 4) * principal / charged), "recognized depreciation follows the retired material fraction");
    const postings = await scalar("SELECT postings FROM kq_treasury_journal WHERE user_id=$1 AND source_key=$2", [buyer, `warehouse-resale:${saleKey}`]);
    equal(postings.reduce((sum, line) => sum + Number(line.deltaCents), 0), 0, "resale classification is balanced");
    equal(postings.some(line => line.account === "cash"), false, "resale never duplicates the wallet observer cash posting");
    await reject(() => remove(buyer, zone.id, false, saleKey, worn), "warehouse_request_mismatch");

    const mixedOwner = await player();
    await initialize(mixedOwner);
    await db.query("UPDATE kq_warehouse_layouts SET migration_credit_cents=11237 WHERE user_id=$1", [mixedOwner]);
    const mixedBefore = await layout(mixedOwner), mixedKey = randomUUID();
    const mixedQuote = warehouse.getKqWarehouseQuote({ ...mixedBefore.state,
      zones: mixedBefore.state.zones.map(entry => entry.id === "zone-0" ? { ...entry, x: 5, width: 2 } : entry) }, mixedBefore.state);
    const mixedFunded = mixedQuote.totalCostCents - mixedBefore.migrationCreditCents;
    const mixedCondition = condition.reconcileKqWarehouseCondition(mixedBefore.state, mixedQuote.nextState, mixedBefore.cultureEquipment,
      { requestKey: mixedKey, fundedFraction: mixedFunded / mixedQuote.totalCostCents, fundedCents: mixedFunded, investmentCents: mixedQuote.totalCostCents }, randomUUID);
    const mixedBought = await scalar("SELECT rpc_kq_warehouse_save_condition($1,$2,$3,$4,$5,$6,$7,$8,$9)", [mixedOwner, mixedKey,
      { state: mixedQuote.nextState, expectedRevision: mixedBefore.revision, expectedCostCents: mixedQuote.totalCostCents }, mixedBefore.revision,
      mixedBefore.state, mixedQuote.nextState, mixedQuote.totalCostCents, mixedBefore.cultureEquipment.assets, mixedCondition.assets]);
    const mixedRemoval = condition.removeKqWarehouseZone(mixedBought.state, mixedBought.cultureEquipment, "zone-0", true);
    const mixedResale = condition.getKqWarehouseRemovalQuote(mixedBought.state, mixedBought.cultureEquipment, "zone-0", mixedBought.revision).resaleCents;
    const mixedRemoved = await scalar("SELECT rpc_kq_warehouse_remove_zone($1,$2,$3,$4,$5,$6,$7,$8,$9)", [mixedOwner, randomUUID(),
      { action: "remove-zone", zoneId: "zone-0", expectedRevision: mixedBought.revision, resellEquipment: true, expectedResaleCents: mixedResale },
      mixedBought.revision, mixedBought.state, mixedBought.cultureEquipment.assets, mixedRemoval.state, mixedRemoval.condition.assets, mixedResale]);
    equal(mixedRemoved.receipt.soldCount, 1, "mixed zone sells only the newly funded lamp");
    equal(mixedRemoved.receipt.keptCount, 2, "mixed zone keeps the two devices with unknown historical purchase prices");
    equal(mixedRemoved.cultureEquipment.assets.filter(asset => asset.zoneId === null).every(asset => asset.purchaseUnitCents === null), true, "unknown historical basis remains unknown in reserve");
    equal(mixedResale, Number(BigInt(14900) * BigInt(mixedFunded) / BigInt(mixedQuote.totalCostCents)), "conversion credit never becomes cash through resale");

    await initialize(legacyOwner);
    await harvest(legacy.run.id);
    equal((await layout(legacyOwner)).cultureEquipment.assets.every(asset => asset.wearPercent === 0), true, "an existing historical culture finishes without retrospective wear");
    for (const role of ["anon", "authenticated", "service_role"]) {
      equal(await scalar("SELECT has_table_privilege($1,'kq_warehouse_wear_receipts','SELECT,INSERT,UPDATE,DELETE')", [role]), false, `${role} cannot read or write wear receipts directly`);
      for (const signature of ["rpc_kq_warehouse_condition_initialize(uuid,integer,jsonb)", "rpc_kq_warehouse_save_condition(uuid,uuid,jsonb,integer,jsonb,jsonb,integer,jsonb,jsonb)", "rpc_kq_warehouse_remove_zone(uuid,uuid,jsonb,integer,jsonb,jsonb,jsonb,jsonb,integer)"])
        equal(await scalar("SELECT has_function_privilege($1,$2,'EXECUTE')", [role, signature]), role === "service_role", `${role} RPC grant ${signature}`);
      for (const signature of ["kq_warehouse_validate_assets(jsonb,jsonb)", "kq_warehouse_condition_projection(jsonb)", "kq_warehouse_wear_on_completion()", "kq_warehouse_save_before_condition(uuid,uuid,jsonb,integer,jsonb,jsonb,integer)"])
        equal(await scalar("SELECT has_function_privilege($1,$2,'EXECUTE')", [role, signature]), false, `${role} cannot bypass condition guards`);
    }
    console.log("Warehouse condition: real purchase, reserve, quote CAS, one-shot wear, reduced yield, resale, disposal and private grants passed.");
  } finally { await vite.close(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
const sourceUrl = new URL("./test-placard-zone-cultures.mjs", import.meta.url);
let source = (await readFile(sourceUrl, "utf8")).replaceAll("\r\n", "\n");
const marker = '  console.log("Zone cultures: actual start/play/finish, capacity, replay, preservation and grants passed.");';
assert(source.includes(marker), "zone fixture completion marker changed");
source = source.replace(marker, `  await conditionChecks({ db, sql, scalar, equal, reject, player, layout, start, harvest, makeState, buddieCodes });\n${marker}`)
  .replace(/^import .*;\n/gm, "").replace('new URL("./test-placard-warehouse.mjs", import.meta.url)', `new URL("./test-placard-warehouse.mjs", ${JSON.stringify(sourceUrl.href)})`);
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
await new AsyncFunction("assert", "randomUUID", "readFile", "path", "createServer", "PGlite", "conditionChecks", source)(assert, randomUUID, readFile, path, createServer, PGlite, conditionChecks);
}
