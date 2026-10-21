// Production SQL in isolated PGlite. No credentials or remote database writes.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createContractFixture } from "./lib/placard-contracts-fixture.mjs";
import { parseKqContractSnapshot, readKqContractProgress } from "../src/lib/kanab-quest-contracts.ts";

const fixture = await createContractFixture();
const { db, scalar, player, snapshot, action } = fixture;
let checks = 0;
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
const rejects = async (fn, message) => { await assert.rejects(fn, error => error.message.includes(message)); checks++; };
const makeState = patch => ({ phase: "prepare", quality: 0, usedCards: [], ...patch });
const start = (owner, state = makeState(), id = randomUUID()) => scalar("INSERT INTO kq_runs(id,user_id,state) VALUES($1,$2,$3) RETURNING id", [id, owner, state]);
const finish = async (owner, run, state, { flower = true, status = "completed" } = {}) => {
  await db.query("UPDATE kq_runs SET state=$3,status=$4,completed_at=CASE WHEN $4='completed' THEN now() ELSE NULL END WHERE user_id=$1 AND id=$2", [owner, run, state, status]);
  if (flower) await db.query("INSERT INTO kq_flowers(run_id,owner_id,quality) VALUES($1,$2,$3)", [run, owner, state.quality]);
};
const winning = patch => makeState({ phase: "complete", quality: 8, harvestGrams: 100, usedCards: ["BOTTE-001", "BOTTE-001"], ...patch });

