// Isolated PostgreSQL integration checks. No credentials, environment files or
// remote writes. PGlite queues calls on one connection; this tests CAS/replay,
// not multi-connection lock contention.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const vite = await createServer({ configFile: false, envDir: false,
  resolve: { alias: { "@": path.resolve("src") } }, server: { middlewareMode: true, watch: null } });
const query = (sql, values = []) => db.query(sql, values);
const row = async (sql, values = []) => (await query(sql, values)).rows[0];
const scalar = async (sql, values = []) => Object.values(await row(sql, values))[0];
const migration = name => readFile(path.resolve("supabase/migrations", name), "utf8");
const checks = [];
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); checks.push(name); };
const rejects = async (name, call, pattern) => { await assert.rejects(call, pattern, name); checks.push(name); };
const legacy = (id, command = null) => scalar("SELECT public.rpc_kq_social($1,$2::jsonb)", [id, command && JSON.stringify(command)]);
const read = (id, command = null) => scalar("SELECT public.rpc_kq_social_v2_read($1,$2::jsonb)", [id, command && JSON.stringify(command)]);
let engine;
let cultureFixture;

const base = state => ({ modelVersion: 2, requestKey: randomUUID(), expectedRevision: state.revision });
function choose(state, platform = "instagram", intent = "craft") {
  const offered = engine.getKqSocialAdventure(state, platform);
  const adventure = engine.getKqSocialAdventure(state, platform, offered.subjects[0].id), story = adventure.scene;
  return { ...base(state), action: "choose", platform, scenarioId: story.id, choiceId: story.choices.find(choice => choice.intent === intent).id,
    narrativeVersion: 3, subjectId: adventure.subject.id, contextKey: adventure.contextKey };
}
function view(envelope) {
  const now = Date.parse(envelope.state.serverNow);
  return { ...engine.refreshKqSocialSnapshot(engine.normalizeKqSocialSnapshot(envelope.state, now), now, envelope.reputation),
    ...(cultureFixture ? { culture: structuredClone(cultureFixture) } : {}) };
}
function resolve(envelope, command) {
  const current = view(envelope);
  const next = engine.applyKqSocialCommand(current, command, Date.parse(current.serverNow), envelope.reputation, 50);
  assert(engine.isKqSocialSnapshot(next), "the real engine must produce a valid state");
  delete next.culture;
  return { command, revision: current.revision, audience: current.audienceFollowers, next,
    reward: next.sponsors.earnedCents - current.sponsors.earnedCents };
}
const commit = (id, prepared) => scalar("SELECT public.rpc_kq_social_v2_commit($1,$2::jsonb,$3,$4,$5::jsonb,$6)",
  [id, JSON.stringify(prepared.command), prepared.revision, prepared.audience, JSON.stringify(prepared.next), prepared.reward]);
