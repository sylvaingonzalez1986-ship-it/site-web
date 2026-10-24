// Isolated PostgreSQL checks: no credentials, environment files or deployed writes.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const vite = await createServer({ configFile: false, envDir: false,
  resolve: { alias: { "@": path.resolve("src") } }, server: { middlewareMode: true, watch: null } });
const row = async (sql, values = []) => (await db.query(sql, values)).rows[0];
const social = async (owner, command = null) => (await row("SELECT public.rpc_kq_social($1,$2::jsonb) AS data", [owner, command === null ? null : JSON.stringify(command)])).data;
const emptySocial = async owner => social(owner, null);
let catalog, isSnapshot;
const platformStories = platform => catalog.filter(story => story.platform === platform);
const choose = (view, platform = "instagram", index = 0, requestKey = randomUUID()) => {
  const story = platformStories(platform)[view.platforms[platform].chapter % 6];
  return { action: "choose", requestKey, expectedRevision: view.revision, platform, scenarioId: story.id, choiceId: story.choices[index].id };
};
const recover = view => ({ action: "recover", requestKey: randomUUID(), expectedRevision: view.revision });
async function player({ followers = 0, reputation = 0, active = false } = {}) {
  const id = randomUUID();
  await db.query("INSERT INTO auth.users VALUES($1)", [id]);
  await db.query("INSERT INTO kq_equipment_wallets(user_id,reputation) VALUES($1,$2)", [id, reputation]);
  await db.query("INSERT INTO kq_online_accounts(user_id,followers) VALUES($1,$2)", [id, followers]);
  await db.query("INSERT INTO kq_commerce_accounts(user_id,computer_owned,shop_created_at) VALUES($1,$2,CASE WHEN $2 THEN now() ELSE NULL END)", [id, active]);
  return { id, view: await emptySocial(id) };
}
async function freshForNextChoice(id) {
  await db.query("UPDATE kq_social_platforms SET next_post_at=NULL WHERE user_id=$1", [id]);
  await db.query("UPDATE kq_social_accounts SET energy=100,energy_updated_at=now() WHERE user_id=$1", [id]);
  return emptySocial(id);
}
const verify = view => { assert(isSnapshot(view), "SQL response must satisfy the complete shared snapshot contract"); return view; };

