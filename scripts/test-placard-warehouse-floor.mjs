// Entirely local PGlite. Reuse the chronological warehouse/zone/campaign fixture,
// then apply the actual floor migration to pre-existing accounts and archives.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";
import { PGlite } from "@electric-sql/pglite";

async function floorChecks({ db, sql, scalar, equal, reject, player, plan, layout, start, row, buddieCodes, vite, build, launch }) {
  const domain = await vite.ssrLoadModule("/src/lib/kanab-quest-warehouse.ts");
  const { compactKqWarehouseToStarterFloor: compact, createKqWarehouseStarter: starter, getKqWarehouseRunSnapshot: runSnapshot } = domain;
  const legacy = starter(); delete legacy.floor;
  legacy.zones[0].buddieCode = buddieCodes[0];
  legacy.serviceZones = legacy.serviceZones.map(zone => ({ ...zone, y: 24 }));
  legacy.optionInventory = [{ code: "SIM-NUTRITION-01", quantity: 30 }];
  legacy.equipment[0].quantity += 7;
  const owner = await player(legacy), large = await player({ ...plan(1), preparedAreaM2: 101 });
  const active = await player(plan(1)), activeRun = await start(active, "zone-0", buddieCodes[0]);
  const racing = await player(plan(1)), changed = await player(plan(1)), campaignOwner = await player(plan(2));
  const key = randomUUID(), request = { expectedCostCents: 0 }, initial = await layout(owner);
  const priorReceipt = await scalar("SELECT rpc_kq_warehouse_save($1,$2,$3,$4,$5,$5,0)", [owner, key, request, initial.revision, initial.state]);
  const before = await layout(owner), archived = runSnapshot(before.state, before.revision);
  const facts = user => scalar(`SELECT jsonb_build_object(
    'cash',(SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1),
    'credit',(SELECT migration_credit_cents FROM kq_warehouse_layouts WHERE user_id=$1),
    'archive',(SELECT legacy_archive FROM kq_warehouse_layouts WHERE user_id=$1),
    'containers',(SELECT jsonb_agg(to_jsonb(c) ORDER BY container_code) FROM kq_storage_containers c WHERE user_id=$1),
    'receipts',(SELECT jsonb_agg(to_jsonb(r) ORDER BY request_key) FROM kq_warehouse_receipts r WHERE user_id=$1),
    'invoices',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM kq_supplier_invoices i WHERE user_id=$1))`, [user]);
  const financialBefore = await facts(owner);
  await db.exec("COMMIT");
  await db.exec(await sql("20261013000300_kq_warehouse_starter_floor.sql"));
  await db.exec("BEGIN");
  const adopt = (user, saved, next = compact(saved.state)) => scalar("SELECT rpc_kq_warehouse_compact($1,$2,$3,$4)", [user, saved.revision, saved.state, next]);

  equal((await row(activeRun.run.id)).state, activeRun.run.state, "floor migration leaves active historical run snapshots byte-for-byte unchanged");
  equal(domain.isKqWarehouseRunSnapshot(archived), true, "old run geometry remains valid in the current TypeScript domain");
  const converted = await adopt(owner, before);
  equal(converted.state, compact(before.state), "legacy starter services at y24 move inside the exact 10 by 10 floor");
  equal(converted.revision, before.revision + 1, "free compaction invalidates stale editing revisions once");
  equal(await facts(owner), financialBefore, "compaction changes no cash, credit, archive, owned containers, receipts or invoices");
  equal(domain.getKqWarehouseSummary(converted.state), { ...domain.getKqWarehouseSummary(before.state), totalAreaM2: 100, freeAreaM2: 97 }, "only available floor area changes, not capacity, reserves or operating charges");
  equal((await adopt(owner, before)).revision, converted.revision, "retry of compaction is a harmless no-op");
  equal((await scalar("SELECT rpc_kq_warehouse_save($1,$2,$3,$4,$5,$5,0)", [owner, key, request, initial.revision, initial.state])).receipt,
    { ...priorReceipt.receipt, replayed: true }, "pre-conversion save receipt replays before the new floor/revision checks");

  const activeBefore = await layout(active);
  equal((await adopt(active, activeBefore)).state, activeBefore.state, "an active independent run postpones compaction without changing its layout");
  const largeBefore = await layout(large);
  equal(compact(largeBefore.state), null, "paid preparation above 100 m² keeps the whole legacy floor");
  await reject(() => adopt(large, largeBefore, { ...largeBefore.state, floor: { columns: 10, rows: 10 } }), "warehouse_floor_invalid");

  const changedBefore = await layout(changed);
  const edited = { ...changedBefore.state, zones: changedBefore.state.zones.map(zone => ({ ...zone, name: "Nouvelle disposition" })) };
  await scalar("SELECT rpc_kq_warehouse_save($1,$2,'{\"expectedCostCents\":0}',$3,$4,$5,0)", [changed, randomUUID(), changedBefore.revision, changedBefore.state, edited]);
  equal((await adopt(changed, changedBefore)).state, edited, "a concurrent saved edit wins against the stale automatic proposal");

  const candidate = compact(changedBefore.state);
  for (const invalid of [
    { ...candidate, equipment: candidate.equipment.slice(1) },
    { ...candidate, preparedAreaM2: candidate.preparedAreaM2 - 1 },
    { ...candidate, zones: candidate.zones.map(zone => ({ ...zone, buddieCode: buddieCodes[1] })) },
    { ...candidate, zones: candidate.zones.map(zone => ({ ...zone, width: 2 })) },
    { ...candidate, serviceZones: [] },
  ]) await reject(() => adopt(changed, changedBefore, invalid), "warehouse_inventory_loss");

  const noFloor = { ...converted.state }; delete noFloor.floor;
  await reject(() => scalar("SELECT rpc_kq_warehouse_save($1,$2,'{\"expectedCostCents\":0}',$3,$4,$5,0)", [owner, randomUUID(), converted.revision, converted.state, noFloor]), "warehouse_floor_changed");
  await reject(() => db.query("UPDATE kq_warehouse_layouts SET state=state-'floor' WHERE user_id=$1", [owner]), "warehouse_floor_changed");
  for (const invalid of [
    { ...converted.state, floor: { columns: 40, rows: 25 } },
    { ...converted.state, zones: converted.state.zones.map(zone => ({ ...zone, x: 10 })) },
    { ...converted.state, serviceZones: converted.state.serviceZones.map(zone => ({ ...zone, y: 10 })) },
    { ...converted.state, preparedAreaM2: "3" },
    { ...converted.state, zones: converted.state.zones.map(zone => ({ ...zone, width: "1" })) },
  ]) await reject(() => scalar("SELECT kq_warehouse_validate_floor($1)", [invalid]), "warehouse_floor_invalid");
  equal(await facts(owner), financialBefore, "all forged requests leave financial and inventory evidence intact");

  // The winning layout is read before constructing either a zone snapshot or
  // the common campaign manifest; every member uses its newly committed revision.
  const campaignBefore = await layout(campaignOwner), campaignConverted = await adopt(campaignOwner, campaignBefore);
  const prepared = await build(campaignOwner, { tokens: 0, deck: [] });
  equal(prepared.members.map(member => member.state.warehouse.revision), [campaignConverted.revision, campaignConverted.revision], "all prepared campaign members use the post-compaction revision");
  const campaign = await launch(campaignOwner, prepared);
  equal(campaign.run.state.warehouse.sourceState.floor, { columns: 10, rows: 10 }, "the real campaign start accepts the new floor and preserves it in its snapshot");
  equal((await adopt(campaignOwner, campaignBefore)).revision, campaignConverted.revision, "stale adoption cannot move a running campaign");

  const currentStarter = starter(), fresh = await player(currentStarter);
  equal((await layout(fresh)).state.floor, { columns: 10, rows: 10 }, "the real initialize RPC creates only 100 m² premises");
  const mixedDeployOwner = await player(legacy), mixedDeployBefore = await layout(mixedDeployOwner);
  equal(mixedDeployBefore.state, legacy, "an older server can still initialize its legacy starter during a mixed deployment");
  const mixedDeployConverted = await adopt(mixedDeployOwner, mixedDeployBefore);
  equal(mixedDeployConverted.state, compact(legacy), "the new server safely compacts a starter created by the older server");
  await reject(() => db.query("UPDATE kq_warehouse_layouts SET state=state-'floor' WHERE user_id=$1", [mixedDeployOwner]), "warehouse_floor_changed");
  const currentPlan = { ...plan(1), floor: { columns: 10, rows: 10 } }, newZoneOwner = await player(currentPlan);
  equal((await start(newZoneOwner, "zone-0", buddieCodes[0])).run.state.warehouse.sourceState.floor, currentPlan.floor, "an individual zone can also start on the new premises");
  const enlarged = { ...currentStarter, zones: currentStarter.zones.map(zone => ({ ...zone, width: 2 })) };
  const quote = domain.getKqWarehouseQuote(enlarged, currentStarter);
  await scalar("SELECT kq_warehouse_validate_catalog_change($1,$2,$3)", [currentStarter, quote.nextState, quote.totalCostCents]);
  equal(quote.preparationCostCents, 12000, "the empty 100 m² floor does not create a new charge; only one added prepared cell costs 120 euros");

  const raceBefore = await layout(racing);
  await db.exec("COMMIT");
  const raced = await Promise.all([adopt(racing, raceBefore), adopt(racing, raceBefore)]);
  equal(raced.map(result => result.revision), [raceBefore.revision + 1, raceBefore.revision + 1], "two simultaneous screen openings commit only one compaction");
  await db.exec("BEGIN");
  for (const role of ["anon", "authenticated", "service_role"]) {
    equal(await scalar("SELECT has_function_privilege($1,'rpc_kq_warehouse_compact(uuid,integer,jsonb,jsonb)','EXECUTE')", [role]), role === "service_role", `${role}: compaction has only its named service RPC grant`);
    for (const name of ["kq_warehouse_validate_floor(jsonb)", "kq_warehouse_floor_identity(jsonb)", "kq_warehouse_guard_floor()"])
      equal(await scalar("SELECT has_function_privilege($1,$2,'EXECUTE')", [role, name]), false, `${role}: ${name} remains internal`);
  }
  console.log("Warehouse floor: 100 m², safe compaction, unchanged reserves/archives, replay, concurrent edits, campaign starts and grants passed.");
}

