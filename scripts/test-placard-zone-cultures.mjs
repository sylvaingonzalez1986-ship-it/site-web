// Local PostgreSQL integration only. Reuses the chronological warehouse suite,
// then exercises the real start, card-play and terminal-state RPCs together.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";
import { PGlite } from "@electric-sql/pglite";

async function zoneChecks({ db, sql, scalar, definition, equal, reject, freshAccount, physicalStarter, initial, getKqWarehouseQuote, getKqWarehouseRunSnapshot, quoteKqWarehouseEnergy }) {
  await db.exec("COMMIT");
  const runTriggers = (await db.query("SELECT tgname,pg_get_triggerdef(oid) AS definition FROM pg_trigger WHERE tgrelid='kq_runs'::regclass AND NOT tgisinternal")).rows;
  for (const trigger of runTriggers) await db.exec(`DROP TRIGGER "${trigger.tgname}" ON kq_runs`);
  // The existing commerce fixture deliberately omits collection/start columns.
  // Add their real shape before loading actual production starter definitions.
  await db.exec(`
    UPDATE kq_runs SET status='abandoned' WHERE status='active';
    CREATE TYPE kq_run_status AS ENUM('active','completed','abandoned');
    ALTER TABLE kq_runs ALTER COLUMN status TYPE kq_run_status USING status::kq_run_status,
      ALTER COLUMN status SET DEFAULT 'active', ALTER COLUMN id SET DEFAULT gen_random_uuid(),
      ADD COLUMN buddie_card_definition_id UUID REFERENCES lottery_card_definitions(id),
      ADD COLUMN seed INTEGER, ADD COLUMN deck_codes TEXT[] DEFAULT '{}', ADD COLUMN scenario_codes TEXT[],
      ADD COLUMN culture_tokens_spent INTEGER DEFAULT 0, ADD COLUMN heritage_code TEXT, ADD COLUMN integrity_code TEXT;
    CREATE UNIQUE INDEX uq_kq_one_active_run_per_user ON kq_runs(user_id) WHERE status='active';
    ALTER TABLE lottery_card_definitions ADD COLUMN is_active BOOLEAN DEFAULT true, ADD COLUMN rarity TEXT DEFAULT 'common';
    ALTER TABLE kq_support_card_rules ADD COLUMN category TEXT, ADD COLUMN situation_codes TEXT[] DEFAULT '{}';
    CREATE TABLE lottery_card_instances(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      card_definition_id UUID REFERENCES lottery_card_definitions(id),created_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE kq_card_burn_receipts(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),run_id UUID REFERENCES kq_runs(id),user_id UUID,
      card_instance_id UUID UNIQUE,card_definition_id UUID,card_code TEXT,stage_index SMALLINT,use_kind TEXT,burned_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE kq_heritage_card_definitions(code TEXT,name TEXT,timing TEXT,effect_code TEXT,producer_id UUID,producer_name TEXT,image_url TEXT,is_active BOOLEAN);
    CREATE TABLE kq_heritage_draws(user_id UUID,card_code TEXT);
    CREATE TABLE kq_culture_token_wallets(user_id UUID PRIMARY KEY,balance INTEGER DEFAULT 0,updated_at TIMESTAMPTZ);
    CREATE TABLE kq_culture_token_ledger(user_id UUID,run_id UUID,amount INTEGER,reason TEXT,reward_key TEXT UNIQUE);
    ALTER TABLE kq_flowers ALTER COLUMN id SET DEFAULT gen_random_uuid(),ALTER COLUMN status SET DEFAULT 'available',
      ADD COLUMN traits TEXT[], ADD COLUMN combos TEXT[], ADD COLUMN rules_version INTEGER,ADD COLUMN cannabinoid_report JSONB;
  `);
  for (const trigger of runTriggers) await db.exec(trigger.definition);
  for (const [file, name] of [
    ["20260910000100_kq_living_soil_default.sql", "rpc_kq_start_run"],
    ["20260906000500_kq_dynamic_producer_heritages.sql", "rpc_kq_start_run_with_heritage"],
    ["20260725000300_kq_atomic_support_card_play.sql", "rpc_kq_play_support_card"],
    ["20261010000100_kq_culture_care.sql", "rpc_kq_update_run_state"],
    ["20261010000100_kq_culture_care.sql", "kq_care_state_valid"],
  ]) await db.exec(await definition(file, name));
  // Apply the actual patch blocks (not replacement test implementations).
  const profile = await sql("20260914000100_arena_chanvrier_profiles.sql");
  const profileStart = profile.indexOf("DO $$", profile.indexOf("-- Extend the existing rare-Buddie"));
  await db.exec(profile.slice(profileStart, profile.indexOf("END $$;", profileStart) + 7));
  const business = await sql("20260921000100_kq_business_calendar.sql");
  const businessStart = business.indexOf("DO $$", business.indexOf("CREATE FUNCTION public.kq_business_assert_domiciliation"));
  await db.exec(business.slice(businessStart, business.indexOf("END $$;", businessStart) + 7));
  const refresh = await sql("20261011160000_kq_heritage_culture_refresh.sql");
  const refreshStart = refresh.lastIndexOf("DO $$");
  await db.exec(refresh.slice(refreshStart, refresh.indexOf("END $$;", refreshStart) + 7));
  await db.exec(await sql("20260726000300_kq_fix_support_card_category_validation.sql"));
  const epic = await sql("20261010000500_botte_situations_epic.sql");
  const epicStart = epic.indexOf("DO $$", epic.indexOf("-- Verify the epic limit"));
  await db.exec(epic.slice(epicStart, epic.indexOf("END $$;", epicStart) + 7));
  await db.exec(await sql("20260923000100_kq_buddie_rotation.sql"));
  await db.exec(await sql("20261007000200_kq_first_culture_rescue.sql"));

  const buddieCodes = Array.from({ length: 9 }, (_, index) => `HH2026-${String(20 + index).padStart(3, "0")}`);
  for (const code of [...buddieCodes, "BOTTE-ZONE-A", "BOTTE-ZONE-B"]) await db.query("INSERT INTO lottery_card_definitions(id,code) VALUES($1,$2)", [randomUUID(), code]);
  await db.exec("INSERT INTO kq_support_card_rules(card_definition_id,category) SELECT id,'support' FROM lottery_card_definitions WHERE code LIKE 'BOTTE-ZONE-%'");
  const plan = (count = 3, services = 3) => getKqWarehouseQuote({ ...physicalStarter,
    zones: Array.from({ length: count }, (_, index) => ({ ...physicalStarter.zones[0], id: `zone-${index}`, name: `Zone ${index}`, buddieCode: buddieCodes[index], x: index, y: 0, width: 1, height: 1 })),
    serviceZones: [
      { ...physicalStarter.serviceZones.find(zone => zone.kind === "drying"), x: 0, y: 2, width: services, height: 1 },
      { ...physicalStarter.serviceZones.find(zone => zone.kind === "storage"), x: 0, y: 3, width: services, height: 1 },
    ],
  }).nextState;
  const player = async (state = plan()) => {
    const owner = await freshAccount();
    await db.query("UPDATE kq_equipment_wallets SET cash_cents=10000000 WHERE user_id=$1", [owner]);
    await db.query("INSERT INTO kq_culture_token_wallets(user_id,balance) VALUES($1,10)", [owner]);
    await db.query("INSERT INTO lottery_card_instances(user_id,card_definition_id) SELECT $1,id FROM lottery_card_definitions WHERE code=ANY($2)", [owner, buddieCodes]);
    await scalar("SELECT rpc_kq_warehouse_initialize($1,$2)", [owner, state]);
    return owner;
  };
  const layout = owner => scalar("SELECT kq_warehouse_snapshot($1)", [owner]);
  const makeState = async (owner, zoneId, code, deck = [], tokens = 0) => {
    const saved = await layout(owner), warehouse = getKqWarehouseRunSnapshot(saved.state, saved.revision, zoneId);
    return { rulesVersion: 2, seed: 123, xp: 1 + tokens, deckCodes: deck, usedCards: [], playedThisStage: [], situationCodes: Array.from({ length: 6 }, (_, index) => `SIT-00${index + 1}`),
      varietyCode: code, varietyName: "Fixture", stageIndex: 0, phase: "ready", history: [], domiciliation: "home", warehouse,
      equipment: initial.equipment, energy: quoteKqWarehouseEnergy(warehouse) };
  };
  const intention = (zoneId, code, deck = [], tokens = 0) => ({ zoneId, buddieCode: code, deckCodes: deck, cultureTokens: tokens, heritageCode: null, energyMode: "balanced", expectedEnergyCents: null });
  const start = async (owner, zoneId, code, { deck = [], tokens = 0, key = randomUUID(), request, state } = {}) => scalar(
    "SELECT rpc_kq_start_zone_run($1,$2,$3,$4,$5,123,$6,$7,$8,$9,NULL)",
    [owner, zoneId, key, request ?? intention(zoneId, code, deck, tokens), code, deck,
      Array.from({ length: 6 }, (_, index) => `SIT-00${index + 1}`), state ?? await makeState(owner, zoneId, code, deck, tokens), tokens]);
  const row = run => scalar("SELECT to_jsonb(r) FROM kq_runs r WHERE id=$1", [run]);
  const finish = async run => {
    const saved = await row(run);
    return scalar("SELECT rpc_kq_update_run_state($1,$2,$3,'advance',$4,NULL)", [saved.user_id, run, saved.updated_at,
      { ...saved.state, phase: "complete", cultureDead: true, harvestGrams: 0, history: [{ total: 0 }, { total: 0 }] }]);
  };
  const harvest = async run => {
    const saved = await row(run), finalState = { ...saved.state, phase: "complete", harvestGrams: 250, quality: 9 };
    return scalar("SELECT rpc_kq_update_run_state($1,$2,$3,'advance',$4,$5)", [saved.user_id, run, saved.updated_at, finalState,
      { varietyCode: finalState.varietyCode, varietyName: finalState.varietyName, quality: 9, traits: [], combos: [],
        battleStats: { appearance: 90, aroma: 90, vigor: 90, mastery: 90, regularity: 90 }, integrityCode: "KQ-1234ABCD" }]);
  };
  const legacyOwner = await player(plan(2)), legacyState = await makeState(legacyOwner, undefined, buddieCodes[0]);
  const legacy = await scalar("SELECT rpc_kq_start_run_with_heritage($1,$2,123,'{}',$3,$4,0,NULL)", [legacyOwner, buddieCodes[0], legacyState.situationCodes, legacyState]);
  await db.exec(await sql("20261013000100_kq_zone_cultures.sql"));
  console.log("Applied zone cultures migration after the complete warehouse chain.");
  await db.exec("BEGIN");
  equal((await row(legacy.run.id)).state, legacy.run.state, "migration preserves existing global state exactly");
  await reject(() => start(legacyOwner, "zone-1", buddieCodes[1]), "warehouse_legacy_run_active");
  await finish(legacy.run.id);
  equal((await start(legacyOwner, "zone-1", buddieCodes[1])).run.warehouse_zone_id, "zone-1", "global run may finish before adopting zones");

  const owner = await player(), key = randomUUID();
  await db.query("INSERT INTO lottery_card_instances(user_id,card_definition_id) SELECT $1,id FROM lottery_card_definitions WHERE code LIKE 'BOTTE-ZONE-%'", [owner]);
  const first = await start(owner, "zone-0", buddieCodes[0], { key, deck: ["BOTTE-ZONE-A", "BOTTE-ZONE-B"], tokens: 1 });
  const second = await start(owner, "zone-1", buddieCodes[1]);
  equal((await layout(owner)).activeRuns.map(run => run.zoneId).sort(), ["zone-0", "zone-1"], "two simultaneous cultures have separate active zone associations");
  equal((await layout(owner)).reservedHarvestGrams, 500, "shared storage promises both maximum harvests");
  equal(first.run.state.firstCultureRescue, true, "first culture keeps welcome grant");
  equal(second.run.state.firstCultureRescue, undefined, "another simultaneous zone cannot claim welcome grant");
  equal(Number(await scalar("SELECT sum(amount_cents) FROM kq_supplier_invoices WHERE user_id=$1", [owner])), 4400, "supplier costs are per selected zone, not the entire plan");
  equal((await scalar("SELECT rpc_kq_energy_snapshot($1)", [owner])).supplierInvoices.length, 2, "energy panel receives both zone supplier invoices");
  const replay = await start(owner, "zone-0", buddieCodes[0], { key, deck: ["BOTTE-ZONE-A", "BOTTE-ZONE-B"], tokens: 1, state: {} });
  equal([replay.replayed, replay.run.id], [true, first.run.id], "retry replays before snapshot, rotation and capacity validation");
  equal(await scalar("SELECT balance FROM kq_culture_token_wallets WHERE user_id=$1", [owner]), 9, "retry spends the token once");
  await reject(() => start(owner, "zone-0", buddieCodes[2]), "warehouse_zone_busy");
  await reject(() => start(owner, "zone-2", buddieCodes[0]), "kq_buddie_busy");
  await reject(() => start(owner, "zone-1", buddieCodes[0], { key }), "kq_zone_request_mismatch");
  await reject(() => start(owner, "zone-2", buddieCodes[2], { deck: ["BOTTE-ZONE-A"] }), "kq_deck_copy_reserved");
  equal((await scalar("SELECT rpc_kq_reserved_cards($1)", [owner])).length, 2, "failed start preserves concrete deck reservations");
  equal(Number(await scalar("SELECT count(*) FROM kq_supplier_invoices WHERE user_id=$1", [owner])), 2, "failed start rolls back invoice and all effects");
  const reserved = (await scalar("SELECT rpc_kq_reserved_cards($1)", [owner]))[0];
  await reject(() => db.query("DELETE FROM lottery_card_instances WHERE id=$1", [reserved.cardInstanceId]), "kq_zone_card_reservations_card_instance_id_fkey");
  await reject(() => db.query("UPDATE lottery_card_instances SET user_id=$2 WHERE id=$1", [reserved.cardInstanceId, legacyOwner]), "kq_card_reserved");
  const playedState = { ...first.run.state, usedCards: ["BOTTE-ZONE-A"], playedThisStage: ["BOTTE-ZONE-A"] };
  const burn = await scalar("SELECT rpc_kq_play_support_card($1,$2,'BOTTE-ZONE-A',0::smallint,'support',$3,$4)", [owner, first.run.id, first.run.updated_at, playedState]);
  equal(burn.burnReceipt.run_id, first.run.id, "card burn consumes the reservation belonging to this culture");
  equal((await scalar("SELECT rpc_kq_reserved_cards($1)", [owner])).length, 1, "only the played physical copy leaves the reserved deck");

  const save = async (owner, candidate) => {
    const before = await layout(owner), quote = getKqWarehouseQuote(candidate, before.state);
    return scalar("SELECT rpc_kq_warehouse_save($1,$2,$3,$4,$5,$6,$7)", [owner, randomUUID(), { expectedCostCents: quote.totalCostCents }, before.revision, before.state, quote.nextState, quote.totalCostCents]);
  };
  const before = await layout(owner);
  await reject(() => start(owner, "zone-2", buddieCodes[3]), "warehouse_buddie_mismatch");
  const bogus = await makeState(owner, "zone-2", buddieCodes[2]);
  await reject(() => start(owner, "zone-2", buddieCodes[2], { state: { ...bogus, warehouse: { ...bogus.warehouse, energyCostCents: 0 } } }), "warehouse_layout_changed");
  await reject(() => scalar("SELECT rpc_kq_start_run_with_heritage($1,$2,123,'{}',$3,$4,0,NULL)", [owner, buddieCodes[2], bogus.situationCodes, bogus]), "warehouse_zone_request_required");
  await reject(() => db.query("UPDATE kq_runs SET warehouse_zone_id='zone-2' WHERE id=$1", [first.run.id]), "kq_zone_identity_immutable");
  await reject(() => save(owner, { ...before.state, zones: before.state.zones.map(zone => zone.id === "zone-0" ? { ...zone, name: "Changed" } : zone) }), "warehouse_zone_busy");
  const edited = await save(owner, { ...before.state, zones: before.state.zones.map(zone => zone.id === "zone-2" ? { ...zone, x: 5, name: "Free room" } : zone) });
  equal(edited.state.zones[2].name, "Free room", "free zone can move while two other cultures run");
  equal((await row(first.run.id)).state.warehouse.sourceState, before.state, "active snapshot stays frozen when free rooms change");
  await reject(() => save(owner, { ...edited.state, serviceZones: edited.state.serviceZones.filter(zone => zone.kind !== "storage") }), "warehouse_service_capacity_in_use");
  const moved = await save(owner, { ...edited.state, serviceZones: edited.state.serviceZones.map(zone => ({ ...zone, x: zone.x + 7 })) });
  equal(moved.state.serviceZones[0].x, 7, "services may move without taking promised capacity away");
  await finish(first.run.id);
  equal((await scalar("SELECT rpc_kq_reserved_cards($1)", [owner])).length, 0, "terminal action releases unused physical cards");
  equal((await layout(owner)).activeRuns.length, 1, "finishing one zone preserves the other culture");
  equal((await row(second.run.id)).status, "active", "other active run unchanged by terminal RPC");
  equal((await layout(owner)).completedRuns[0].runId, first.run.id, "last completed culture remains available per zone");
  equal(Number(await scalar("SELECT count(*) FROM kq_energy_invoices WHERE run_id=$1", [first.run.id])), 1, "terminal action issues energy once for its zone");
  equal((await scalar("SELECT rpc_kq_zone_run_receipt($1,$2,$3)", [owner, key, intention("zone-0", buddieCodes[0], ["BOTTE-ZONE-A", "BOTTE-ZONE-B"], 1)])).run.status, "abandoned", "late retry returns current terminal run without restarting");
  await reject(() => start(owner, "zone-0", buddieCodes[0]), "kq_buddie_rotation_locked");

  // Saturated services: first three cultures fit 1,000g drying, fifth does not.
  const limited = await player(plan(6, 1));
  for (let index = 0; index < 4; index++) await start(limited, `zone-${index}`, buddieCodes[index]);
  await reject(() => start(limited, "zone-4", buddieCodes[4]), "warehouse_capacity");
  equal((await layout(limited)).activeRuns.length, 4, "failed capacity race leaves all earlier reservations intact");
  const limitedRun = (await layout(limited)).activeRuns[0];
  await finish(limitedRun.runId);
  equal((await start(limited, "zone-4", buddieCodes[4])).run.warehouse_zone_id, "zone-4", "released capacity can fund another zone");

  // A living harvest transfers its promise to the pending flower, then to its
  // curing lot. Neither transition frees room early or double-counts it.
  const producing = await player(plan(6, 1)), producingRuns = [];
  for (let index = 0; index < 4; index++) producingRuns.push(await start(producing, `zone-${index}`, buddieCodes[index]));
  const crop = await harvest(producingRuns[0].run.id);
  equal(crop.flower.run_id, producingRuns[0].run.id, "terminal living harvest creates the flower for its own zone");
  equal((await layout(producing)).reservedHarvestGrams, 750, "completed run no longer counts among active promises");
  equal(Number(await scalar("SELECT kq_warehouse_pending_shortage_units($1)", [producing])), 0, "active plus pending harvest fits without double reservation");
  await reject(() => start(producing, "zone-4", buddieCodes[4]), "warehouse_capacity");
  await db.query("UPDATE kq_flowers SET status='burned',burned_at=now() WHERE id=$1", [crop.flower.id]);
  equal(Number(await scalar("SELECT kq_storage_remaining($1)", [crop.flower.id])), 2500, "verdict transfers the finished harvest into actual storage");
  equal(Number(await scalar("SELECT kq_warehouse_pending_shortage_units($1)", [producing])), 0, "curing stock plus active promises retain their separate containers");
  await reject(() => start(producing, "zone-4", buddieCodes[4]), "warehouse_capacity");
  await finish(producingRuns[1].run.id);
  equal((await start(producing, "zone-4", buddieCodes[4])).run.warehouse_zone_id, "zone-4", "only released production capacity permits the next culture");

  const unassignedPlan = plan(); delete unassignedPlan.zones[0].buddieCode;
  const unassigned = await player(unassignedPlan);
  await reject(() => start(unassigned, "zone-0", buddieCodes[0]), "warehouse_buddie_mismatch");

  const rotationOwner = await player(plan(8, 3)), alive = await start(rotationOwner, "zone-0", buddieCodes[0]);
  for (let index = 1; index <= 5; index++) { const cycle = await start(rotationOwner, `zone-${index}`, buddieCodes[index]); await finish(cycle.run.id); }
  await reject(() => start(rotationOwner, "zone-6", buddieCodes[0]), "kq_buddie_busy");
  await finish(alive.run.id);
  const rotated = await layout(rotationOwner);
  await save(rotationOwner, { ...rotated.state, zones: rotated.state.zones.map(zone => zone.id === "zone-6" ? { ...zone, buddieCode: buddieCodes[0] } : zone) });
  equal((await start(rotationOwner, "zone-6", buddieCodes[0])).run.warehouse_zone_id, "zone-6", "five distinct starts unlock the Buddie only once previous culture ended");

  // PGlite serializes SQL sessions: parallel client requests below exercise
  // committed retry/conflict behavior, not independent PostgreSQL lock waits.
  const concurrent = await player(), concurrentKey = randomUUID(), concurrentState = await makeState(concurrent, "zone-0", buddieCodes[0]);
  await db.exec("COMMIT");
  const repeats = await Promise.all([0, 1].map(() => start(concurrent, "zone-0", buddieCodes[0], { key: concurrentKey, state: concurrentState })));
  equal(repeats[0].run.id, repeats[1].run.id, "simultaneous retries resolve to the same committed run");
  equal(repeats.map(result => result.replayed).sort(), [false, true], "one concurrent request starts and one replays");
  const conflictState = await makeState(concurrent, "zone-1", buddieCodes[1]);
  const conflicts = await Promise.allSettled([0, 1].map(() => start(concurrent, "zone-1", buddieCodes[1], { state: conflictState })));
  equal(conflicts.filter(result => result.status === "fulfilled").length, 1, "two fresh requests for one zone produce exactly one success");
  equal(conflicts.find(result => result.status === "rejected").reason.message, "warehouse_zone_busy", "losing concurrent zone request receives the stable conflict");
  equal(Number(await scalar("SELECT count(*) FROM kq_supplier_invoices WHERE user_id=$1", [concurrent])), 2, "concurrent conflicts cannot duplicate zone invoices");
  await db.exec("BEGIN");

  for (const role of ["anon", "authenticated", "service_role"]) {
    for (const table of ["kq_zone_run_receipts", "kq_zone_card_reservations"]) equal(await scalar("SELECT has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE')", [role, table]), false, `${role} cannot access private ${table}`);
    equal(await scalar("SELECT has_function_privilege($1,'rpc_kq_start_zone_run(uuid,text,uuid,jsonb,text,integer,text[],text[],jsonb,integer,text)','EXECUTE')", [role]), role === "service_role", `${role} named start RPC grant`);
    equal(await scalar("SELECT has_function_privilege($1,'kq_start_run_internal(uuid,text,integer,text[],text[],jsonb,integer)','EXECUTE')", [role]), false, `${role} cannot bypass new public entry point`);
  }
  console.log("Zone cultures: actual start/play/finish, capacity, replay, preservation and grants passed.");
}

const sourceUrl = new URL("./test-placard-warehouse.mjs", import.meta.url);
let source = await readFile(sourceUrl, "utf8");
const marker = '  await db.exec("ROLLBACK");\n  console.log(`Warehouse:';
source = source.replaceAll("\r\n", "\n");
assert(source.includes(marker), "warehouse final marker changed");
source = source.replace(marker, `  await zoneChecks({ db, sql, scalar, definition, equal, reject, freshAccount, physicalStarter, initial, getKqWarehouseQuote, getKqWarehouseRunSnapshot, quoteKqWarehouseEnergy });\n${marker}`)
  .replace(/^import .*;\n/gm, "").replaceAll("import.meta.url", JSON.stringify(sourceUrl.href));
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
await new AsyncFunction("assert", "randomUUID", "readFile", "path", "createServer", "PGlite", "zoneChecks", source)(assert, randomUUID, readFile, path, createServer, PGlite, zoneChecks);