try {
  const shared = await vite.ssrLoadModule("/src/lib/kanab-quest-social-v1.ts");
  catalog = shared.KQ_SOCIAL_SCENARIOS;
  isSnapshot = shared.isKqSocialSnapshot;
  const fixture = JSON.parse(await readFile("scripts/fixtures/kanab-quest-social-catalog.json", "utf8"));
  assert.deepEqual(catalog, fixture, "gameplay catalog and SQL seed fixture stay synchronized");
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY);
    CREATE TABLE public.kq_equipment_wallets(user_id UUID PRIMARY KEY REFERENCES auth.users(id),reputation INTEGER DEFAULT 0);
    CREATE TABLE public.kq_online_accounts(user_id UUID PRIMARY KEY REFERENCES auth.users(id),followers INTEGER DEFAULT 0 CHECK(followers BETWEEN 0 AND 100000),revision INTEGER DEFAULT 0,site_tier TEXT DEFAULT 'basic');
    CREATE TABLE public.kq_commerce_accounts(user_id UUID PRIMARY KEY REFERENCES auth.users(id),computer_owned BOOLEAN DEFAULT false,
      shop_created_at TIMESTAMPTZ,shop_suspended BOOLEAN DEFAULT false,shop_paid_until TIMESTAMPTZ);
    CREATE TABLE public.test_settlement_observations(user_id UUID,followers INTEGER);
    -- The existing economic engine is an explicit fixture boundary. Record the
    -- follower count it receives, so retroactive follower boosts fail this test.
    CREATE FUNCTION public.kq_business_settle(p_user UUID) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
    BEGIN
      INSERT INTO public.kq_online_accounts(user_id) VALUES(p_user) ON CONFLICT DO NOTHING;
      INSERT INTO public.kq_commerce_accounts(user_id) VALUES(p_user) ON CONFLICT DO NOTHING;
      INSERT INTO public.test_settlement_observations SELECT p_user,followers FROM public.kq_online_accounts WHERE user_id=p_user;
    END $$;
  `);
  await db.exec(await readFile("supabase/migrations/20261022000100_kq_social_adventure.sql", "utf8"));
  assert.deepEqual((await row("SELECT public.kq_social_catalog() AS data")).data, fixture, "deployed SQL literal matches all 36 choices and narratives");
  for (const platform of ["instagram", "x"]) for (let chapter = 0; chapter < 12; chapter++) {
    assert.deepEqual((await row("SELECT public.kq_social_scenario($1,$2) AS data", [platform, chapter])).data,
      platformStories(platform)[chapter % 6], "chapter rotation matches the client over repeated adventures");
  }
  await assert.rejects(social(randomUUID()), /social_profile/);

  const first = await player({ followers: 80, reputation: 600, active: true });
  assert.equal(first.view.socialFollowers, 0);
  assert.equal(first.view.audienceFollowers, 80, "existing marketing followers are not claimed as social followers");
  assert.equal(first.view.additionalVisitsPerDay, 0);
  assert.equal(first.view.energy, 100); assert.equal(first.view.siteActive, true); verify(first.view);
  const firstCommand = choose(first.view);
  const spec = platformStories("instagram")[0].choices[0].effects;
  const posted = verify(await social(first.id, firstCommand));
  assert.equal(posted.platforms.instagram.followers, Math.max(0, spec.followers));
  assert.equal(posted.audienceFollowers, 80 + posted.socialFollowers);
  assert.equal(posted.energy, 100 + spec.energy);
  assert.equal(posted.revision, 1);
  assert.equal(posted.history[0].followersDelta, posted.socialFollowers);
  assert.equal(posted.additionalVisitsPerDay, Math.round(posted.socialFollowers * .12 * 1.1 * 1e6) / 1e6);
  assert.equal((await row("SELECT max(followers) AS maximum FROM test_settlement_observations WHERE user_id=$1", [first.id])).maximum, 80,
    "commerce is settled before newly gained followers can affect demand");
  const replay = verify(await social(first.id, firstCommand));
  assert.equal(replay.replayed, true); assert.equal(replay.revision, 1); assert.equal(replay.history.length, 1);
  assert.equal(replay.audienceFollowers, posted.audienceFollowers);
  await assert.rejects(social(first.id, { ...firstCommand, choiceId: "another-choice" }), /social_request_mismatch/);
  await assert.rejects(social(first.id, { ...choose(posted, "x"), expectedRevision: 0 }), /social_changed/);
  await assert.rejects(social(first.id, choose(posted)), /social_cooldown/);
  await assert.rejects(social(first.id, { ...choose(posted), scenarioId: "invented" }), /social_changed/);
  await assert.rejects(social(first.id, { ...choose(posted), choiceId: "invented" }), /social_invalid/);
  for (const extra of [{ followers: 10000 }, { userId: randomUUID() }, { energy: 100 }]) {
    await assert.rejects(social(first.id, { ...choose(posted), ...extra }), /social_invalid/);
  }
  for (const invalid of [{ action: "recover", requestKey: randomUUID(), expectedRevision: -1 },
    { action: "recover", requestKey: randomUUID(), expectedRevision: "1" },
    { action: "recover", requestKey: randomUUID(), expectedRevision: 1.5 },
    { action: "recover", requestKey: "not-a-key", expectedRevision: 1 }]) await assert.rejects(social(first.id, invalid), /social_invalid/);

  // Every choice executes, with gain amplification, loss flooring, moderation,
  // hater strain, and receipts checked against independent arithmetic.
  for (const platform of ["instagram", "x"]) for (let chapter = 0; chapter < 6; chapter++) for (let option = 0; option < 3; option++) {
    const p = await player({ followers: 700 });
    await db.query("UPDATE kq_social_platforms SET followers=500,haters=45,moderation=3,chapter=$3 WHERE user_id=$1 AND platform=$2", [p.id, platform, chapter]);
    const before = await emptySocial(p.id);
    const choice = platformStories(platform)[chapter].choices[option];
    const effects = choice.effects;
    const delta = effects.followers > 0 ? Math.floor(effects.followers * 3 / (platform === "instagram" ? 2 : 1)) : effects.followers;
    const after = verify(await social(p.id, choose(before, platform, option)));
    const history = after.history[0];
    assert.equal(history.followersDelta, delta, `${platform}/${chapter}/${option} follower consequence`);
    assert.equal(history.hatersDelta, Math.max(0, Math.min(100, 45 + effects.haters)) - 45);
    assert.equal(history.moderationDelta, Math.max(0, Math.min(5, 3 + effects.moderation)) - 3);
    assert.equal(history.energyDelta, Math.min(0, effects.energy - (platform === "x" ? 5 : 0)));
    assert.equal(after.audienceFollowers, 700 + delta);
    assert.equal(after.platforms[platform].chapter, chapter + 1);
    assert.equal(history.outcome, choice.outcome);
  }

  const low = await player({ followers: 100 });
  await db.query("UPDATE kq_social_accounts SET energy=0 WHERE user_id=$1", [low.id]);
  await assert.rejects(social(low.id, choose(low.view, "x")), /social_energy/);
  let lowView = await emptySocial(low.id);
  assert.equal(lowView.revision, 0); assert.equal(lowView.history.length, 0); assert.equal(lowView.audienceFollowers, 100);
  const recovery = recover(lowView);
  lowView = verify(await social(low.id, recovery));
  assert.equal(lowView.energy, 30); assert.equal(lowView.history[0].energyDelta, 30); assert.equal(lowView.history[0].platform, null);
  assert.equal(Date.parse(lowView.recoverReadyAt) - Date.parse(lowView.serverNow), 4 * 3600000);
  assert.equal((await social(low.id, recovery)).energy, 30, "replaying a pause cannot restore twice");
  await assert.rejects(social(low.id, recover(lowView)), /social_recover_cooldown/);
  const rested = await player(); await assert.rejects(social(rested.id, recover(rested.view)), /social_energy_full/);
  await db.query("UPDATE kq_social_accounts SET energy=10,energy_updated_at=now()-interval '7 minutes' WHERE user_id=$1", [low.id]);
  const ticking = verify(await emptySocial(low.id)); assert.equal(ticking.energy, 11);
  const tickingAgain = await emptySocial(low.id); assert.equal(tickingAgain.energy, 11); assert.equal(tickingAgain.energyUpdatedAt, ticking.energyUpdatedAt);
  assert.equal(tickingAgain.revision, lowView.revision, "passive recovery does not invalidate an otherwise identical choice");
  await db.query("UPDATE kq_social_accounts SET energy=90,energy_updated_at=now()-interval '2 days' WHERE user_id=$1", [low.id]);
  const cappedEnergy = await emptySocial(low.id); assert.equal(cappedEnergy.energy, 100);
  assert(Date.parse(cappedEnergy.serverNow) - Date.parse(cappedEnergy.energyUpdatedAt) < 1000, "energy cannot accumulate beyond its cap");

  const capped = await player({ followers: 99995 });
  await db.query("UPDATE kq_social_platforms SET followers=49998 WHERE user_id=$1 AND platform='instagram'", [capped.id]);
  const capPost = verify(await social(capped.id, choose(await emptySocial(capped.id))));
  assert.equal(capPost.platforms.instagram.followers, 50000); assert.equal(capPost.history[0].followersDelta, 2);
  assert.equal(capPost.audienceFollowers, 99997); assert.equal(capPost.additionalVisitsPerDay, 0, "existing audience cap is respected");
  const almostTotal = await player({ followers: 99999 });
  const totalPost = verify(await social(almostTotal.id, choose(almostTotal.view)));
  assert.equal(totalPost.audienceFollowers, 100000); assert.equal(totalPost.socialFollowers, 1); assert.equal(totalPost.history[0].followersDelta, 1);
  const losses = await player({ followers: 81 });
  const losingStory = platformStories("instagram").findIndex(story => story.choices.some(choice => choice.effects.followers < 0));
  const losingChoice = platformStories("instagram")[losingStory].choices.findIndex(choice => choice.effects.followers < 0);
  await db.query("UPDATE kq_social_platforms SET followers=1,chapter=$2 WHERE user_id=$1 AND platform='instagram'", [losses.id, losingStory]);
  const loss = verify(await social(losses.id, choose(await emptySocial(losses.id), "instagram", losingChoice)));
  assert.equal(loss.socialFollowers, 0); assert.equal(loss.audienceFollowers, 80, "a bad post never removes followers earned by marketing");
  assert.equal(loss.history[0].followersDelta, -1, "receipts show actual bounded losses");

  const multi = await player();
  const competing = await Promise.allSettled([social(multi.id, choose(multi.view)), social(multi.id, choose(multi.view, "x"))]);
  assert.equal(competing.filter(result => result.status === "fulfilled").length, 1);
  assert.equal((await emptySocial(multi.id)).revision, 1, "two stale browser tabs cannot apply two commands at one revision");

  const historyOwner = await player(); let historyView = historyOwner.view; let oldestCommand;
  for (let i = 0; i < 23; i++) {
    historyView = await freshForNextChoice(historyOwner.id);
    const cmd = choose(historyView); if (i === 0) oldestCommand = cmd;
    historyView = verify(await social(historyOwner.id, cmd));
  }
  assert.equal(historyView.history.length, 20);
  const oldReplay = verify(await social(historyOwner.id, oldestCommand));
  assert.equal(oldReplay.revision, 23); assert.equal(oldReplay.replayed, true); assert.equal(oldReplay.history.length, 20);
  assert.equal((await row("SELECT count(*)::int AS count FROM kq_social_requests WHERE user_id=$1", [historyOwner.id])).count, 23,
    "bounded public history retains durable idempotency receipts");

  // Data API roles have no table access, including service_role. Only the named
  // RPC is executable; its SECURITY DEFINER owner owns all internal operations.
  for (const role of ["anon", "authenticated", "service_role"]) {
    for (const table of ["kq_social_accounts", "kq_social_platforms", "kq_social_requests"]) {
      for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"]) assert.equal((await row("SELECT has_table_privilege($1,$2,$3) AS allowed", [role, `public.${table}`, privilege])).allowed, false);
    }
    assert.equal((await row("SELECT has_function_privilege($1,'public.rpc_kq_social(uuid,jsonb)','EXECUTE') AS allowed", [role])).allowed, role === "service_role");
    for (const helper of ["public.kq_social_catalog()", "public.kq_social_scenario(text,integer)", "public.kq_social_snapshot(uuid,boolean)"]) {
      assert.equal((await row("SELECT has_function_privilege($1,$2,'EXECUTE') AS allowed", [role, helper])).allowed, false);
    }
  }
  await db.exec("SET ROLE service_role"); verify(await emptySocial(first.id)); await db.exec("RESET ROLE");
  console.log("Social SQL checks passed: all choices, audience integration, request replay, conflicts, energy, limits, history and private Data API grants.");
} catch (error) {
  console.error(error.message, error.where ?? error.stack);
  process.exitCode = 1;
} finally { await vite.close(); await db.close(); }