try {
  const owner = await player();
  const before = await snapshot(owner);
  equal(parseKqContractSnapshot(before), before, "strict application parser accepts the actual SQL response");
  equal([before.status, before.canAccept, before.quality, before.cardsUsed], ["available", true, null, null], "unknown is not invented zero progress");
  await rejects(() => action(owner, "claim"), "contract_not_ready");
  await rejects(() => action(owner, "accept", "other-contract"), "contract_unknown");
  await rejects(() => action(owner, "invent"), "contract_action_invalid");
  await rejects(() => action(randomUUID(), "accept"), "contract_invalid_user");

  // A culture begun before acceptance cannot become a contract retroactively.
  const old = await start(owner);
  equal((await snapshot(owner)).canAccept, false, "an active culture prevents accepting a new contract");
  await rejects(() => action(owner, "accept"), "contract_active_run");
  await finish(owner, old, winning({ quality: 25 }));
  equal((await action(owner, "accept")).status, "accepted", "acceptance after an old success has no run");
  equal((await action(owner, "accept")).replayed, true, "duplicate acceptance retains the same pending attempt");
  equal(await scalar("SELECT attempt FROM kq_production_contracts WHERE user_id=$1", [owner]), 1, "an accepted retry cannot allocate a second attempt");
  await rejects(() => action(owner, "claim"), "contract_not_ready");
  equal((await action(owner, "cancel")).status, "available", "cancel before launch restores availability without cost");
  equal((await action(owner, "cancel")).replayed, true, "duplicate cancellation is harmless");
  await action(owner, "accept");
  await db.query("UPDATE kq_production_contracts SET accepted_at='2000-01-01' WHERE user_id=$1", [owner]);
  const current = await start(owner, makeState({ quality: 9 }));
  equal([(await snapshot(owner)).status, (await snapshot(owner)).runId], ["active", current], "only the next actual insertion binds, without expiry");
  await rejects(() => action(owner, "cancel"), "contract_already_started");
  await rejects(() => action(owner, "claim"), "contract_not_ready");
  await finish(owner, current, winning({ quality: 8 }));
  equal((await snapshot(owner)).status, "succeeded", "exactly eight quality and two spent copies qualify");
  const flowerBefore = (await db.query("SELECT * FROM kq_flowers WHERE owner_id=$1 ORDER BY id", [owner])).rows;
  const claims = await Promise.all([action(owner, "claim"), action(owner, "claim"), action(owner, "claim")]);
  equal(claims.map(claim => claim.replayed), [false, true, true], "queued duplicate claims share one receipt");
  equal(await scalar("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [owner]), 103000, "one thirty-euro premium");
  equal(await scalar("SELECT count(*)::INTEGER FROM kq_treasury_journal WHERE user_id=$1 AND kind='reward'", [owner]), 1, "one real accounting reward entry");
  equal(await scalar("SELECT balance_cents::INTEGER FROM kq_treasury_balances WHERE user_id=$1 AND account='revenue_rewards'", [owner]), -3000, "reward classified as revenue");
  equal(await scalar("SELECT sum(balance_cents)::INTEGER FROM kq_treasury_balances WHERE user_id=$1", [owner]), 0, "actual accounting postings balance");
  equal(await scalar("SELECT count(*)::INTEGER FROM contract_fixture_settlements WHERE user_id=$1", [owner]), 1, "idempotent replays do not settle business again");
  equal((await db.query("SELECT * FROM kq_flowers WHERE owner_id=$1 ORDER BY id", [owner])).rows, flowerBefore, "no flower is sold, consumed or moved");
  equal(parseKqContractSnapshot(claims[0]), claims[0], "actual receipt passes the strict response parser");
  equal((await action(owner, "accept")).status, "claimed", "a claimed contract cannot start another rewarded attempt");
  await rejects(() => action(owner, "cancel"), "contract_already_started");
  await start(owner);
  equal((await snapshot(owner)).cashAfterCents, 103000, "claimed receipt survives later cultures unchanged");

  for (const test of [
    { name: "third card", state: winning({ usedCards: ["BOTTE-001", "BOTTE-001", "BOTTE-002"] }) },
    { name: "insufficient quality", state: winning({ quality: 7 }) },
    { name: "dead culture", state: winning({ cultureDead: true }) },
    { name: "zero yield", state: winning({ harvestGrams: 0 }) },
    { name: "absent cards", state: { ...winning(), usedCards: undefined } },
    { name: "malformed cards", state: winning({ usedCards: ["HH2026-001"] }) },
    { name: "no official harvest", state: winning(), flower: false },
    { name: "abandonment", state: winning(), flower: false, status: "abandoned" },
    { name: "not completed phase", state: winning({ phase: "resolved" }) },
  ]) {
    const user = await player(); await action(user, "accept");
    const run = await start(user); await finish(user, run, test.state, test);
    const failed = await snapshot(user);
    equal([failed.status, failed.canAccept], ["failed", true], `${test.name}: no reward, voluntary retry available`);
    await rejects(() => action(user, "claim"), "contract_not_ready");
    await action(user, "accept");
    equal((await snapshot(user)).runId, null, `${test.name}: retry must wait for a newly started culture`);
    equal(await scalar("SELECT attempt FROM kq_production_contracts WHERE user_id=$1", [user]), 2, `${test.name}: new attempt recorded once`);
    await rejects(() => action(user, "claim"), "contract_not_ready");
  }

  // Multi-zone production: the genuine BEFORE identity trigger canonicalizes
  // ids. Inserting a follower first must not consume the pending contract.
  const multi = await player(); await action(multi, "accept");
  const lead = randomUUID(), child = randomUUID(), campaignId = randomUUID();
  const members = [lead, child].map((runId, index) => ({ runId, zoneId: `zone-${index}`, buddieCode: `HH2026-02${index}`,
    warehouse: { zoneId: `zone-${index}`, qualityBonus: index }, cultivationProfile: { buddieCode: `HH2026-02${index}` } }));
  const campaign = { id: campaignId, leaderRunId: lead, members };
  const states = members.map(member => makeState({ campaign, warehouse: member.warehouse, varietyCode: member.buddieCode,
    cultivationProfile: member.cultivationProfile, quality: member.runId === lead ? 3 : 4 }));
  await db.query("INSERT INTO kq_culture_campaigns(id,user_id,leader_run_id,manifest) VALUES($1,$2,$3,$4)", [campaignId, multi, lead, campaign]);
  equal(await start(multi, states[1]), child, "existing campaign identity selects the canonical follower id");
  equal((await snapshot(multi)).runId, null, "follower does not bind the contract");
  equal(await start(multi, states[0]), lead, "existing identity selects the canonical leader id");
  equal((await snapshot(multi)).runId, lead, "one leader owns the shared attempt");
  equal((await snapshot(multi)).quality, 4, "live quality is the actual best member, not a sum");
  await finish(multi, lead, { ...winning({ quality: 5 }), ...states[0], phase: "complete", quality: 5, harvestGrams: 40, usedCards: ["BOTTE-001", "BOTTE-001"] });
  await finish(multi, child, { ...states[1], phase: "complete", quality: 8, harvestGrams: 50, usedCards: ["BOTTE-001", "BOTTE-001"] });
  equal([(await snapshot(multi)).status, (await snapshot(multi)).quality, (await snapshot(multi)).cardsUsed], ["succeeded", 8, 2], "one qualifying member and shared cards satisfy the campaign contract");
  await action(multi, "claim");
  equal(await scalar("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [multi]), 103000, "two campaign flowers still give a single premium");

  const other = await player(); await action(other, "accept");
  const bad = await start(other); await finish(other, bad, winning({ quality: 2 }));
  equal((await snapshot(other)).status, "failed", "another player's good flower cannot validate this contract");
  const blockingRun = await start(other);
  equal((await snapshot(other)).canAccept, false, "failed attempt cannot be reassigned to another already-active run");
  await rejects(() => action(other, "accept"), "contract_active_run");
  await finish(other, blockingRun, winning(), { status: "abandoned", flower: false });
  await action(other, "accept");
  const retry = await start(other); await finish(other, retry, winning());
  equal((await action(other, "claim")).cashAfterCents, 103000, "a genuinely new successful retry can earn the first premium");

  const rich = await player(); await action(rich, "accept");
  const richRun = await start(rich); await finish(rich, richRun, winning());
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=2147483000 WHERE user_id=$1", [rich]);
  await rejects(() => action(rich, "claim"), "contract_wallet_limit");
  equal((await snapshot(rich)).status, "succeeded", "failed payout leaves its earned reward unclaimed");
  equal(await scalar("SELECT count(*)::INTEGER FROM kq_treasury_journal WHERE user_id=$1 AND kind='reward'", [rich]), 0, "wallet overflow rolls back the accounting reward");

  for (const value of [null, {}, { quality: 8 }, { quality: 0, usedCards: [] }, { quality: -2, usedCards: ["BOTTE-001", "BOTTE-001"] }, { quality: 1.2, usedCards: null }, { quality: 8, usedCards: ["invalid"] }]) {
    equal(await scalar("SELECT kq_contract_progress($1)", [value]), readKqContractProgress(value), "SQL/TS metric readers agree without inventing missing values");
  }
  for (const role of ["anon", "authenticated", "service_role"]) {
    equal(await scalar("SELECT has_table_privilege($1,'public.kq_production_contracts','SELECT,INSERT,UPDATE,DELETE')", [role]), false, `${role} cannot forge or read private receipts`);
    equal(await scalar("SELECT has_function_privilege($1,'public.rpc_kq_contract_action(uuid,text,text)','EXECUTE')", [role]), role === "service_role", `${role} RPC permissions are explicit`);
    equal(await scalar("SELECT has_function_privilege($1,'public.kq_bind_production_contract()','EXECUTE')", [role]), false, `${role} cannot invoke trigger helper`);
  }
  await db.exec("SET ROLE service_role");
  equal((await snapshot(other)).status, "claimed", "the service role can read the RPC despite private table grants");
  await rejects(() => db.query("UPDATE kq_production_contracts SET claimed_at=NULL"), "permission denied");
  await db.exec("RESET ROLE");
  console.log(`Production contract: ${checks} isolated PostgreSQL checks passed. Real contract, campaign identity and accounting functions; no deployed writes.`);
} catch (error) {
  console.error(error.message, error.where ?? "");
  process.exitCode = 1;
} finally { await db.close(); }