const sourceUrl = new URL("./test-placard-shared-campaigns.mjs", import.meta.url);
let source = (await readFile(sourceUrl, "utf8")).replaceAll("\r\n", "\n");
const marker = '    console.log("Shared campaigns: profiles, replay, common cards/care/dice, atomic flowers, costs, capacity and grants passed.");';
assert(source.includes(marker), "campaign fixture end marker changed");
source = source.replace(marker, marker + "\n    await floorChecks({ db, sql, scalar, equal, reject, player, plan, layout, start, row, buddieCodes, vite, build, launch });")
  .replace(/^import .*;\n/gm, "")
  .replace('const sourceUrl = new URL("./test-placard-zone-cultures.mjs", import.meta.url);',
    `const sourceUrl = new URL("./test-placard-zone-cultures.mjs", ${JSON.stringify(sourceUrl.href)});`)
  .replace('new URL(`../output/shared-campaign-migration/${file}.sql`, import.meta.url)',
    'new URL(`../output/shared-campaign-migration/${file}.sql`, ' + JSON.stringify(sourceUrl.href) + ')');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
await new AsyncFunction("assert", "randomUUID", "readFile", "path", "createServer", "PGlite", "floorChecks", source)(assert, randomUUID, readFile, path, createServer, PGlite, floorChecks);
