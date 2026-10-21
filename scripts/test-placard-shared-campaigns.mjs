// Local in-memory PostgreSQL only. No credentials, environment files or network.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";
import { PGlite } from "@electric-sql/pglite";

let fixtureVite;
async function createFixtureServer(config) {
  fixtureVite = await createServer(config);
  return fixtureVite;
}

async function campaignChecks({ db, sql, scalar, definition, equal, reject, player, plan, layout, row, start, buddieCodes, getKqWarehouseRunSnapshot, getKqWarehouseQuote }) {
  await db.exec("COMMIT");
  // Load additional actual production definitions missing from the deliberately
  // smaller commerce fixture. Core snapshot dependencies are not executed here.
  const careMigration = await sql("20261010000100_kq_culture_care.sql");
  await db.exec(careMigration.slice(careMigration.indexOf("CREATE TABLE public.kq_care_inventory"), careMigration.indexOf("CREATE FUNCTION public.kq_care_state_valid")));
  await db.exec(await definition("20261010000100_kq_culture_care.sql", "rpc_kq_apply_care"));
  await db.exec(await sql("20261010001000_kq_paid_basic_care.sql"));
  for (const [file, name] of [
    ["20261011120000_kq_chanvrier_career.sql", "kq_chanvrier_run_xp"],
    ["20261011120000_kq_chanvrier_career.sql", "kq_award_chanvrier_career"],
    ["20260915000100_chanvrier_achievements.sql", "kq_progress_event_trigger"],
    ["20260725001800_kq_atomic_heritage_hand_swap.sql", "rpc_kq_swap_heritage_hand"],
    ["20260906000500_kq_dynamic_producer_heritages.sql", "kq_protect_run_heritage_identity"],
  ]) await db.exec(await definition(file, name));
  await db.exec("CREATE TRIGGER kq_award_chanvrier_career AFTER INSERT OR UPDATE OF status ON kq_runs FOR EACH ROW EXECUTE FUNCTION kq_award_chanvrier_career()");
  await db.exec("CREATE TRIGGER trg_kq_protect_run_heritage_identity BEFORE UPDATE OF state ON kq_runs FOR EACH ROW EXECUTE FUNCTION kq_protect_run_heritage_identity()");
  await db.exec("SET check_function_bodies=false");
  let core = await definition("20260813000100_kq_player_core_snapshot.sql", "rpc_kq_player_core_snapshot");
  core = core.replace("'stats', flower.battle_stats,", "'stats', flower.battle_stats, 'rulesVersion', flower.rules_version, 'cannabinoidReport', flower.cannabinoid_report,");
  await db.exec(core);
  await db.exec("SET check_function_bodies=true");
  const historical = await player(plan(1));
  const oldRun = await start(historical, "zone-0", buddieCodes[0]);
  await db.exec(`CREATE SCHEMA supabase_migrations; CREATE TABLE supabase_migrations.schema_migrations(version TEXT PRIMARY KEY);
    INSERT INTO supabase_migrations.schema_migrations VALUES('20261012000800'),('20261012000900'),('20261012001000'),('20261012002000'),('20261013000100');
    ALTER TABLE kq_flowers ADD CONSTRAINT campaign_fixture_flower_one_run UNIQUE(run_id);`);
  const runCatalogCheck = async (file, key) => {
    const results = await db.exec(await readFile(new URL(`../output/shared-campaign-migration/${file}.sql`, import.meta.url), "utf8"));
    const result = results.flatMap(item => item.rows ?? []).find(item => item.result)?.result?.[key];
    assert(result, `Missing ${key} catalog result`);
    equal(result.checks.filter(check => !check.ok), [], `${key}: every catalog/history/permissions check passes`);
    equal(result.ok, true, `${key}: overall verification true`);
  };
  await runCatalogCheck("preflight", "preflight");
  await db.exec("SET check_function_bodies=false");
  await db.exec(await sql("20261013000200_kq_shared_campaigns.sql"));
  await db.exec("SET check_function_bodies=true");
  await db.exec("INSERT INTO supabase_migrations.schema_migrations VALUES('20261013000200')");
  await runCatalogCheck("verification", "verification");
  console.log("Applied shared campaign migration after the deployed zone chain.");
  const oldHistories = (await db.query("SELECT user_id,recent_buddie_codes FROM kq_buddie_rotation")).rows;
  const rotationMigration = await sql("20261019000100_kq_buddie_rotation_two.sql");
  await db.exec(rotationMigration);
  await db.exec(rotationMigration); // Safe to replay without restoring five-code histories.
  for (const history of oldHistories) equal(
    await scalar("SELECT recent_buddie_codes FROM kq_buddie_rotation WHERE user_id=$1", [history.user_id]),
    history.recent_buddie_codes.slice(0, 2), "rotation migration preserves the two latest tracked varieties",
  );
  await db.exec("BEGIN");
  equal((await row(oldRun.run.id)).state, oldRun.run.state, "existing independent run remains byte-for-byte unchanged");
  const vite = fixtureVite;
  {
    const game = await vite.ssrLoadModule("/src/lib/kanab-quest-game.ts");
    const care = await vite.ssrLoadModule("/src/lib/kanab-quest-care.ts");
    const profiles = await vite.ssrLoadModule("/src/lib/kanab-quest-buddie-cultivation.ts");
    const campaignEngine = await vite.ssrLoadModule("/src/lib/kanab-quest-campaign.ts");
    const battle = await vite.ssrLoadModule("/src/lib/kanab-quest-battle.ts");
    const heritage = await vite.ssrLoadModule("/src/lib/kanab-quest-heritage.ts");
    for (let n = 1; n <= 52; n++) {
      const code = `HH2026-${String(n).padStart(3, "0")}`;
      equal(await scalar("SELECT kq_campaign_cultivation_profile($1)", [code]), profiles.getKqBuddieCultivationProfile(code), `profile ${code}: SQL/TS exact parity`);
    }
    const build = async (owner, { tokens = 1, deck = ["BOTTE-ZONE-A"], heritageCode, heritageCard } = {}) => {
      const saved = await layout(owner);
      const zones = saved.state.zones.filter(zone => zone.active && zone.buddieCode).sort((a, b) => a.id.localeCompare(b.id));
      const members = zones.map(zone => ({ runId: randomUUID(), zoneId: zone.id, buddieCode: zone.buddieCode,
        warehouse: getKqWarehouseRunSnapshot(saved.state, saved.revision, zone.id),
        cultivationProfile: profiles.getKqBuddieCultivationProfile(zone.buddieCode) }));
      const campaign = { version: 1, id: randomUUID(), leaderRunId: members[0].runId, members };
      const lead = game.startKqGame(123, { warehouse: members[0].warehouse, varietyCode: members[0].buddieCode, domiciliation: "home",
        startingXp: 1 + tokens, ...(heritageCode ? { heritageCode, heritageCard } : {}) });
      lead.deckCodes = deck; lead.handCodes = deck; lead.collectionCodes = deck;
      lead.campaign = campaign; lead.cultivationProfile = members[0].cultivationProfile;
      lead.xp += Math.max(...members.map(member => game.KQ_BUDDIES.find(b => b.code === member.buddieCode).advantageLevel))
        - game.KQ_BUDDIES.find(b => b.code === members[0].buddieCode).advantageLevel;
      return { members: members.map(member => ({ runId: member.runId, state: campaignEngine.getKqCampaignMemberState(lead, member) })),
        request: { campaign: true, buddieCode: members[0].buddieCode, deckCodes: deck, cultureTokens: tokens,
          heritageCode: heritageCode ?? null, energyMode: "balanced", expectedEnergyCents: null }, tokens, heritageCode: heritageCode ?? null };
    };
    const launch = (owner, prepared, key = randomUUID()) => scalar("SELECT rpc_kq_start_campaign($1,$2,$3,$4,$5,$6)",
      [owner, key, prepared.request, prepared.members, prepared.tokens, prepared.heritageCode]);
    const ownCards = owner => db.query("INSERT INTO lottery_card_instances(user_id,card_definition_id) SELECT $1,id FROM lottery_card_definitions WHERE code LIKE 'BOTTE-ZONE-%'", [owner]);
    const selectZones = async (owner, zoneIds) => {
      const before = await layout(owner), quote = getKqWarehouseQuote({ ...before.state,
        zones: before.state.zones.map(zone => ({ ...zone, active: zoneIds.includes(zone.id) })),
      }, before.state);
      return scalar("SELECT rpc_kq_warehouse_save($1,$2,$3,$4,$5,$6,$7)", [owner, randomUUID(),
        { expectedCostCents: quote.totalCostCents }, before.revision, before.state, quote.nextState, quote.totalCostCents]);
    };
    const runRows = owner => db.query("SELECT * FROM kq_runs WHERE user_id=$1 ORDER BY warehouse_zone_id", [owner]).then(result => result.rows);
    const action = (owner, saved, next, kind, members) => scalar("SELECT rpc_kq_update_campaign_state($1,$2,$3,$4,$5,$6)",
      [owner, saved.id, saved.updated_at, kind, next, members ?? next.campaign.members.map(member => ({ runId: member.runId,
        state: campaignEngine.getKqCampaignMemberState(next, member), flower: null }))]);
    await ownCards(historical);
    const historicalPlan = await build(historical);
    await reject(() => launch(historical, historicalPlan), "kq_active_run_exists");

    const owner = await player(plan(3)); await ownCards(owner);
    await db.query(`DELETE FROM lottery_card_instances i USING lottery_card_definitions d
      WHERE i.card_definition_id=d.id AND i.user_id=$1 AND d.code=ANY($2)`, [owner, buddieCodes.slice(3)]);
    const prepared = await build(owner), key = randomUUID();
    const started = await launch(owner, prepared, key);
    const rows = await runRows(owner), leadId = started.run.id, childId = rows[1].id;
    equal(rows.length, 3, "campaign creates one accounting run per selected zone");
    equal(rows.map(run => run.campaign_id), Array(3).fill(prepared.members[0].state.campaign.id), "all members have durable common identity");
    equal(rows.map(run => run.state.firstCultureRescue), [true, true, true], "first-culture rescue decision is shared");
    equal(rows.map(run => run.state.xp), Array(3).fill(started.run.state.xp), "XP budget is common, not added per zone");
    equal(await scalar("SELECT balance FROM kq_culture_token_wallets WHERE user_id=$1", [owner]), 9, "one token debit for the campaign");
    equal(Number(await scalar("SELECT count(*) FROM kq_culture_token_ledger WHERE user_id=$1", [owner])), 1, "one token ledger entry");
    equal((await scalar("SELECT rpc_kq_reserved_cards($1)", [owner])).length, 1, "one physical deck copy reserved for all members");
    equal(Number(await scalar("SELECT sum(amount_cents) FROM kq_supplier_invoices WHERE user_id=$1", [owner])), 6600, "supplier costs remain charged once per zone");
    equal((await layout(owner)).reservedHarvestGrams, 750, "all member harvest caps reserve shared capacity");
    equal((await layout(owner)).activeRuns.every(run => run.campaignId === rows[0].campaign_id && run.leaderRunId === leadId), true, "warehouse links every zone to common campaign");
    const replay = await launch(owner, { ...prepared, members: [] }, key);
    equal([replay.replayed, replay.run.id], [true, leadId], "start retry precedes changed plan, rotation and input states");
    equal(await scalar("SELECT recent_buddie_codes FROM kq_buddie_rotation WHERE user_id=$1", [owner]),
      [buddieCodes[2], buddieCodes[1]], "campaign retry preserves its two-code queue");
    await reject(() => launch(owner, { ...prepared, request: { ...prepared.request, cultureTokens: 2 } }, key), "kq_campaign_request_mismatch");
    await reject(() => start(owner, "zone-2", buddieCodes[2]), "kq_campaign_active");
    await reject(() => scalar("SELECT rpc_kq_update_run_state($1,$2,$3,'roll',$4,NULL)", [owner, leadId, rows[0].updated_at, rows[0].state]), "kq_campaign_action_required");
    await reject(() => scalar("SELECT rpc_kq_play_support_card($1,$2,'BOTTE-ZONE-A',0::smallint,'support',$3,$4)", [owner, childId, rows[1].updated_at, rows[1].state]), "kq_campaign_action_required");

    let saved = await row(leadId);
    const played = { ...saved.state, usedCards: ["BOTTE-ZONE-A"], playedThisStage: ["BOTTE-ZONE-A"], handCodes: [] };
    await scalar("SELECT rpc_kq_play_support_card($1,$2,'BOTTE-ZONE-A',0::smallint,'support',$3,$4)", [owner, leadId, saved.updated_at, played]);
    equal((await runRows(owner)).map(run => run.state.usedCards), Array.from({ length: 3 }, () => ["BOTTE-ZONE-A"]), "one card action propagates to every member");
    equal(Number(await scalar("SELECT count(*) FROM kq_card_burn_receipts WHERE user_id=$1", [owner])), 1, "one physical card burned");
    equal((await scalar("SELECT rpc_kq_reserved_cards($1)", [owner])).length, 0, "used common reservation released exactly once");
    await reject(() => scalar("SELECT rpc_kq_play_support_card($1,$2,'BOTTE-ZONE-A',0::smallint,'support',$3,$4)", [owner, leadId, saved.updated_at, played]), "kq_stale_run");

    saved = await row(leadId);
    const money = await scalar("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [owner]);
    const careKey = randomUUID(), cared = care.performKqBasicCare(saved.state);
    await scalar("SELECT rpc_kq_apply_care($1,$2,NULL,$3,$4,$5,500)", [owner, leadId, careKey, saved.updated_at, cared]);
    equal(await scalar("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [owner]), money - 500, "one basic-care payment across all zones");
    equal((await runRows(owner)).map(run => run.state.care), Array.from({ length: 3 }, () => cared.care), "common care persists on every member");
    const careReplay = await scalar("SELECT rpc_kq_apply_care($1,$2,NULL,$3,$4,$5,500)", [owner, leadId, careKey, saved.updated_at, cared]);
    equal(careReplay.replayed, true, "care retry returns its receipt");
    equal(await scalar("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [owner]), money - 500, "care retry cannot debit twice");
    saved = await row(leadId);
    const next = game.rollKqDice(saved.state);
    await action(owner, saved, next, "roll");
    equal((await runRows(owner)).map(run => run.state.dice), Array.from({ length: 3 }, () => next.dice), "all zones share the exact roll");
    equal((await action(owner, saved, next, "roll")).replayed, true, "common action retry is idempotent");
    await reject(() => action(owner, saved, { ...next, xp: next.xp + 1 }, "roll"), "kq_stale_run");

    // Deterministic successful journal produced by the actual engine. SQL still
    // enforces all terminal flower/care/identity invariants on every member.
    saved = await row(leadId);
    let completed = saved.state;
    while (completed.phase !== "complete") {
      if (completed.phase === "prepare") completed = game.rollKqDice(completed);
      else if (completed.phase === "rolled") completed = game.resolveKqStage({ ...completed, dice: [6, 6, 6] });
      else completed = game.advanceKqStage(completed);
    }
    equal(Boolean(completed.cultureDead), false, "successful fixture remains alive");
    const endings = completed.campaign.members.map(member => {
      const state = campaignEngine.getKqCampaignMemberState(completed, member), flower = battle.createKqFlower(state);
      return { runId: member.runId, state, flower: { varietyCode: state.varietyCode, varietyName: state.varietyName,
        quality: state.quality, traits: flower.traits, combos: state.combos, battleStats: flower.stats,
        integrityCode: flower.integrityCode, cannabinoidReport: flower.cannabinoidReport,
        cultivationProfile: flower.cultivationProfile, terpeneReport: flower.terpeneReport } };
    });
    const invalid = structuredClone(endings); invalid[1].flower.battleStats.aroma = 1000;
    await reject(() => action(owner, saved, completed, "advance", invalid), "kq_invalid_flower_stats");
    equal((await runRows(owner)).map(run => run.status), ["active", "active", "active"], "invalid member rolls back every terminal state");
    equal(Number(await scalar("SELECT count(*) FROM kq_flowers WHERE owner_id=$1", [owner])), 0, "failed terminal transaction creates no partial flower");
    const final = await action(owner, saved, completed, "advance", endings);
    equal(final.flowers.length, 3, "one distinct flower per culture in one transaction");
    equal(new Set(final.flowers.map(flower => flower.run_id)).size, 3, "flowers retain their independent accounting identities");
    equal(new Set((await runRows(owner)).map(run => run.state.harvestGrams)).size, 3, "genetic outcomes produce different harvest masses");
    equal(new Set(final.flowers.map(flower => flower.terpene_report.totalPercent)).size, 3, "genetic profiles give different simulated terpene results");
    equal(Number(await scalar("SELECT count(*) FROM kq_energy_invoices WHERE user_id=$1", [owner])), 3, "electricity invoices remain one per zone");
    equal(Number(await scalar("SELECT count(*) FROM kq_lab_invoices WHERE user_id=$1", [owner])), 3, "laboratory invoices remain one per distinct lot");
    equal(Number(await scalar("SELECT count(*) FROM kq_chanvrier_career_events WHERE user_id=$1", [owner])), 1, "one career reward for common decision campaign");
    equal((await action(owner, saved, completed, "advance", endings)).replayed, true, "terminal retry returns same result");
    equal(Number(await scalar("SELECT count(*) FROM kq_flowers WHERE owner_id=$1", [owner])), 3, "terminal retry cannot duplicate flowers");
    equal((await layout(owner)).reservedHarvestGrams, 0, "finalized members transfer all active promises to pending lots");
    equal((await layout(owner)).completedRuns.every(run => run.campaignId === rows[0].campaign_id && run.leaderRunId === leadId), true, "completed zone links retain common identity");

    const incompleteOwner = await player(plan(3)); await ownCards(incompleteOwner);
    const incomplete = await build(incompleteOwner); incomplete.members.pop();
    await reject(() => launch(incompleteOwner, incomplete), "kq_campaign_invalid_request");
    equal(Number(await scalar("SELECT count(*) FROM kq_culture_campaigns WHERE user_id=$1", [incompleteOwner])), 0, "partial membership cannot create a campaign");
    const forged = await build(incompleteOwner); forged.members[1].state.cultivationProfile.yieldFactor = 1;
    await reject(() => launch(incompleteOwner, forged), "kq_campaign_profile_invalid");
    equal(await scalar("SELECT balance FROM kq_culture_token_wallets WHERE user_id=$1", [incompleteOwner]), 10, "invalid profiles spend no tokens");
    const tight = await player(plan(5, 1)); await ownCards(tight);
    const tightPlan = await build(tight);
    await reject(() => launch(tight, tightPlan), "warehouse_capacity");
    equal(Number(await scalar("SELECT count(*) FROM kq_runs WHERE user_id=$1", [tight])), 0, "last-member capacity failure rolls back leader and earlier members");
    equal(Number(await scalar("SELECT count(*) FROM kq_supplier_invoices WHERE user_id=$1", [tight])), 0, "capacity rollback preserves accounting");
    equal((await scalar("SELECT rpc_kq_reserved_cards($1)", [tight])).length, 0, "capacity rollback returns every deck copy");
    equal(Number(await scalar("SELECT count(*) FROM kq_buddie_rotation WHERE user_id=$1", [tight])), 0, "failed campaign cannot consume rotation availability");
    equal(await scalar("SELECT recent_buddie_codes FROM kq_buddie_rotation WHERE user_id=$1", [owner]), [buddieCodes[2], buddieCodes[1]], "rotation keeps the last two distinct varieties in deterministic zone order");
    const locked = await build(owner);
    await reject(() => launch(owner, locked), "kq_buddie_rotation_locked");
    equal(await scalar("SELECT recent_buddie_codes FROM kq_buddie_rotation WHERE user_id=$1", [owner]), [buddieCodes[2], buddieCodes[1]], "blocked campaign leaves its queue unchanged");

    // With only three owned varieties, the first zone is available after the
    // initial A/B/C campaign. Participation remains the player's explicit plan:
    // deactivate B/C before launching A, with no automatic zone omission.
    await selectZones(owner, ["zone-0"]);
    const available = await build(owner, { deck: [], tokens: 0 });
    equal(available.members.map(member => member.state.varietyCode), [buddieCodes[0]], "explicit available subset is prepared from the saved warehouse");
    const restarted = await launch(owner, available);
    equal(restarted.run.state.varietyCode, buddieCodes[0], "three owned varieties can start A again after B and C");
    equal(await scalar("SELECT recent_buddie_codes FROM kq_buddie_rotation WHERE user_id=$1", [owner]), [buddieCodes[0], buddieCodes[2]], "single-zone campaign advances the same two-code history");

    // Rare participant need not be the canonical first zone. Its one maximum
    // bonus and the one owned Heritage affect the same shared XP budget.
    await db.query("INSERT INTO lottery_card_definitions(id,code) VALUES($1,'HH2026-001')", [randomUUID()]);
    const rarePlan = plan(2); rarePlan.zones[1].buddieCode = "HH2026-001";
    const rare = await player(rarePlan); await ownCards(rare);
    await db.query("INSERT INTO lottery_card_instances(user_id,card_definition_id) SELECT $1,id FROM lottery_card_definitions WHERE code='HH2026-001'", [rare]);
    const heritageCard = { ...heritage.KQ_HERITAGE_CARDS.find(card => card.code === "HERITAGE-003"), producerId: randomUUID(), producerName: "Fixture", imageUrl: "/fixture.webp" };
    await db.query("INSERT INTO kq_heritage_card_definitions(code,name,timing,effect_code,is_active,producer_id,producer_name,image_url) VALUES($1,$2,$3,$4,true,$5,$6,$7)", [heritageCard.code, heritageCard.name, heritageCard.timing, heritageCard.effect, heritageCard.producerId, heritageCard.producerName, heritageCard.imageUrl]);
    await db.query("INSERT INTO kq_heritage_draws(user_id,card_code) VALUES($1,$2)", [rare, heritageCard.code]);
    const rarePrepared = await build(rare, { deck: ["BOTTE-ZONE-A", "BOTTE-ZONE-B"], heritageCode: heritageCard.code, heritageCard });
    equal(rarePrepared.members[0].state.xp, 8, "prepared common maximum rarity plus Heritage XP");
    // Reserve/hand changes use the real SQL Heritage swap mutation path.
    for (const member of rarePrepared.members) { member.state.handCodes = ["BOTTE-ZONE-A"]; member.state.heritageReserveCodes = ["BOTTE-ZONE-B"]; }
    const rareRun = await launch(rare, rarePrepared);
    equal(rareRun.run.state.xp, 8, "shared XP includes max legendary bonus once plus one token and one Heritage bonus");
    equal((await runRows(rare)).map(run => run.state.xp), [8, 8], "rarity cannot create diverging action budgets");
    equal((await runRows(rare)).filter(run => run.heritage_code).length, 1, "one durable Heritage equipment association");
    let rareSaved = await row(rareRun.run.id);
    const swapped = { ...rareSaved.state, handCodes: ["BOTTE-ZONE-B"], heritageReserveCodes: ["BOTTE-ZONE-A"] };
    await scalar("SELECT rpc_kq_swap_heritage_hand($1,$2,$3,$4)", [rare, rareSaved.id, rareSaved.updated_at, swapped]);
    equal((await runRows(rare)).map(run => run.state.handCodes), [["BOTTE-ZONE-B"], ["BOTTE-ZONE-B"]], "Heritage swap synchronizes shared hand");
    equal((await scalar("SELECT rpc_kq_reserved_cards($1)", [rare])).length, 2, "Heritage swap consumes no physical card");
    rareSaved = await row(rareSaved.id);
    await db.query("INSERT INTO kq_care_inventory(user_id,product_code,quantity) VALUES($1,'CARE-SEAWEED',2)", [rare]);
    const productState = care.applyKqCareProduct(rareSaved.state, "CARE-SEAWEED");
    await scalar("SELECT rpc_kq_apply_care($1,$2,'CARE-SEAWEED',$3,$4,$5,NULL)", [rare, rareSaved.id, randomUUID(), rareSaved.updated_at, productState]);
    equal(await scalar("SELECT quantity FROM kq_care_inventory WHERE user_id=$1 AND product_code='CARE-SEAWEED'", [rare]), 1, "one care stock unit for the entire campaign");
    equal((await runRows(rare)).map(run => run.state.care), [productState.care, productState.care], "one product application affects all members");
    rareSaved = await row(rareSaved.id);
    const dead = { ...rareSaved.state, phase: "complete", cultureDead: true, harvestGrams: 0,
      care: { ...rareSaved.state.care, vitality: 0 } };
    const death = await action(rare, rareSaved, dead, "resolve");
    equal(death.flowers, [], "campaign death creates no flower");
    equal((await runRows(rare)).map(run => run.status), ["abandoned", "abandoned"], "death finalizes all members together");
    equal((await scalar("SELECT rpc_kq_reserved_cards($1)", [rare])).length, 0, "death releases the unused shared deck");
    equal(Number(await scalar("SELECT count(*) FROM kq_energy_invoices WHERE user_id=$1", [rare])), 2, "failed campaign still invoices both consumed zone cycles");

    // PGlite serializes sessions: these checks cover concurrent client retry
    // outcomes, not independent server-process advisory lock waits.
    const concurrent = await player(plan(2)); await ownCards(concurrent);
    const commonStart = await build(concurrent), concurrentKey = randomUUID();
    await db.exec("COMMIT");
    const starts = await Promise.all([0, 1].map(() => launch(concurrent, commonStart, concurrentKey)));
    equal(starts.map(result => result.replayed).sort(), [false, true], "parallel campaign start retry commits once");
    equal(new Set(starts.map(result => result.run.id)).size, 1, "both callers observe the same canonical run");
    const concurrentSaved = await row(starts[0].run.id), commonRoll = game.rollKqDice(concurrentSaved.state);
    const rolls = await Promise.all([0, 1].map(() => action(concurrent, concurrentSaved, commonRoll, "roll")));
    equal(rolls.map(result => result.replayed).sort(), [false, true], "parallel common action retries cannot advance twice");
    await db.exec("BEGIN");

    for (const role of ["anon", "authenticated", "service_role"]) {
      for (const table of ["kq_culture_campaigns", "kq_campaign_action_receipts"]) equal(await scalar("SELECT has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE')", [role, table]), false, `${role}: campaign persistence remains private`);
      for (const signature of ["rpc_kq_start_campaign(uuid,uuid,jsonb,jsonb,integer,text)", "rpc_kq_update_campaign_state(uuid,uuid,timestamptz,text,jsonb,jsonb)", "rpc_kq_campaign_receipt(uuid,uuid,jsonb)"])
        equal(await scalar("SELECT has_function_privilege($1,$2,'EXECUTE')", [role, signature]), role === "service_role", `${role}: only named service campaign RPCs are callable`);
      equal(await scalar("SELECT has_function_privilege($1,'kq_update_run_before_campaign(uuid,uuid,timestamptz,text,jsonb,jsonb)','EXECUTE')", [role]), false, `${role}: private finalizer cannot be used as bypass`);
    }
    console.log("Shared campaigns: profiles, replay, common cards/care/dice, atomic flowers, costs, capacity, two-variety rotation and grants passed.");
  }
}

const sourceUrl = new URL("./test-placard-zone-cultures.mjs", import.meta.url);
let source = (await readFile(sourceUrl, "utf8")).replaceAll("\r\n", "\n");
// The refresh block ends END; newline $$;, unlike older compact DO blocks.
// Preserve the complete production +2/+4 Heritage patch in this reused fixture.
assert(source.includes('refresh.indexOf("END $$;", refreshStart) + 7'), "Heritage fixture extraction marker changed");
source = source.replace('refresh.indexOf("END $$;", refreshStart) + 7', 'refresh.lastIndexOf("COMMIT;")');
const marker = '  console.log("Zone cultures: actual start/play/finish, capacity, replay, preservation and grants passed.");';
assert(source.includes(marker), "zone fixture end marker changed");
source = source.replace(marker, marker + '\n  await campaignChecks({ db, sql, scalar, definition, equal, reject, player, plan, layout, row, start, buddieCodes, getKqWarehouseRunSnapshot, getKqWarehouseQuote });')
  .replace(/^import .*;\n/gm, "").replace('new URL("./test-placard-warehouse.mjs", import.meta.url)', `new URL("./test-placard-warehouse.mjs", ${JSON.stringify(sourceUrl.href)})`);
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
try {
  await new AsyncFunction("assert", "randomUUID", "readFile", "path", "createServer", "PGlite", "campaignChecks", source)(assert, randomUUID, readFile, path, createFixtureServer, PGlite, campaignChecks);
} catch (error) {
  console.error(error.stack?.split("\n").slice(0, 8).join("\n") ?? error.message);
  if (error.where) console.error(error.where);
  process.exitCode = 1;
}