async function perform(id, makeCommand) {
  const envelope = await read(id), prepared = resolve(envelope, makeCommand(view(envelope)));
  const result = await commit(id, prepared);
  assert(engine.isKqSocialSnapshot(result.state), "SQL must return the complete V2 snapshot contract");
  return { result, prepared };
}
async function player({ followers = 0, reputation = 0, cash = 10000, active = true } = {}) {
  const id = randomUUID();
  await query("INSERT INTO auth.users VALUES($1)", [id]);
  await query("INSERT INTO kq_equipment_wallets(user_id,reputation,cash_cents) VALUES($1,$2,$3)", [id, reputation, cash]);
  await query("INSERT INTO kq_online_accounts(user_id,followers) VALUES($1,$2)", [id, followers]);
  await query("INSERT INTO kq_commerce_accounts(user_id,computer_owned,shop_created_at) VALUES($1,$2,CASE WHEN $2 THEN now() ELSE NULL END)", [id, active]);
  return id;
}
// Model elapsed cooldowns without waiting. Both copies are kept in sync, just
// as commit does; the real engine still computes every game transition.
async function readyToPost(id) {
  await query("UPDATE kq_social_platforms SET next_post_at=NULL WHERE user_id=$1", [id]);
  await query(`UPDATE kq_social_accounts SET energy=100,energy_updated_at=now(),
    game_state=jsonb_set(jsonb_set(jsonb_set(jsonb_set(game_state,'{energy}','100'),
      '{energyUpdatedAt}',to_jsonb(now())),'{platforms,instagram,nextPostAt}','null'),'{platforms,x,nextPostAt}','null')
    WHERE user_id=$1`, [id]);
}
async function maturePlayer(options = {}) {
  const id = await player({ followers: 8000, ...options });
  await read(id);
  await query("UPDATE kq_social_platforms SET followers=3000 WHERE user_id=$1", [id]);
  const state = view(await read(id));
  for (const platform of ["instagram", "x"]) state.platforms[platform].trust = 90;
  await query("UPDATE kq_social_accounts SET game_state=$2::jsonb WHERE user_id=$1", [id, JSON.stringify(state)]);
  return id;
}
async function finishBrief(id, sponsor = engine.KQ_SOCIAL_SPONSORS[0]) {
  await perform(id, state => ({ ...base(state), action: "sponsor-accept", sponsorId: sponsor.id }));
  for (const tag of sponsor.requiredTags) {
    await readyToPost(id);
    await perform(id, state => ({ ...base(state), action: "sponsor-post", tag }));
  }
  const envelope = await read(id);
  return resolve(envelope, { ...base(view(envelope)), action: "sponsor-claim" });
}
const stored = id => scalar(`SELECT jsonb_build_object(
  'account',(SELECT to_jsonb(a) FROM kq_social_accounts a WHERE user_id=$1),
  'platforms',(SELECT jsonb_agg(to_jsonb(p) ORDER BY platform) FROM kq_social_platforms p WHERE user_id=$1),
  'online',(SELECT to_jsonb(o) FROM kq_online_accounts o WHERE user_id=$1),
  'wallet',(SELECT to_jsonb(w) FROM kq_equipment_wallets w WHERE user_id=$1),
  'receipts',(SELECT count(*) FROM kq_social_v2_receipts WHERE user_id=$1),
  'journal',(SELECT count(*) FROM kq_treasury_journal WHERE user_id=$1),
  'settlements',(SELECT count(*) FROM test_settlement_observations WHERE user_id=$1))`, [id]);
async function rejectsWithoutWrites(name, id, prepared, pattern) {
  const before = await stored(id);
  await rejects(name, () => commit(id, prepared), pattern);
  check(`${name}: all state, cash, receipts and ledger stay unchanged`, await stored(id), before);
}

