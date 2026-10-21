// Isolated PostgreSQL only. Uses the production migrations, campaign identity,
// treasury journal and wallet observer; no credentials or remote connection.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createContractFixture } from "./lib/placard-contracts-fixture.mjs";
import { parseKqContractBoard, parseKqContractBoardResult } from "../src/lib/kanab-quest-renewable-contracts.ts";

const fixture = await createContractFixture({ renewable: true });
const { db, scalar, player } = fixture;
let checks = 0;
const equal = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
const rejects = async (fn, message) => { await assert.rejects(fn, error => error.message.includes(message)); checks++; };
const rawBoard = owner => scalar("SELECT rpc_kq_contract_board($1)", [owner]);
const board = async owner => {
  const result = await rawBoard(owner);
  equal(parseKqContractBoard(result), result, "actual PostgreSQL board satisfies the strict application parser");
  return result;
};
const command = async (owner, action, id, code = null) => {
  const result = await scalar("SELECT rpc_kq_contract_board_action($1,$2,$3,$4)", [owner, action, code, id]);
  equal(parseKqContractBoardResult(result), result, "actual action and receipt satisfy the strict application parser");
  return result;
};
const accept = (owner, code = "steady-hand", id = randomUUID()) => command(owner, "accept", id, code);
const state = patch => ({ phase: "prepare", quality: 0, usedCards: [], ...patch });
const winning = patch => state({ phase: "complete", quality: 10, harvestGrams: 100, ...patch });
const start = (owner, value = state(), id = randomUUID()) =>
  scalar("INSERT INTO kq_runs(id,user_id,state) VALUES($1,$2,$3) RETURNING id", [id, owner, value]);
