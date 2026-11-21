import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getKqWarehousePreparationEffects, type KqWarehousePreparations, type KqWarehouseRunPreparations } from "../kanab-quest-warehouse-preparations";
import { createKqWarehouseEmpty, createKqWarehouseStarter, getKqWarehouseQuote, getKqWarehouseRunSnapshot } from "../kanab-quest-warehouse";
import { proposeFirstWarehousePlan } from "../kanab-quest-warehouse-first-plan";
import { getKqCampaignMemberState, getKqCampaignParticipants } from "../kanab-quest-campaign";
import { KQ_BUDDIES, startKqGame } from "../kanab-quest-game";
import { encodeKqSave, parseKqGameSave } from "../kanab-quest-persistence";

let db: PGlite;
const migration = (file: string) => readFileSync(`supabase/migrations/${file}.sql`, "utf8");
async function install(file: string, name: string, alias = name) {
  const body = migration(file).match(new RegExp(`CREATE (?:OR REPLACE )?FUNCTION public\\.${name}\\([\\s\\S]*?\\$\\$;`, "i"))?.[0];
  if (!body) throw new Error(`Missing SQL function: ${name}`);
  await db.exec(body.replace(name + "(", alias + "("));
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE public.kq_warehouse_layouts(user_id uuid PRIMARY KEY,state jsonb);
    CREATE TABLE public.kq_runs(user_id uuid,status text,warehouse_zone_id text);
    SET check_function_bodies=off;`);
  const catalog = "20261012000900_kq_warehouse_equipment_tiers";
  const options = "20261012000800_kq_warehouse_simulation_options";
  const tiers = "20261015000400_kq_warehouse_tier_balance";
  const condition = "20261030000100_kq_warehouse_condition_and_resale";
  await install(catalog, "kq_warehouse_device");
  await install(catalog, "kq_warehouse_catalog_projection", "kq_warehouse_catalog_before_postharvest");
  await install(catalog, "kq_warehouse_validate_catalog_change");
  await db.exec("CREATE FUNCTION public.kq_warehouse_catalog_projection(jsonb) RETURNS jsonb LANGUAGE sql AS 'SELECT public.kq_warehouse_catalog_before_postharvest($1)'");
  await install(options, "kq_warehouse_option", "kq_warehouse_option_v1");
  await install(tiers, "kq_warehouse_option");
  await install(options, "kq_warehouse_options_projection", "kq_warehouse_options_projection_v1");
  await install(options, "kq_warehouse_validate_options_change");
  await install(tiers, "kq_warehouse_device_quality");
  await install(tiers, "kq_warehouse_options_projection");
  await install(condition, "kq_warehouse_validate_assets");
  await install(condition, "rpc_kq_warehouse_remove_zone");
  await install("20261111000200_kq_production_equipment", "kq_staff_production_layout_guard");
  for (const file of ["20261120000300_kq_warehouse_air_service", "20261120000400_kq_warehouse_empty_onboarding",
    "20261120000500_kq_warehouse_wall_extraction", "20261120000600_kq_warehouse_service_stations"]) await db.exec(migration(file));
}, 30_000);

afterAll(async () => { await db?.close(); });

const empty = createKqWarehouseEmpty();
const nextZone = { ...createKqWarehouseStarter(true).zones[0], id: "main", x: 5, y: 6, width: 4, height: 1 };
const stations = [
  { id: "water", code: "SIM-WATER-03", x: 5, y: 2 },
  { id: "sas", code: "SIM-HYGIENE-03", x: 5, y: 9 },
] as const;
const paid = getKqWarehouseQuote({ ...empty, zones: [nextZone], stationPlacements: [...stations] }, empty);

describe("warehouse preparation transactions", () => {
  const base = "WAREHOUSE-NUTRITION-BASE";
  const supplement = "WAREHOUSE-NUTRITION-SUPPLEMENT";
  const pbi = "WAREHOUSE-PBI";
  const vacuum = "WAREHOUSE-VACUUM";
  const mop = "WAREHOUSE-MOP";
  const sql = async <T>(query: string, params: unknown[] = []) => (await db.query<{ value: T }>(query, params)).rows[0]?.value;
  const command = (user: string, input: Record<string, unknown>, key = randomUUID()) => sql<KqWarehousePreparations>(
    "SELECT rpc_kq_warehouse_preparation_command($1,$2,$3) value", [user, key, input]);
  const read = (user: string) => sql<KqWarehousePreparations>("SELECT rpc_kq_warehouse_preparations($1) value", [user]);
  const count = (snapshot: KqWarehousePreparations, code: string) => snapshot.items.find(item => item.code === code)!;
  const buy = (user: string, code: string, quantity = 1) => command(user, { action: "purchase", code, quantity });
  const addPlayer = async (plan = paid.nextState) => {
    const user = randomUUID();
    await db.query("INSERT INTO public.kq_equipment_wallets(user_id) VALUES($1)", [user]);
    await db.query("INSERT INTO public.kq_warehouse_layouts(user_id,state) VALUES($1,$2)", [user, plan]);
    return user;
  };

  beforeAll(async () => {
    await db.exec(`
      ALTER TABLE public.kq_runs ADD COLUMN id uuid UNIQUE DEFAULT gen_random_uuid(), ADD COLUMN state jsonb,
       ADD COLUMN updated_at timestamptz DEFAULT now();
      CREATE TABLE public.kq_equipment_wallets(user_id uuid PRIMARY KEY, cash_cents bigint DEFAULT 100000,
       created_at timestamptz DEFAULT now()-interval '1 hour', updated_at timestamptz DEFAULT now());
      CREATE TABLE public.kq_commerce_accounts(user_id uuid PRIMARY KEY, business_started_at timestamptz);
      CREATE TABLE public.kq_staff_accounts(user_id uuid PRIMARY KEY, state jsonb, revision integer DEFAULT 0, updated_at timestamptz);
      CREATE TABLE public.kq_processing_jobs(user_id uuid, segments jsonb);
      CREATE TABLE test_work(user_id uuid, hours numeric);
      CREATE TABLE test_treasury(user_id uuid, source text, cents bigint);
      CREATE FUNCTION public.kq_treasury_initialize(uuid) RETURNS void LANGUAGE sql AS 'SELECT null::void';
      CREATE FUNCTION public.kq_treasury_pair(uuid,text,text,timestamptz,text,text,bigint,text) RETURNS void LANGUAGE sql
       AS 'INSERT INTO public.test_treasury VALUES($1,$3,$7)';
      CREATE FUNCTION public.kq_player_work_charge(uuid,numeric) RETURNS void LANGUAGE sql AS 'INSERT INTO public.test_work VALUES($1,$2)';
    `);
    await install("20261107000500_kq_player_workday", "kq_player_work_day");
    await install("20261010000100_kq_culture_care", "kq_care_price");
    await install("20261030000100_kq_warehouse_condition_and_resale", "kq_warehouse_condition_projection");
    await install("20261015000400_kq_warehouse_tier_balance", "kq_warehouse_validate_options_run", "kq_warehouse_validate_options_before_condition");
    await install("20261013000100_kq_zone_cultures", "rpc_kq_start_zone_run", "kq_work_inner_start_zone_run");
    await install("20261013000200_kq_shared_campaigns", "rpc_kq_start_campaign", "kq_work_inner_start_campaign");
    for (const file of ["20261121001000_kq_warehouse_preparations", "20261121001010_kq_warehouse_preparation_commands"]) {
      await db.exec(migration(file));
    }
    // Recompile the launch functions with the same body checks as the linked database.
    await db.exec("SET check_function_bodies=on");
    await db.exec(migration("20261121001020_kq_warehouse_preparations_runs"));
    await db.exec(migration("20261122000310_kq_warehouse_airlock_preparation"));
  }, 30_000);

  it("applies purchases once, books both timed cleaning steps and respects independent expiry", async () => {
    const user = await addPlayer();
    const key = randomUUID();
    const purchase = { action: "purchase", code: vacuum, quantity: 1 };
    expect((await command(user, purchase, key)).cashCents).toBe(99600);
    expect((await command(user, purchase, key)).cashCents).toBe(99600);
    await expect(command(user, { ...purchase, code: mop }, key)).rejects.toThrow("kq_preparation_request_mismatch");
    expect((await buy(user, mop)).cashCents).toBe(98500);
    expect(await sql("SELECT sum(cents)::int value FROM test_treasury WHERE user_id=$1", [user])).toBe(1500);
    expect(count(await read(user), vacuum).availableQuantity).toBe(1);
    const clean = (step: string, workChoice = "player") => command(user, { action: "clean", step, workChoice });
    await expect(clean("mop")).rejects.toThrow("kq_preparation_clean_order");
    const work = (await clean("vacuum")).cleaning.vacuum;
    expect(work.completedAt).toBeNull();
    expect(Date.parse(work.pending!.endsAt) - Date.parse(work.pending!.startsAt)).toBe(300_000);
    await expect(clean("mop")).rejects.toThrow("kq_preparation_clean_running");
    await db.query("UPDATE kq_warehouse_cleaning_work SET starts_at=now()-interval '6 min',ends_at=now()-interval '1 min' WHERE user_id=$1", [user]);
    const completed = (await read(user)).cleaning.vacuum;
    expect(Date.parse(completed.expiresAt!) - Date.parse(completed.completedAt!)).toBe(100_800_000);
    const employee = { id: "worker", status: "active", weeklyHours: 35, workDays: {}, leave: [], hiredAt: "2020-01-01T00:00:00Z",
      nextPayrollAt: "2099-01-01T00:00:00Z" };
    await db.query("INSERT INTO kq_staff_accounts(user_id,state) VALUES($1,$2)", [user, { employees: [employee], tasks: [], payroll: [] }]);
    const washed = (await clean("mop", "employee:worker")).cleaning.mop;
    expect(washed.pending?.workChoice).toBe("employee:worker");
    expect(Date.parse(washed.pending!.endsAt) - Date.parse(washed.pending!.startsAt)).toBe(600_000);
    expect(await sql("SELECT sum(hours)::numeric value FROM test_work WHERE user_id=$1", [user])).toBe("0.5");
    expect(await sql("SELECT state#>'{employees,0,workDays,1,usedHours}' value FROM kq_staff_accounts WHERE user_id=$1", [user])).toBe(1);
    await db.query("UPDATE kq_warehouse_cleaning_work SET starts_at=now()-interval '30 hours',ends_at=now()-interval '29 hours' WHERE user_id=$1 AND step='vacuum'", [user]);
    await db.query("UPDATE kq_warehouse_cleaning_work SET starts_at=now()-interval '1 hour',ends_at=now()-interval '30 min' WHERE user_id=$1 AND step='mop'", [user]);
    const runId = await sql<string>("INSERT INTO kq_runs(user_id,status,warehouse_zone_id,state) VALUES($1,'active','main',$2) RETURNING id value", [user,
      { warehouse: { preparationVersion: 1, activeAreaM2: 4 } }]);
    const started = await sql<{ warehousePreparations: KqWarehouseRunPreparations }>(
      "SELECT kq_warehouse_launch_preparations($1,$2,ARRAY[$2]::uuid[],NULL) value", [user, runId]);
    expect(started.warehousePreparations.main).toMatchObject({ vacuum: false, mop: true, hygieneM2: 4, entranceAirlock: true });
    expect(getKqWarehousePreparationEffects(4, started.warehousePreparations.main).preventionPercent).toBe(77.5);
  });

  it("freezes entrance protection for every zone and rejects a preview made before the airlock was stored", async () => {
    const farZone = { ...nextZone, id: "far", x: 0, y: 0, width: 2, height: 2 };
    const plan = getKqWarehouseQuote({ ...empty, zones: [nextZone, farZone], stationPlacements: [stations[1]],
      partitions: [{ id: "wall", axis: "x", x: 0, y: 3, length: 5 }] }, empty).nextState;
    const user = await addPlayer(plan);
    const preview = await read(user);
    expect(preview.entranceAirlock).toBe(true);
    expect(plan.stationService?.far.hygieneAreaM2).toBe(0);
    const createRun = (zone: string) => sql<string>("INSERT INTO kq_runs(user_id,status,warehouse_zone_id,state) VALUES($1,'active',$2,$3) RETURNING id value",
      [user, zone, { warehouse: { preparationVersion: 1, activeAreaM2: 4 } }]);
    const launch = (runs: string[], quoteKey: string | undefined) => sql<{ warehousePreparations: KqWarehouseRunPreparations }>(
      "SELECT kq_warehouse_launch_preparations($1,$2,$3,NULL,$4) value", [user, runs[0], runs, quoteKey]);
    const members = [await createRun("main"), await createRun("far")];
    const started = await launch(members, preview.quoteKey);
    for (const zone of ["main", "far"]) {
      expect(started.warehousePreparations[zone]).toMatchObject({ entranceAirlock: true, vacuum: false, mop: false });
    }
    await db.query("UPDATE kq_runs SET status='completed' WHERE user_id=$1", [user]);
    const stored = getKqWarehouseQuote({ ...plan, stationPlacements: [] }, plan).nextState;
    await db.query("UPDATE kq_warehouse_layouts SET state=$2 WHERE user_id=$1", [user, stored]);
    const nextPreview = await read(user);
    expect(nextPreview.entranceAirlock).toBe(false);
    expect(nextPreview.quoteKey).not.toBe(preview.quoteKey);
    expect(await sql("SELECT state#>'{warehousePreparations,far,entranceAirlock}' value FROM kq_runs WHERE id=$1", [members[0]])).toBe(true);
    const nextRun = await createRun("far");
    await expect(launch([nextRun], preview.quoteKey)).rejects.toThrow("kq_preparation_quote_changed");
    expect((await launch([nextRun], nextPreview.quoteKey)).warehousePreparations.far.entranceAirlock).toBe(false);
    // Existing large floors use the centre of the 40 by 25 warehouse's south wall.
    for (const [x, expected] of [[20, true], [19, false]] as const) {
      expect(await sql("SELECT kq_warehouse_entrance_airlock($1) value", [{ stationPlacements: [{ ...stations[1], x, y: 24 }] }])).toBe(expected);
    }
  });

  it("reserves shared stock atomically, consumes programmed and manual doses, and releases on terminal statuses or deletion", async () => {
    const second = { ...nextZone, id: "second", x: 4, y: 5, width: 2 };
    const plan = getKqWarehouseQuote({ ...empty, zones: [nextZone, second], stationPlacements: [...stations] }, empty).nextState;
    const user = await addPlayer(plan);
    await buy(user, base, 5);
    await buy(user, supplement, 3);
    await buy(user, pbi, 2);
    const program = (quantities: Record<string, number>) => command(user, { action: "program", zoneId: "main", stationId: "water", quantities });
    expect((await read(user)).coverage.find(zone => zone.zoneId === "main")?.stations).toContainEqual({ stationId: "water", kind: "irrigation", servedM2: 3 });
    await expect(program({ [base]: 4 })).rejects.toThrow("kq_preparation_coverage");
    expect(count(await program({ [base]: 2, [supplement]: 1 }), base)).toMatchObject({ availableQuantity: 3, reservedQuantity: 2 });
    const insertRun = (zoneId: string, area: number) => sql<string>("INSERT INTO kq_runs(user_id,status,warehouse_zone_id,state) VALUES($1,'active',$2,$3) RETURNING id value", [user, zoneId,
      { warehouse: { preparationVersion: 1, activeAreaM2: area } }]);
    const launch = (leader: string, runs: string[], selected: unknown) => sql<{ warehousePreparations: KqWarehouseRunPreparations }>(
      "SELECT kq_warehouse_launch_preparations($1,$2,$3,$4) value", [user, leader, runs, selected]);
    const one = await insertRun("main", 4);
    const two = await insertRun("second", 2);
    await expect(launch(one, [one, two], { main: { [pbi]: 2 }, second: { [pbi]: 1 } })).rejects.toThrow("kq_preparation_stock");
    expect(count(await read(user), pbi)).toMatchObject({ availableQuantity: 2, reservedQuantity: 0 });
    expect((await read(user)).programs).toHaveLength(1);
    const launched = await launch(one, [one, two], { main: { [base]: 1, [pbi]: 1 }, second: { [base]: 2, [pbi]: 1 } });
    expect(launched.warehousePreparations.main).toMatchObject({ irrigatedM2: 2, used: { [base]: 2, [supplement]: 1 } });
    expect((await read(user)).programs).toHaveLength(0);
    await expect(program({ [base]: 1 })).rejects.toThrow("kq_preparation_zone_busy");
    const use = (quantities: Record<string, number>) => command(user, { action: "use", runId: one, quantities });
    await expect(use({ [base]: 2 })).rejects.toThrow("kq_preparation_reserved");
    expect(count(await use({ [base]: 1 }), base)).toMatchObject({ availableQuantity: 0, reservedQuantity: 2 });
    await db.query("UPDATE kq_runs SET state=state||'{\"stageIndex\":5,\"phase\":\"prepare\"}'::jsonb WHERE id=$1", [one]);
    await expect(use({ [pbi]: 1 })).rejects.toThrow("kq_preparation_run");
    await db.query("UPDATE kq_runs SET status='abandoned' WHERE id=$1", [one]);
    expect(count(await read(user), pbi)).toMatchObject({ availableQuantity: 1, reservedQuantity: 1 });
    await db.query("DELETE FROM kq_runs WHERE id=$1", [two]);
    expect(count(await read(user), base)).toMatchObject({ availableQuantity: 2, reservedQuantity: 0 });
    const three = await insertRun("second", 2);
    await launch(three, [three], { second: { [base]: 2 } });
    await db.query("UPDATE kq_runs SET status='completed' WHERE id=$1", [three]);
    expect(count(await read(user), base)).toMatchObject({ availableQuantity: 2, reservedQuantity: 0 });
  });

  it("drops expired programs and removes duplicated passive effects from modern quotes only", async () => {
    const user = await addPlayer();
    const before = await buy(user, base, 3);
    const mixed = await command(user, { action: "program", stationId: "water", zoneId: "main", quantities: { [base]: 2 } });
    expect(mixed.quoteKey).not.toBe(before.quoteKey);
    await db.query("UPDATE kq_warehouse_irrigation_programs SET starts_at=now()-interval '29 hours',expires_at=now()-interval '1 hour' WHERE user_id=$1", [user]);
    expect((await read(user)).programs).toEqual([]);
    expect((await read(user)).quoteKey).toBe(before.quoteKey);
    expect(count(await read(user), base).availableQuantity).toBe(3);
    const historical = getKqWarehouseRunSnapshot(paid.nextState, 1, nextZone.id);
    const current = getKqWarehouseRunSnapshot(paid.nextState, 1, nextZone.id, 2, 2, 2, undefined, 1);
    expect(current.consumablesCostCents).toBeLessThan(historical.consumablesCostCents);
    expect(current.estimatedHarvestGrams).toBeLessThan(historical.estimatedHarvestGrams);
    expect(current.qualityBonus ?? 0).toBeLessThan(historical.qualityBonus ?? 0);
    const source = { ...current.sourceState, zones: current.zones };
    for (const warehouse of [historical, current]) await db.query("SELECT kq_warehouse_validate_options_before_condition($1)", [{ ...warehouse, sourceState: source }]);
    expect(await sql("SELECT has_table_privilege('service_role','public.kq_warehouse_input_stock','SELECT') value")).toBe(false);
    expect(await sql("SELECT has_function_privilege('service_role','public.kq_warehouse_consume_inputs(uuid,uuid,jsonb)','EXECUTE') value")).toBe(false);
  });

  it("runs the installed campaign transaction, rolls back a shortfall and replays a successful receipt", async () => {
    await db.exec(`
      ALTER TABLE public.kq_warehouse_layouts ADD COLUMN revision bigint NOT NULL DEFAULT 1;
      ALTER TABLE public.kq_runs ADD COLUMN campaign_id uuid, ADD COLUMN buddie_card_definition_id uuid,
       ADD COLUMN deck_codes text[], ADD COLUMN scenario_codes text[], ADD COLUMN seed int, ADD COLUMN culture_tokens_spent int,
       ALTER COLUMN status SET DEFAULT 'active';
      CREATE TABLE public.lottery_card_definitions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text UNIQUE);
      CREATE TABLE public.lottery_card_instances(user_id uuid, card_definition_id uuid);
      CREATE TABLE public.kq_culture_campaigns(id uuid PRIMARY KEY, user_id uuid, leader_run_id uuid, request_key uuid, request jsonb, manifest jsonb);
      CREATE TABLE public.kq_buddie_rotation(user_id uuid PRIMARY KEY, recent_buddie_codes text[], updated_at timestamptz);
      CREATE TABLE public.kq_culture_token_wallets(user_id uuid PRIMARY KEY, balance int);
      CREATE FUNCTION public.kq_start_campaign_leader_internal(p_user uuid,p_buddie text,p_seed int,p_deck text[],p_scenarios text[],p_initial jsonb,p_tokens int,p_heritage text)
      RETURNS jsonb LANGUAGE plpgsql AS $$
      DECLARE r public.kq_runs%ROWTYPE;
      BEGIN
       INSERT INTO public.kq_runs(user_id,buddie_card_definition_id,seed,deck_codes,scenario_codes,state,culture_tokens_spent)
        VALUES(p_user,(SELECT id FROM public.lottery_card_definitions WHERE code=p_buddie),p_seed,p_deck,p_scenarios,p_initial,p_tokens)
        RETURNING * INTO r;
       RETURN jsonb_build_object('run',to_jsonb(r));
      END $$;
    `);
    const campaigns = "20261013000200_kq_shared_campaigns";
    for (const callee of ["rpc_kq_campaign_receipt", "kq_campaign_round", "kq_campaign_cultivation_profile", "kq_campaign_project_state",
      "kq_campaign_run_identity", "kq_campaign_sync_state"]) await install(campaigns, callee);
    await install("20261013000100_kq_zone_cultures", "kq_zone_run_identity");
    await install("20261010000100_kq_culture_care", "kq_care_state_valid");
    await db.exec(`CREATE TRIGGER aaa_kq_campaign_identity BEFORE INSERT OR UPDATE ON public.kq_runs FOR EACH ROW EXECUTE FUNCTION public.kq_campaign_run_identity();
      CREATE TRIGGER aaa_kq_zone_run_identity BEFORE INSERT OR UPDATE ON public.kq_runs FOR EACH ROW EXECUTE FUNCTION public.kq_zone_run_identity();
      CREATE TRIGGER zzz_kq_campaign_sync_state AFTER UPDATE OF state ON public.kq_runs FOR EACH ROW EXECUTE FUNCTION public.kq_campaign_sync_state();`);
    const zones = [{ ...nextZone, buddieCode: "HH2026-020" }, { ...nextZone, id: "second", x: 3, y: 5, width: 2, buddieCode: "HH2026-021" }];
    const plan = getKqWarehouseQuote({ ...empty, zones, stationPlacements: [...stations] }, empty).nextState;
    const user = await addPlayer(plan);
    await db.query("INSERT INTO lottery_card_definitions(code) SELECT unnest($1::text[])", [zones.map(zone => zone.buddieCode)]);
    await db.query("INSERT INTO lottery_card_instances(user_id,card_definition_id) SELECT $1,id FROM lottery_card_definitions", [user]);
    await buy(user, base);
    const members = getKqCampaignParticipants(plan, 1, undefined, undefined, 1).map(member => ({ ...member, runId: randomUUID() }));
    const leader = members[0];
    const state = startKqGame(123, { warehouse: leader.warehouse, varietyCode: leader.buddieCode, cultivationProfile: leader.cultivationProfile, deckCodes: [], collectionCodes: [] });
    state.campaign = { version: 1, id: randomUUID(), leaderRunId: leader.runId, members };
    state.xp = 1 + Math.max(...members.map(member => KQ_BUDDIES.find(buddie => buddie.code === member.buddieCode)!.advantageLevel));
    const launchMembers = members.map(member => ({ runId: member.runId, state: getKqCampaignMemberState(state, member) }));
    const request = { campaign: true, buddieCode: leader.buddieCode, deckCodes: [], cultureTokens: 0, heritageCode: null,
      energyMode: "balanced", expectedEnergyCents: null, warehouseInputs: { main: { [base]: 1 }, second: { [base]: 1 } },
      expectedPreparationKey: (await read(user)).quoteKey };
    const key = randomUUID();
    const launch = () => sql<{ replayed: boolean; run: { state: typeof state } }>("SELECT kq_work_inner_start_campaign($1,$2,$3,$4,0,NULL) value",
      [user, key, request, JSON.stringify(launchMembers)]);
    await expect(launch()).rejects.toThrow("kq_preparation_stock");
    expect(await sql("SELECT count(*)::int value FROM kq_runs WHERE user_id=$1", [user])).toBe(0);
    expect(await sql("SELECT count(*)::int value FROM kq_culture_campaigns WHERE user_id=$1", [user])).toBe(0);
    await buy(user, base);
    await db.query("INSERT INTO kq_warehouse_cleaning_work VALUES($1,$2,'vacuum','player',now()-interval '1 hour',now()-interval '55 minutes')", [user, randomUUID()]);
    await expect(launch()).rejects.toThrow("kq_preparation_quote_changed");
    expect(await sql("SELECT count(*)::int value FROM kq_runs WHERE user_id=$1", [user])).toBe(0);
    request.expectedPreparationKey = (await read(user)).quoteKey;
    const started = await launch();
    expect(started.replayed).toBe(false);
    expect(parseKqGameSave(encodeKqSave(started.run.state))?.warehousePreparations).toEqual({
      main: { vacuum: true, mop: false, entranceAirlock: true, hygieneM2: 4, irrigatedM2: 0, used: {} },
      second: { vacuum: true, mop: false, entranceAirlock: true, hygieneM2: 2, irrigatedM2: 0, used: {} },
    });
    expect((await launch()).replayed).toBe(true);
    expect(count(await read(user), base)).toMatchObject({ availableQuantity: 0, reservedQuantity: 2 });
    const other = members[1];
    await command(user, { action: "use", runId: other.runId, quantities: { [base]: 1 } });
    expect(await sql("SELECT state->'warehousePreparations'->'second'->'used' value FROM kq_runs WHERE id=$1", [leader.runId])).toEqual({ [base]: 1 });
    expect(await sql("SELECT state->'warehousePreparations'->'second'->'used' value FROM kq_runs WHERE id=$1", [other.runId])).toEqual({ [base]: 1 });

    const firstDraft = proposeFirstWarehousePlan(empty)!;
    const firstZone = { ...firstDraft.zones[0], buddieCode: "HH2026-020" };
    const firstPlan = getKqWarehouseQuote({ ...firstDraft, zones: [firstZone] }, empty).nextState;
    const newPlayer = await addPlayer(firstPlan);
    await db.query("INSERT INTO lottery_card_instances(user_id,card_definition_id) SELECT $1,id FROM lottery_card_definitions WHERE code=$2", [newPlayer, firstZone.buddieCode]);
    const emptyStock = await read(newPlayer);
    expect(emptyStock.items.length).toBeGreaterThan(0);
    expect(emptyStock.items.every(item => item.availableQuantity === 0 && item.reservedQuantity === 0)).toBe(true);

    const [firstMember] = getKqCampaignParticipants(firstPlan, 1, undefined, undefined, 1).map(member => ({ ...member, runId: randomUUID() }));
    const firstState = startKqGame(123, { warehouse: firstMember.warehouse, varietyCode: firstMember.buddieCode,
      cultivationProfile: firstMember.cultivationProfile, deckCodes: [], collectionCodes: [] });
    firstState.campaign = { version: 1, id: randomUUID(), leaderRunId: firstMember.runId, members: [firstMember] };
    const firstRequest = { ...request, buddieCode: firstMember.buddieCode, warehouseInputs: {}, expectedPreparationKey: emptyStock.quoteKey };
    const firstStart = await sql<{ run: { state: typeof firstState } }>("SELECT kq_work_inner_start_campaign($1,$2,$3,$4,0,NULL) value", [
      newPlayer, randomUUID(), firstRequest,
      JSON.stringify([{ runId: firstMember.runId, state: getKqCampaignMemberState(firstState, firstMember) }]),
    ]);
    expect(firstStart.run.state.warehousePreparations).toEqual({
      [firstZone.id]: { vacuum: false, mop: false, entranceAirlock: false, hygieneM2: 0, irrigatedM2: 0, used: {} },
    });
  });
});