try {
  engine = await vite.ssrLoadModule("/src/lib/kanab-quest-social.ts");
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY);
    CREATE TABLE public.kq_equipment_wallets(user_id UUID PRIMARY KEY REFERENCES auth.users(id),reputation INTEGER NOT NULL DEFAULT 0,
      cash_cents INTEGER NOT NULL DEFAULT 10000 CHECK(cash_cents>=0),updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE public.kq_online_accounts(user_id UUID PRIMARY KEY REFERENCES auth.users(id),followers INTEGER NOT NULL DEFAULT 0 CHECK(followers BETWEEN 0 AND 100000),revision INTEGER NOT NULL DEFAULT 0,site_tier TEXT DEFAULT 'basic');
    CREATE TABLE public.kq_commerce_accounts(user_id UUID PRIMARY KEY REFERENCES auth.users(id),computer_owned BOOLEAN DEFAULT false,
      shop_created_at TIMESTAMPTZ,shop_suspended BOOLEAN DEFAULT false,shop_paid_until TIMESTAMPTZ);
    CREATE TABLE public.test_settlement_observations(user_id UUID,followers INTEGER);
    CREATE FUNCTION public.kq_business_settle(p_user UUID) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
      INSERT INTO kq_online_accounts(user_id) VALUES(p_user) ON CONFLICT DO NOTHING;
      INSERT INTO kq_commerce_accounts(user_id) VALUES(p_user) ON CONFLICT DO NOTHING;
      INSERT INTO test_settlement_observations SELECT p_user,followers FROM kq_online_accounts WHERE user_id=p_user;
    END $$;
  `);
  // Use the production journal, double-entry posting and deduplication functions.
  // Opening valuation and wallet movements are reduced fixture boundaries, as
  // the existing social fixture omits inventory, equipment and other businesses.
  const treasury = await migration("20260921000200_kq_treasury_accounting.sql");
  await db.exec(treasury.slice(treasury.indexOf("CREATE TABLE public.kq_treasury_accounts"), treasury.indexOf("-- Actual production cost only.")));
  await db.exec(`
    CREATE FUNCTION public.kq_treasury_initialize(p_user UUID) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
    DECLARE cash INTEGER; BEGIN
      SELECT cash_cents INTO cash FROM kq_equipment_wallets WHERE user_id=p_user FOR UPDATE;
      INSERT INTO kq_treasury_accounts(user_id) VALUES(p_user) ON CONFLICT DO NOTHING;
      IF FOUND THEN PERFORM kq_treasury_pair(p_user,'opening','opening',now(),'cash','opening_equity',cash,'Opening fixture'); END IF;
    END $$;
    CREATE FUNCTION public.fixture_wallet_movement() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
      IF NEW.cash_cents<>OLD.cash_cents AND EXISTS(SELECT 1 FROM kq_treasury_accounts WHERE user_id=NEW.user_id) THEN
        PERFORM kq_treasury_pair(NEW.user_id,'cash-movement','cash:'||gen_random_uuid(),now(),'cash','suspense',NEW.cash_cents::BIGINT-OLD.cash_cents,'Wallet fixture');
      END IF; RETURN NEW; END $$;
    CREATE TRIGGER fixture_wallet_movement AFTER UPDATE ON kq_equipment_wallets FOR EACH ROW EXECUTE FUNCTION fixture_wallet_movement();
  `);
  await db.exec(await migration("20261022000100_kq_social_adventure.sql"));
  const upgraded = await player({ followers: 80, reputation: 600 });
  const oldCommand = { action: "choose", requestKey: randomUUID(), expectedRevision: 0, platform: "instagram", scenarioId: "ig-first-frame", choiceId: "workshop" };
  const old = await legacy(upgraded, oldCommand);
  await db.exec(await migration("20261023000100_kq_social_sponsors.sql"));
  checks.push("V2 applies cleanly after V1 with existing player data");

  const oldRead = await read(upgraded), normalized = view(oldRead);
  check("upgrade retains actual followers and separate marketing audience", [normalized.socialFollowers, normalized.audienceFollowers], [32, 112]);
  check("upgrade retains the existing journal and energy", [normalized.history, normalized.energy], [old.history, old.energy]);
  check("new narrative starts at chapter zero with existing moderation and haters", normalized.platforms.instagram,
    { ...old.platforms.instagram, chapter: 0, trust: 55, lastIntent: null, intentStreak: 0, memory: {}, pressureUpdatedAt: new Date(oldRead.state.serverNow).toISOString() });
  await rejects("a V1 receipt key cannot be reused by V2 read", () => read(upgraded, { ...choose(normalized, "x"), requestKey: oldCommand.requestKey }), /social_request_mismatch/);
  await rejectsWithoutWrites("a V1 receipt key cannot be reused by V2 commit", upgraded,
    resolve(oldRead, { ...choose(normalized, "x"), requestKey: oldCommand.requestKey }), /social_request_mismatch/);
  const initial = resolve(oldRead, choose(normalized, "x"));
  const first = await commit(upgraded, initial);
  check("first V2 command persists both platforms while preserving marketing followers", first.state.audienceFollowers - first.state.socialFollowers, 80);
  check("upgrade commits one new revision", first.state.revision, old.revision + 1);
  check("V1 history remains after first V2 command", first.state.history[1], old.history[0]);
  check("commit settles commerce using old audience", await scalar("SELECT max(followers) FROM test_settlement_observations WHERE user_id=$1", [upgraded]), 112);
  await rejects("legacy wrapper refuses reads after upgrade", () => legacy(upgraded), /social_upgrade_required/);
  await rejects("legacy wrapper refuses old writes after upgrade", () => legacy(upgraded, oldCommand), /social_upgrade_required/);
  check("exact V2 read retry is replayed", (await read(upgraded, initial.command)).replayed, true);
  check("exact V2 commit retry does not advance revision", (await commit(upgraded, initial)).state.revision, first.state.revision);
  await rejects("read retry compares the entire command", () => read(upgraded, { ...initial.command, choiceId: "different" }), /social_request_mismatch/);
  await rejectsWithoutWrites("commit retry compares the entire command", upgraded, { ...initial, command: { ...initial.command, action: "recover" } }, /social_request_mismatch/);
  const later = await perform(upgraded, state => ({ ...base(state), action: "recover" }));
  const olderReplay = await read(upgraded, initial.command);
  check("old replay returns current state rather than rolling back later progress", [olderReplay.state.revision, olderReplay.replayed], [later.result.state.revision, true]);
  await rejects("unknown player cannot initialize V2", () => read(randomUUID()), /social_profile/);
  await rejects("read rejects a string command model version", () => read(upgraded, { ...initial.command, modelVersion: "2" }), /social_invalid/);

  const conflict = await player({ followers: 90 }), beforeConflict = await read(conflict);
  const stale = resolve(beforeConflict, choose(view(beforeConflict)));
  await query("UPDATE kq_online_accounts SET followers=followers+1 WHERE user_id=$1", [conflict]);
  await rejectsWithoutWrites("audience CAS rejects marketing changes between read and commit", conflict, stale, /social_changed/);
  const latest = await read(conflict), current = resolve(latest, choose(view(latest)));
  await rejectsWithoutWrites("command revision must match expected revision", conflict,
    { ...current, command: { ...current.command, expectedRevision: current.revision + 1 } }, /social_changed/);
  const competitor = resolve(latest, choose(view(latest), "x"));
  const attempts = await Promise.allSettled([commit(conflict, current), commit(conflict, competitor)]);
  check("two prepared commands at one revision commit once", attempts.map(result => result.status).sort(), ["fulfilled", "rejected"]);
  check("losing prepared command reports a revision conflict", attempts.find(result => result.status === "rejected").reason.message, "social_changed");
  check("CAS conflict leaves one durable receipt", await scalar("SELECT count(*)::INTEGER FROM kq_social_v2_receipts WHERE user_id=$1", [conflict]), 1);

  const invalidOwner = await player({ followers: 100 }), invalidEnvelope = await read(invalidOwner);
  const valid = resolve(invalidEnvelope, choose(view(invalidEnvelope)));
  const mutations = [
    ["social follower total", p => { p.next.socialFollowers += 1; }],
    ["audience total", p => { p.next.audienceFollowers += 1; }],
    ["receipt follower delta", p => { p.next.history[0].followersDelta += 1; }],
    ["receipt identity", p => { p.next.history[0].id = randomUUID(); }],
    ["next revision", p => { p.next.revision += 1; }],
    ["energy cap", p => { p.next.energy = 101; }],
    ["platform follower cap", p => { p.next.platforms.instagram.followers = 50001; }],
    ["future state timestamp", p => { p.next.serverNow = new Date(Date.now() + 60000).toISOString(); }],
    ["old state timestamp", p => { p.next.serverNow = new Date(Date.now() - 360000).toISOString(); }],
    ["empty receipt history", p => { p.next.history = []; }],
    ["earned reward without wallet payment", p => { p.next.sponsors.earnedCents = 1; }],
    ["receipt reward without wallet payment", p => { p.next.history[0].rewardCents = 1; }],
    ["missing model version", p => { delete p.next.version; }],
    ["null model version", p => { p.next.version = null; }],
    ["string model version", p => { p.next.version = "2"; }],
    ["negative reward", p => { p.reward = -1; }],
    ["reward above maximum", p => { p.reward = 18001; }],
    ["reward attached to a normal choice", p => { p.reward = 1; p.next.sponsors.earnedCents = 1; p.next.history[0].rewardCents = 1; }],
  ];
  for (const field of ["energy", "serverNow", "energyUpdatedAt", "platforms"]) {
    mutations.push([`missing ${field}`, p => { delete p.next[field]; }]);
    mutations.push([`null ${field}`, p => { p.next[field] = null; }]);
  }
  for (const field of ["revision", "socialFollowers", "audienceFollowers", "additionalVisitsPerDay"]) {
    mutations.push([`missing numeric ${field}`, p => { delete p.next[field]; }]);
    mutations.push([`string numeric ${field}`, p => { p.next[field] = String(p.next[field]); }]);
  }
  mutations.push(["missing earnedCents", p => { delete p.next.sponsors.earnedCents; }]);
  mutations.push(["string earnedCents", p => { p.next.sponsors.earnedCents = String(p.next.sponsors.earnedCents); }]);
  for (const field of ["followersDelta", "hatersDelta", "moderationDelta", "energyDelta", "trustDelta", "rewardCents"]) {
    mutations.push([`missing receipt ${field}`, p => { delete p.next.history[0][field]; }]);
    mutations.push([`string receipt ${field}`, p => { p.next.history[0][field] = String(p.next.history[0][field]); }]);
  }
  mutations.push(["missing command expectedRevision", p => { delete p.command.expectedRevision; }]);
  mutations.push(["string command expectedRevision", p => { p.command.expectedRevision = String(p.command.expectedRevision); }]);
  for (const platform of ["instagram", "x"]) {
    mutations.push([`missing ${platform} platform`, p => { delete p.next.platforms[platform]; }]);
    mutations.push([`null ${platform} platform`, p => { p.next.platforms[platform] = null; }]);
    for (const field of ["followers", "haters", "trust", "moderation", "chapter"]) {
      mutations.push([`missing ${platform}.${field}`, p => { delete p.next.platforms[platform][field]; }]);
      mutations.push([`null ${platform}.${field}`, p => { p.next.platforms[platform][field] = null; }]);
      mutations.push([`string ${platform}.${field}`, p => { p.next.platforms[platform][field] = String(p.next.platforms[platform][field]); }]);
    }
  }
  for (const [name, mutate] of mutations) {
    const malformed = structuredClone(valid); mutate(malformed);
    await rejectsWithoutWrites(`rejects inconsistent ${name}`, invalidOwner, malformed, /social_invalid/);
  }

  const incompleteOwner = await maturePlayer(), incompleteClaim = await finishBrief(incompleteOwner);
  const completeStoredState = (await read(incompleteOwner)).state;
  for (const progress of [[], [engine.KQ_SOCIAL_SPONSORS[0].requiredTags[0]], null, undefined]) {
    const incomplete = structuredClone(completeStoredState);
    if (progress === undefined) delete incomplete.sponsors.active.progressTags;
    else incomplete.sponsors.active.progressTags = progress;
    await query("UPDATE kq_social_accounts SET game_state=$2::jsonb WHERE user_id=$1", [incompleteOwner, JSON.stringify(incomplete)]);
    await rejectsWithoutWrites(`unfulfilled brief cannot pay (${JSON.stringify(progress) ?? "missing progress"})`, incompleteOwner, incompleteClaim, /social_invalid/);
  }

  const sponsorOwner = await maturePlayer({ cash: 10000 });
  let totalReward = 0, firstClaim;
  for (const sponsor of engine.KQ_SOCIAL_SPONSORS) {
    const claim = await finishBrief(sponsorOwner, sponsor);
    check(`${sponsor.id}: brief remains unpaid before claim`, (await read(sponsorOwner)).cashCents, 10000 + totalReward);
    const wrongReward = structuredClone(claim);
    wrongReward.reward -= 1; wrongReward.next.history[0].rewardCents -= 1; wrongReward.next.sponsors.earnedCents -= 1;
    await rejectsWithoutWrites(`${sponsor.id}: actual contract reward is authoritative`, sponsorOwner, wrongReward, /social_invalid/);
    const missingCompletion = structuredClone(claim); missingCompletion.next.sponsors.completedIds.pop();
    await rejectsWithoutWrites(`${sponsor.id}: claim must record completion`, sponsorOwner, missingCompletion, /social_invalid/);
    const absentCompletions = structuredClone(claim); delete absentCompletions.next.sponsors.completedIds;
    await rejectsWithoutWrites(`${sponsor.id}: missing completion list cannot bypass payment validation`, sponsorOwner, absentCompletions, /social_invalid/);
    const unclosed = structuredClone(claim); unclosed.next.sponsors.active = (await read(sponsorOwner)).state.sponsors.active;
    await rejectsWithoutWrites(`${sponsor.id}: paid contract must be closed`, sponsorOwner, unclosed, /social_invalid/);
    const paid = await commit(sponsorOwner, claim); totalReward += sponsor.rewardCents;
    check(`${sponsor.id}: wallet receives exact contractual fee`, paid.cashCents, 10000 + totalReward);
    check(`${sponsor.id}: earnings remain cumulative`, paid.state.sponsors.earnedCents, totalReward);
    check(`${sponsor.id}: paid result satisfies shared contract`, engine.isKqSocialSnapshot(paid.state), true);
    const replayed = await commit(sponsorOwner, claim);
    check(`${sponsor.id}: duplicate claim neither pays nor advances twice`, [replayed.cashCents, replayed.state.revision, replayed.replayed], [paid.cashCents, paid.state.revision, true]);
    check(`${sponsor.id}: one permanent reward receipt`, await scalar("SELECT count(*)::INTEGER FROM kq_social_v2_receipts WHERE user_id=$1 AND request_key=$2", [sponsorOwner, claim.command.requestKey]), 1);
    check(`${sponsor.id}: one reward ledger transaction`, await scalar("SELECT count(*)::INTEGER FROM kq_treasury_journal WHERE user_id=$1 AND source_key=$2", [sponsorOwner, `kq-social-sponsor:${claim.command.requestKey}`]), 1);
    const ledger = await scalar("SELECT postings FROM kq_treasury_journal WHERE user_id=$1 AND source_key=$2", [sponsorOwner, `kq-social-sponsor:${claim.command.requestKey}`]);
    check(`${sponsor.id}: balanced reward posting`, ledger, [{ account: "suspense", deltaCents: sponsor.rewardCents }, { account: "revenue_rewards", deltaCents: -sponsor.rewardCents }]);
    firstClaim ??= claim;
  }
  check("wallet cash reconciles with actual treasury balance", Number(await scalar("SELECT balance_cents FROM kq_treasury_balances WHERE user_id=$1 AND account='cash'", [sponsorOwner])), 10000 + totalReward);
  check("all sponsor earnings reconcile with reward revenue", Number(await scalar("SELECT balance_cents FROM kq_treasury_balances WHERE user_id=$1 AND account='revenue_rewards'", [sponsorOwner])), -totalReward);
  check("sponsor payments leave suspense balanced", Number(await scalar("SELECT balance_cents FROM kq_treasury_balances WHERE user_id=$1 AND account='suspense'", [sponsorOwner])), 0);
  for (let index = 0; index < 8; index++) {
    await readyToPost(sponsorOwner);
    await perform(sponsorOwner, state => choose(state, index % 2 ? "x" : "instagram", "care"));
  }
  const boundedHistory = (await read(sponsorOwner)).state.history;
  check("visible history remains bounded after more than 20 actions", boundedHistory.length, 20);
  check("old paid receipt has left the visible history", boundedHistory.some(entry => entry.id === firstClaim.command.requestKey), false);
  check("durable receipts remain after history truncation", await scalar("SELECT count(*)::INTEGER FROM kq_social_v2_receipts WHERE user_id=$1", [sponsorOwner]), 24);
  const finalRevision = (await read(sponsorOwner)).state.revision;
  check("old paid retry stays idempotent after other sponsor payments", [(await commit(sponsorOwner, firstClaim)).cashCents, (await read(sponsorOwner, firstClaim.command)).state.revision], [10000 + totalReward, finalRevision]);

  const overflowOwner = await maturePlayer({ cash: 2147483647 - 2999 });
  const overflowClaim = await finishBrief(overflowOwner);
  await rejectsWithoutWrites("wallet integer overflow rejects payment atomically", overflowOwner, overflowClaim, /social_wallet_limit/);
  await query("UPDATE kq_equipment_wallets SET cash_cents=2147483647-3000 WHERE user_id=$1", [overflowOwner]);
  const exactLimit = await commit(overflowOwner, overflowClaim);
  check("payment can reach the exact wallet limit", exactLimit.cashCents, 2147483647);
  check("overflow retry only pays once after capacity is available", (await commit(overflowOwner, overflowClaim)).cashCents, 2147483647);

  const atomicOwner = await maturePlayer(), atomicClaim = await finishBrief(atomicOwner);
  await db.exec(`CREATE FUNCTION fixture_fail_reward_ledger() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.kind='reward' THEN RAISE EXCEPTION 'fixture_reward_ledger_failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER fixture_fail_reward_ledger BEFORE INSERT ON kq_treasury_journal FOR EACH ROW EXECUTE FUNCTION fixture_fail_reward_ledger();`);
  await rejectsWithoutWrites("ledger failure rolls back wallet and entire claim", atomicOwner, atomicClaim, /fixture_reward_ledger_failure/);
  check("failed claim also rolls back newly initialized treasury account", await scalar("SELECT count(*)::INTEGER FROM kq_treasury_accounts WHERE user_id=$1", [atomicOwner]), 0);
  await db.exec("DROP TRIGGER fixture_fail_reward_ledger ON kq_treasury_journal");
  check("same failed request can succeed once the ledger is repaired", (await commit(atomicOwner, atomicClaim)).cashCents, 13000);

  const expandedOwner = await player();
  const observedAt = new Date().toISOString();
  cultureFixture = { version: 1, source: "own", observedAt,
    runs: [{ id: "fixture-run", zoneId: "zone", zoneName: "Placard", varietyCode: "VAR-TEST", varietyName: "Brume", cultivation: "indoor",
      stageIndex: 3, phase: "prepare", updatedAt: observedAt, cultureDead: false,
      problem: { symptom: "Quelques feuilles pâlissent.", diagnosis: null, status: "suspected" } }],
    lots: ["curing", "ready"].map(stage => ({ id: `fixture-${stage}`, runId: "fixture-harvest", varietyCode: "VAR-LOT", varietyName: "Aube", cultivation: "indoor",
      stage, harvestGrams: 125, remainingGrams: 80, harvestedAt: observedAt })) };
  for (const platform of ["instagram", "x"]) {
    const catalog = engine.KQ_SOCIAL_SCENARIOS.filter(scene => scene.platform === platform);
    check(`${platform}: expanded catalogue has 27 distinct situations`, new Set(catalog.map(scene => scene.id)).size, 27);
    for (const [index, scene] of catalog.entries()) {
      await readyToPost(expandedOwner);
      const published = await perform(expandedOwner, state => choose(state, platform, ["reach", "craft", "care"][index % 3]));
      check(`${scene.id}: database commits the authored situation`, published.result.state.history[0].scenarioId, scene.id);
      check(`${scene.id}: catalogue marker and cursor survive SQL storage`, [published.result.state.storyCatalogVersion, published.result.state.platforms[platform].chapter], [2, index + 1]);
    }
  }
  check("all 54 expanded situations retain durable receipts", await scalar("SELECT count(*)::INTEGER FROM kq_social_v2_receipts WHERE user_id=$1", [expandedOwner]), 54);

  for (const role of ["anon", "authenticated", "service_role"]) {
    for (const table of ["kq_social_accounts", "kq_social_platforms", "kq_social_requests", "kq_social_v2_receipts"]) {
      for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"]) check(`${role} cannot ${privilege} ${table}`,
        await scalar("SELECT has_table_privilege($1,$2,$3)", [role, `public.${table}`, privilege]), false);
    }
    for (const rpc of ["public.rpc_kq_social(uuid,jsonb)", "public.rpc_kq_social_v2_read(uuid,jsonb)", "public.rpc_kq_social_v2_commit(uuid,jsonb,integer,integer,jsonb,integer)"]) {
      check(`${role} ${rpc} execute permission`, await scalar("SELECT has_function_privilege($1,$2,'EXECUTE')", [role, rpc]), role === "service_role");
    }
    for (const helper of ["public.rpc_kq_social_v1(uuid,jsonb)", "public.kq_social_v2_envelope(uuid,boolean)", "public.kq_social_catalog()", "public.kq_social_scenario(text,integer)", "public.kq_social_snapshot(uuid,boolean)"]) {
      check(`${role} cannot invoke internal ${helper}`, await scalar("SELECT has_function_privilege($1,$2,'EXECUTE')", [role, helper]), false);
    }
  }
  check("all social tables retain row-level security", (await query("SELECT relname FROM pg_class WHERE oid=ANY($1::regclass[]) AND relrowsecurity ORDER BY relname", [["kq_social_accounts", "kq_social_platforms", "kq_social_requests", "kq_social_v2_receipts"]])).rows.map(record => record.relname),
    ["kq_social_accounts", "kq_social_platforms", "kq_social_requests", "kq_social_v2_receipts"]);
  await db.exec("SET ROLE service_role");
  check("service role can read a real V2 state through SECURITY DEFINER", engine.isKqSocialSnapshot((await read(sponsorOwner)).state), true);
  const serviceChoice = await perform(atomicOwner, state => ({ ...base(state), action: "recover" }));
  check("service role can commit through SECURITY DEFINER without table grants", serviceChoice.result.state.revision, serviceChoice.prepared.revision + 1);
  await db.exec("RESET ROLE");
  console.log(`Social V2: ${checks.length} isolated PostgreSQL checks passed (upgrade, CAS, exact retries, sponsorships, accounting, rollback, overflow and private grants).`);
} catch (error) {
  console.error(`Social V2 failed after ${checks.length} checks:`, error.message, error.where ?? error.stack);
  process.exitCode = 1;
} finally { await vite.close(); await db.close(); }