const finish = async (owner, run, value, { flower = true, flowerQuality = value.quality, flowerOwner = owner, status = "completed" } = {}) => {
  // The real game completes a run/campaign and its flowers atomically. This
  // fixture calls the board only after both fixture writes are complete.
  await db.query("UPDATE kq_runs SET state=$3,status=$4,completed_at=CASE WHEN $4='completed' THEN now() ELSE NULL END WHERE user_id=$1 AND id=$2",
    [owner, run, value, status]);
  if (flower) await db.query("INSERT INTO kq_flowers(run_id,owner_id,quality) VALUES($1,$2,$3)", [run, flowerOwner, flowerQuality]);
};
const cash = owner => scalar("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [owner]);
const attemptCount = owner => scalar("SELECT count(*)::INTEGER FROM kq_renewable_contract_attempts WHERE user_id=$1", [owner]);
const unlock = async owner => {
  await fixture.action(owner, "accept");
  const run = await start(owner);
  await finish(owner, run, winning({ quality: 8 }));
  await fixture.action(owner, "claim");
};
const newUnlocked = async () => { const owner = await player(); await unlock(owner); return owner; };
const rewardJournal = owner => scalar("SELECT count(*)::INTEGER FROM kq_treasury_journal WHERE user_id=$1 AND source_key LIKE 'kq-contract-attempt:%'", [owner]);

try {
  const locked = await player();
  const lockedBoard = await board(locked);
  equal([lockedBoard.unlocked, lockedBoard.canAccept, lockedBoard.current, lockedBoard.completedCount],
    [false, false, null, 0], "Main légère must be claimed first");
  equal(lockedBoard.offers, [
    { code: "steady-hand", minimumQuality: 10, maxCardsUsed: 2, rewardCents: 1500 },
    { code: "pure-grower", minimumQuality: 8, maxCardsUsed: 0, rewardCents: 1000 },
    { code: "fine-flower", minimumQuality: 12, maxCardsUsed: null, rewardCents: 2000 },
  ], "three server-authoritative offers remain visible before unlock");
  await rejects(() => accept(locked), "contract_locked");
  await fixture.action(locked, "accept");
  const unlockingRun = await start(locked);
  await finish(locked, unlockingRun, winning({ quality: 8 }));
  equal((await board(locked)).unlocked, false, "winning Main légère without claiming does not unlock");
  await fixture.action(locked, "claim");
  equal((await board(locked)).canAccept, true, "claiming Main légère opens the board");
  equal(await attemptCount(locked), 0, "viewing and unlocking never accept a contract");
  await rejects(() => accept(locked, "made-up"), "contract_unknown");
  await rejects(() => command(locked, "invent", randomUUID()), "contract_action_invalid");
  await rejects(() => accept(locked, "steady-hand", null), "contract_attempt_invalid");
  await rejects(() => command(locked, "claim", randomUUID()), "contract_attempt_unknown");
  await rejects(() => command(locked, "cancel", randomUUID(), "steady-hand"), "contract_action_invalid");
  await rejects(() => rawBoard(randomUUID()), "contract_invalid_user");

  const owner = locked;
  const historical = await start(owner);
  equal((await board(owner)).canAccept, false, "an existing active run blocks accepting");
  await rejects(() => accept(owner), "contract_active_run");
  await finish(owner, historical, winning({ quality: 30 }));
  const first = randomUUID();
  const accepted = await accept(owner, "steady-hand", first);
  equal([accepted.board.current.status, accepted.board.current.runId, accepted.board.current.quality, accepted.board.current.cardsUsed],
    ["accepted", null, null, null], "a past high-quality flower never attaches retroactively");
  equal((await accept(owner, "steady-hand", first)).replayed, true, "repeated stable accept UUID is idempotent");
  await rejects(() => accept(owner), "contract_pending");
  await rejects(() => accept(owner, "pure-grower", first), "contract_attempt_conflict");
  await rejects(() => command(owner, "claim", first), "contract_not_ready");
  equal(await attemptCount(owner), 1, "only one attempt is recorded");
  equal((await command(owner, "cancel", first)).board.current.status, "cancelled", "cancellation is preserved in the ledger");
  equal((await command(owner, "cancel", first)).replayed, true, "cancel retry retains its old identity");
  const second = randomUUID();
  await accept(owner, "steady-hand", second);
  equal((await accept(owner, "steady-hand", first)).board.current.id, second, "stale accept cannot revive a cancelled attempt");
  equal((await command(owner, "cancel", first)).board.current.id, second, "stale cancellation never cancels a newer choice");
  await rejects(() => command(owner, "claim", first), "contract_not_ready");
  const outsider = await newUnlocked();
  await rejects(() => accept(outsider, "steady-hand", second), "contract_attempt_conflict");
  await rejects(() => command(outsider, "claim", second), "contract_attempt_unknown");
  await rejects(() => command(outsider, "cancel", second), "contract_attempt_unknown");
  const otherRun = await start(outsider);
  equal((await board(owner)).current.runId, null, "another owner's new run cannot bind");
  await finish(outsider, otherRun, winning());

  // Updates never bind an attempt. Only a genuine new active leader does.
  await db.query("UPDATE kq_runs SET state=state||'{\"quality\":31}'::jsonb WHERE id=$1", [historical]);
  equal((await board(owner)).current.runId, null, "changing a historical culture cannot attach it");
  const run = await start(owner, state({ quality: 4 }));
  const active = (await board(owner)).current;
  equal([active.id, active.runId, active.status, active.quality, active.cardsUsed], [second, run, "active", 4, 0],
    "a real new run binds the accepted identity");
  await rejects(() => command(owner, "cancel", second), "contract_already_started");
  await rejects(() => command(owner, "claim", second), "contract_not_ready");
  await finish(owner, run, winning({ usedCards: ["BOTTE-001", "BOTTE-001"] }));
  equal((await board(owner)).current.status, "succeeded", "exact threshold and two spent copies qualify");
  const flowersBefore = (await db.query("SELECT * FROM kq_flowers WHERE owner_id=$1 ORDER BY id", [owner])).rows;
  const claims = await Promise.all([command(owner, "claim", second), command(owner, "claim", second), command(owner, "claim", second)]);
  equal(claims.map(result => result.replayed), [false, true, true], "queued duplicate requests pay once");
  equal(claims.map(result => result.receipt.cashAfterCents), [104500, 104500, 104500], "replays retain their original balance");
  equal(await cash(owner), 104500, "exactly one fifteen-euro premium");
  equal(await rewardJournal(owner), 1, "one immutable accounting source key per attempt");
  equal((await board(owner)).completedCount, 1, "one claimed contract completed");
  equal(await scalar("SELECT count(*)::INTEGER FROM contract_fixture_settlements WHERE user_id=$1", [owner]), 2,
    "Main légère and the fresh recurring claim each settle once");
  equal((await db.query("SELECT * FROM kq_flowers WHERE owner_id=$1 ORDER BY id", [owner])).rows, flowersBefore,
    "contract never consumes or sells a flower");
  await rejects(() => db.query("UPDATE kq_renewable_contract_attempts SET reward_cents=900000 WHERE id=$1", [second]), "contract_attempt_immutable");
  await rejects(() => db.query("UPDATE kq_renewable_contract_attempts SET quality=100 WHERE id=$1", [second]), "contract_attempt_immutable");
  await rejects(() => command(owner, "cancel", second), "contract_already_started");

  const third = randomUUID();
  await accept(owner, "pure-grower", third);
  equal((await accept(owner, "steady-hand", second)).board.current.id, third, "old claimed accept cannot create another reward");
  const oldClaim = await command(owner, "claim", second);
  equal([oldClaim.replayed, oldClaim.receipt.id, oldClaim.receipt.cashAfterCents, oldClaim.board.current.id],
    [true, second, 104500, third], "old claim returns its receipt without changing the new objective");
  equal(await cash(owner), 104500, "stale commands leave the current wallet unchanged");
  await command(owner, "cancel", third);
  equal(await attemptCount(owner), 3, "cancelled and claimed attempts remain in history");

  for (const item of [
    { code: "pure-grower", quality: 8, cards: [], reward: 1000 },
    { code: "fine-flower", quality: 12, cards: Array(6).fill("BOTTE-002"), reward: 2000 },
  ]) {
    const current = (await accept(owner, item.code)).board.current;
    const nextRun = await start(owner);
    await finish(owner, nextRun, winning({ quality: item.quality, usedCards: item.cards }));
    // A legitimate flower still counts after a jury consumes it.
    await db.query("UPDATE kq_flowers SET status='burned' WHERE run_id=$1", [nextRun]);
    const beforeCash = await cash(owner);
    const reward = await command(owner, "claim", current.id);
    equal([reward.replayed, reward.receipt.rewardCents, await cash(owner)], [false, item.reward, beforeCash + item.reward],
      `${item.code}: correct captured premium and conditions`);
  }
  equal((await board(owner)).completedCount, 3, "completed count excludes cancellations");
  equal(await cash(owner), 107500, "three different offers pay their actual amounts");
  equal(await scalar("SELECT sum(balance_cents)::INTEGER FROM kq_treasury_balances WHERE user_id=$1", [owner]), 0,
    "production accounting remains balanced");
  equal(await scalar("SELECT balance_cents::INTEGER FROM kq_treasury_balances WHERE user_id=$1 AND account='revenue_rewards'", [owner]), -7500,
    "Main légère and recurring premiums are real reward income");

  for (const item of [
    { name: "third card", value: winning({ usedCards: Array(3).fill("BOTTE-001") }) },
    { name: "pure-grower spent a card", code: "pure-grower", value: winning({ usedCards: ["BOTTE-001"] }) },
    { name: "low actual flower quality", value: winning({ quality: 30 }), flowerQuality: 9 },
    { name: "zero harvest", value: winning({ harvestGrams: 0 }) },
    { name: "negative harvest", value: winning({ harvestGrams: -1 }) },
    { name: "string harvest", value: winning({ harvestGrams: "100" }) },
    { name: "missing harvest", value: winning({ harvestGrams: undefined }) },
    { name: "dead culture", value: winning({ cultureDead: true }) },
    { name: "malformed death flag", value: winning({ cultureDead: "false" }) },
    { name: "absent cards", value: winning({ usedCards: undefined }) },
    { name: "null cards", value: winning({ usedCards: null }) },
    { name: "invalid card code", value: winning({ usedCards: ["HH2026-001"] }) },
    { name: "non-string card", value: winning({ usedCards: [1] }) },
    { name: "uncapped still needs verified cards", code: "fine-flower", value: winning({ quality: 20, usedCards: null }) },
    { name: "no actual flower", value: winning(), flower: false },
    { name: "abandoned", value: winning(), status: "abandoned", flower: false },
    { name: "not complete phase", value: winning({ phase: "resolved" }) },
    { name: "another owner's flower", value: winning(), flowerOwner: outsider },
  ]) {
    const user = await newUnlocked();
    const chosen = (await accept(user, item.code ?? "steady-hand")).board.current;
    const failedRun = await start(user);
    await finish(user, failedRun, item.value, item);
    const failed = await board(user);
    equal([failed.current.status, failed.canAccept, failed.completedCount], ["failed", true, 0], `${item.name}: no reward`);
    await rejects(() => command(user, "claim", chosen.id), "contract_not_ready");
    equal(await cash(user), 103000, `${item.name}: wallet unchanged`);
    const next = await accept(user, "steady-hand");
    equal(next.board.current.runId, null, `${item.name}: retry waits for a new culture`);
    equal((await accept(user, item.code ?? "steady-hand", chosen.id)).board.current.id, next.board.current.id,
      `${item.name}: replay of a failed acceptance cannot overwrite the retry`);
    equal(await scalar("SELECT status FROM kq_renewable_contract_attempts WHERE id=$1", [chosen.id]), "failed",
      `${item.name}: failed attempt is retained`);
  }

  const authoritative = await newUnlocked();
  const authorityAttempt = (await accept(authoritative)).board.current;
  const authorityRun = await start(authoritative);
  await finish(authoritative, authorityRun, winning({ quality: "not-a-score" }), { flowerQuality: 10 });
  equal((await board(authoritative)).current.quality, 10, "the actual flower supplies the score; malformed state is not turned into zero");
  await command(authoritative, "claim", authorityAttempt.id);

  // Captured conditions survive catalog changes and cannot be edited in-place.
  const captured = await newUnlocked();
  const capturedAttempt = (await accept(captured)).board.current;
  await rejects(() => db.query("UPDATE kq_renewable_contract_attempts SET minimum_quality=0 WHERE id=$1", [capturedAttempt.id]), "contract_attempt_immutable");
  const migrationSource = await readFile(new URL("../supabase/migrations/20261020000200_kq_renewable_contracts.sql", import.meta.url), "utf8");
  const offersDefinition = migrationSource.match(/CREATE FUNCTION public\.kq_renewable_contract_offers\(\)[\s\S]*?\$\$;/)?.[0];
  assert(offersDefinition);
  await db.exec(offersDefinition.replace("CREATE FUNCTION", "CREATE OR REPLACE FUNCTION").replace('"minimumQuality":10', '"minimumQuality":99').replace('"rewardCents":1500', '"rewardCents":99'));
  const capturedRun = await start(captured);
  await finish(captured, capturedRun, winning());
  const capturedReceipt = await command(captured, "claim", capturedAttempt.id);
  equal([capturedReceipt.receipt.minimumQuality, capturedReceipt.receipt.rewardCents], [10, 1500], "accepted thresholds and prize never drift with the catalog");
  await db.exec(offersDefinition.replace("CREATE FUNCTION", "CREATE OR REPLACE FUNCTION"));

  // Genuine canonical campaign trigger, follower first, shared leader cards.
  const multi = await newUnlocked();
  const multiAttempt = (await accept(multi)).board.current;
  const lead = randomUUID(), child = randomUUID(), campaignId = randomUUID();
  const members = [lead, child].map((runId, index) => ({
    runId, zoneId: `zone-${index}`, buddieCode: `HH2026-02${index}`,
    warehouse: { zoneId: `zone-${index}`, qualityBonus: index },
    cultivationProfile: { buddieCode: `HH2026-02${index}` },
  }));
  const campaign = { id: campaignId, leaderRunId: lead, members };
  const states = members.map(member => state({
    campaign, warehouse: member.warehouse, varietyCode: member.buddieCode,
    cultivationProfile: member.cultivationProfile, quality: member.runId === lead ? 3 : 6,
  }));
  await db.query("INSERT INTO kq_culture_campaigns(id,user_id,leader_run_id,manifest) VALUES($1,$2,$3,$4)", [campaignId, multi, lead, campaign]);
  equal(await start(multi, states[1]), child, "canonical identity chooses follower id");
  equal((await board(multi)).current.runId, null, "inserting the follower first cannot consume the contract");
  equal(await start(multi, states[0]), lead, "canonical identity chooses leader id");
  equal([(await board(multi)).current.runId, (await board(multi)).current.quality], [lead, 6], "leader owns the contract; best live member quality is shown");
  const sharedCards = ["BOTTE-001", "BOTTE-002"];
  await finish(multi, lead, { ...states[0], phase: "complete", quality: 5, harvestGrams: 40, usedCards: sharedCards });
  await finish(multi, child, { ...states[1], phase: "complete", quality: 10, harvestGrams: 50, usedCards: sharedCards });
  equal([(await board(multi)).current.status, (await board(multi)).current.quality, (await board(multi)).current.cardsUsed],
    ["succeeded", 10, 2], "one qualified member and two shared cards qualify once");
  await command(multi, "claim", multiAttempt.id);
  equal([await cash(multi), await rewardJournal(multi)], [104500, 1], "multiple zones never multiply the premium");
  await rejects(() => db.query("UPDATE kq_renewable_contract_attempts SET run_id=$2 WHERE id=$1", [multiAttempt.id, child]), "contract_attempt_immutable");

  const rich = await newUnlocked();
  const richAttempt = (await accept(rich)).board.current;
  const richRun = await start(rich);
  await finish(rich, richRun, winning());
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=2147483000 WHERE user_id=$1", [rich]);
  await rejects(() => command(rich, "claim", richAttempt.id), "contract_wallet_limit");
  equal([(await board(rich)).current.status, await cash(rich), await rewardJournal(rich)], ["succeeded", 2147483000, 0],
    "overflow rolls back payout and preserves the earned claim");
  equal(await scalar("SELECT count(*)::INTEGER FROM contract_fixture_settlements WHERE user_id=$1", [rich]), 1,
    "failed claim rolls back business settlement too");
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=200000 WHERE user_id=$1", [rich]);
  equal((await command(rich, "claim", richAttempt.id)).receipt.cashAfterCents, 201500, "the same earned attempt remains claimable after wallet correction");

  for (const role of ["anon", "authenticated", "service_role"]) {
    equal(await scalar("SELECT has_table_privilege($1,'public.kq_renewable_contract_attempts','SELECT,INSERT,UPDATE,DELETE')", [role]), false,
      `${role} has no private ledger privileges`);
    equal(await scalar("SELECT has_sequence_privilege($1,'public.kq_renewable_contract_attempts_ordinal_seq','USAGE,SELECT,UPDATE')", [role]), false,
      `${role} has no private sequence privileges`);
    for (const signature of ["public.rpc_kq_contract_board(uuid)", "public.rpc_kq_contract_board_action(uuid,text,text,uuid)"]) {
      equal(await scalar("SELECT has_function_privilege($1,$2,'EXECUTE')", [role, signature]), role === "service_role",
        `${role} has explicit RPC permissions`);
    }
    for (const signature of ["public.kq_bind_renewable_contract()", "public.kq_guard_renewable_contract_attempt()", "public.kq_renewable_contract_offers()", "public.kq_renewable_contract_json(public.kq_renewable_contract_attempts)"]) {
      equal(await scalar("SELECT has_function_privilege($1,$2,'EXECUTE')", [role, signature]), false,
        `${role} cannot invoke private helpers`);
    }
  }
  await db.exec("SET ROLE anon");
  await rejects(() => rawBoard(owner), "permission denied");
  await db.exec("RESET ROLE");
  await db.exec("SET ROLE service_role");
  equal((await board(owner)).completedCount, 3, "service RPC reads work with zero direct table grants");
  await rejects(() => db.query("SELECT * FROM kq_renewable_contract_attempts"), "permission denied");
  await rejects(() => db.query("UPDATE kq_renewable_contract_attempts SET cash_after_cents=0"), "permission denied");
  await db.exec("RESET ROLE");

  console.log(`Renewable production contracts: ${checks} isolated PostgreSQL checks passed. Real migrations, identity and accounting; queued duplicates use one PGlite connection, not a cross-connection concurrency test. No remote writes.`);
} catch (error) {
  console.error(error.message, error.where ?? "");
  process.exitCode = 1;
} finally { await db.close(); }
