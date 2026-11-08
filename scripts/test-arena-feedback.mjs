// Execute the migration and real pack-opening routine in isolated PostgreSQL.
// PGlite queues statements; Promise.all below covers adjacent delivery/retries,
// while row/advisory locks in the migration protect concurrent production sessions.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id UUID PRIMARY KEY);
    CREATE OR REPLACE FUNCTION pg_catalog.now() RETURNS TIMESTAMPTZ LANGUAGE sql STABLE
      AS $$ SELECT current_setting('test.clock')::TIMESTAMPTZ $$;
    SELECT set_config('test.clock','2026-11-08 12:00:00+00',false);
    CREATE TABLE public.kq_support_booster_entitlements(
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES auth.users,
      source TEXT NOT NULL DEFAULT 'ticket' CONSTRAINT kq_support_booster_entitlements_source_check CHECK(source='ticket'),
      ticket_id UUID UNIQUE, reward_key TEXT UNIQUE, card_count INTEGER NOT NULL DEFAULT 10 CHECK(card_count BETWEEN 1 AND 10),
      status TEXT NOT NULL DEFAULT 'available' CHECK(status IN('available','opened')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), opened_at TIMESTAMPTZ,
      CONSTRAINT kq_support_booster_entitlements_source_shape_check CHECK(
        (source='ticket' AND ticket_id IS NOT NULL AND reward_key IS NULL)
        OR(source<>'ticket' AND ticket_id IS NULL AND reward_key IS NOT NULL)),
      CHECK((status='opened')=(opened_at IS NOT NULL))
    );
    CREATE TYPE public.lottery_card_rarity AS ENUM('common','silver','gold','epic','legendary');
    CREATE TABLE public.lottery_card_collections(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),code TEXT UNIQUE,is_active BOOLEAN DEFAULT true);
    CREATE TABLE public.lottery_card_definitions(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),collection_id UUID REFERENCES lottery_card_collections,
      code TEXT,name TEXT,rarity lottery_card_rarity,card_number INTEGER,image_url TEXT,is_active BOOLEAN DEFAULT true);
    CREATE TABLE public.lottery_card_instances(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID REFERENCES auth.users,
      ticket_id UUID,kq_support_entitlement_id UUID REFERENCES kq_support_booster_entitlements,pack_slot INTEGER CHECK(pack_slot BETWEEN 1 AND 13),
      card_definition_id UUID REFERENCES lottery_card_definitions,UNIQUE(kq_support_entitlement_id,pack_slot));
    CREATE FUNCTION public.lottery_secure_random_int(a INTEGER,b INTEGER) RETURNS INTEGER LANGUAGE sql AS $$ SELECT a $$;
    INSERT INTO public.lottery_card_collections(code) VALUES('BOTTE_DU_CHANVRIER_2026');
    INSERT INTO public.lottery_card_definitions(collection_id,code,name,rarity,card_number)
      SELECT id,'BOTTE-TEST','Test card','common',1 FROM lottery_card_collections;
  `);
  const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
  const user = async () => { const id = randomUUID(); await db.query('INSERT INTO auth.users VALUES($1)', [id]); return id; };
  const clock = time => db.query("SELECT set_config('test.clock',$1,false)", [time]);
  const submit = (userId, options = {}) => scalar('SELECT public.rpc_arena_submit_feedback($1,$2,$3,$4,$5,$6)',
    [userId, options.requestId ?? randomUUID(), options.kind ?? 'bug', options.subject ?? 'Le bouton bloque',
      options.message ?? 'Après mon lancer, le bouton ne répond plus.', options.pagePath === undefined ? '/le-placard' : options.pagePath]);
  const review = (id, options = {}) => scalar('SELECT public.rpc_arena_review_feedback($1,$2,$3,$4,$5,$6)',
    [id, options.status ?? 'reviewing', options.reply ?? 'Merci pour ce signalement.', options.packs ?? 0,
      options.actor ?? 'admin@example.invalid', options.version ?? null]);
  const gifts = userId => scalar("SELECT count(*)::INTEGER FROM kq_support_booster_entitlements WHERE user_id=$1 AND source='arena_feedback'", [userId]);
  const saved = id => scalar('SELECT to_jsonb(f) FROM public.arena_feedback f WHERE id=$1', [id]);

  await db.exec(await readFile('supabase/migrations/20261108001000_arena_feedback.sql', 'utf8'));
  const opening = await readFile('supabase/migrations/20260727000300_kq_pvp_three_card_booster.sql', 'utf8');
  await db.exec(opening.slice(opening.indexOf('CREATE OR REPLACE FUNCTION public.rpc_kq_open_support_booster'),
    opening.indexOf('CREATE OR REPLACE FUNCTION public.rpc_kq_finalize_battle_for_both_players')));

  const alice = await user(), bob = await user(), requestId = randomUUID();
  const first = await submit(alice, { requestId });
  assert.equal(first.replayed, false); assert.equal(first.item.status, 'new');
  assert.equal(first.item.reward_packs, 0); assert.equal(await gifts(alice), 0, 'submission never gives packs');
  const replay = await submit(alice, { requestId });
  assert.equal(replay.replayed, true); assert.equal(replay.item.id, first.item.id);
  assert.equal((await submit(alice)).item.id, first.item.id, 'identical content with a different key is also deduplicated');
  await assert.rejects(submit(alice, { requestId, subject: 'Another message' }), /feedback_request_conflict/);
  await assert.rejects(submit(alice, { subject: 'Another message' }), /feedback_cooldown/);
  const second = await submit(bob, { requestId });
  assert.notEqual(second.item.id, first.item.id, 'idempotency key is scoped to the account');
  assert.equal(second.item.user_id, bob);
  for (const options of [{ subject: 'abc' }, { kind: 'award' }, { message: 'Too short' }, { pagePath: '//external.test' },
    { pagePath: '/page?token=secret' }, { pagePath: '/page#fragment' }, { pagePath: '/page\\other' }]) {
    await assert.rejects(submit(alice, options), /feedback_invalid/);
  }
  for (const options of [{ packs: -1 }, { packs: 6 }, { packs: 1, status: 'new' }, { packs: 1, status: 'declined' }, { status: 'unknown' }]) {
    await assert.rejects(review(first.item.id, options), /feedback_invalid/);
  }
  assert.equal(await gifts(alice), 0, 'invalid reviews cannot grant');
  await assert.rejects(review(randomUUID()), /feedback_not_found/);

  // Optimistic versions reject stale edits before any gift or reply mutation.
  const read = await review(first.item.id);
  await assert.rejects(review(first.item.id, { packs: 2, status: 'planned', version: first.item.updated_at }), /feedback_changed/);
  assert.equal(await gifts(alice), 0);
  assert.equal((await saved(first.item.id)).status, 'reviewing');
  const options = { packs: 3, status: 'planned', version: read.item.updated_at };
  const deliveries = await Promise.all([review(first.item.id, options), review(first.item.id, options)]);
  assert.equal(deliveries.filter(result => result.rewardGranted).length, 1);
  assert.equal(await gifts(alice), 3, 'adjacent/replayed delivery grants exactly once');
  const awarded = deliveries.find(result => result.rewardGranted).item;
  assert.equal(awarded.reward_granted_by, 'admin@example.invalid');
  await assert.rejects(review(first.item.id, { packs: 2 }), /feedback_reward_conflict/);
  assert.equal(await gifts(alice), 3);
  const resolved = await review(first.item.id, { status: 'resolved', reply: 'Corrigé, merci !', version: awarded.updated_at });
  assert.equal(resolved.item.reward_packs, 3, 'saving with no award preserves the original gift');
  assert.equal(resolved.item.reward_granted_at, awarded.reward_granted_at);

  const entitlement = await scalar("SELECT id FROM kq_support_booster_entitlements WHERE user_id=$1 AND source='arena_feedback' ORDER BY reward_key LIMIT 1", [alice]);
  await assert.rejects(scalar('SELECT rpc_kq_open_support_booster($1,$2)', [entitlement, bob]), /Support booster unavailable/);
  const opened = await scalar('SELECT rpc_kq_open_support_booster($1,$2)', [entitlement, alice]);
  assert.equal(opened.cardCount, 10); assert.equal(opened.cards.length, 10, 'gift opens through the unchanged production pack RPC');
  assert.equal(await scalar('SELECT count(*)::INTEGER FROM lottery_card_instances WHERE user_id=$1', [alice]), 10);
  await assert.rejects(scalar('SELECT rpc_kq_open_support_booster($1,$2)', [entitlement, alice]), /Support booster unavailable/);
  assert.equal((await review(first.item.id, { status: 'resolved', reply: 'Corrigé, merci !', packs: 3 })).rewardGranted, false);
  assert.equal(await gifts(alice), 3, 'opening a pack cannot make a replay refill it');
  assert.equal((await submit(alice, { requestId })).item.reward_packs, 3, 'submission retry recovers reviewed state');

  // A late failure after entitlement insertion rolls back the gift and review together.
  const rollbackUser = await user();
  const rollback = await submit(rollbackUser, { subject: 'Rollback proof', pagePath: '/' });
  await db.exec(`CREATE FUNCTION test_fail_review() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.subject='Rollback proof' AND NEW.reward_packs>0 THEN RAISE EXCEPTION 'test_review_failure'; END IF;
    RETURN NEW; END $$;
    CREATE TRIGGER test_fail_review BEFORE UPDATE ON arena_feedback FOR EACH ROW EXECUTE FUNCTION test_fail_review();`);
  await assert.rejects(review(rollback.item.id, { packs: 2 }), /test_review_failure/);
  assert.equal(await gifts(rollbackUser), 0);
  assert.equal((await saved(rollback.item.id)).status, 'new');
  await db.exec('DROP TRIGGER test_fail_review ON arena_feedback; DROP FUNCTION test_fail_review();');

  // Persistent quotas cover multiple processes and still permit a replay at the limit.
  const frequent = await user(); let firstQuota;
  for (let n = 0; n < 5; n++) {
    await clock(`2026-11-08 13:0${n}:00+00`);
    const entry = await submit(frequent, { subject: `Message ${n}` });
    if (n === 0) firstQuota = entry;
  }
  await clock('2026-11-08 13:05:00+00');
  await assert.rejects(submit(frequent, { subject: 'Message 5' }), /feedback_daily_limit/);
  assert.equal((await submit(frequent, { requestId: firstQuota.item.request_id, subject: 'Message 0' })).replayed, true);
  await clock('2026-11-09 13:00:00+00');
  assert.equal((await submit(frequent, { subject: 'Message 5' })).replayed, false, 'exact 24-hour boundary frees one slot');

  for (const source of ['ticket','arena_streak','notebook_badge','season_reward','points_purchase','welcome_pack',
    'pvp_win','notebook_flower','mission','achievement','pioneer_pack','contest_bundle']) {
    await db.query('INSERT INTO kq_support_booster_entitlements(user_id,source,ticket_id,reward_key) VALUES($1,$2,$3,$4)',
      [bob, source, source === 'ticket' ? randomUUID() : null, source === 'ticket' ? null : `legacy:${source}`]);
  }
  for (const role of ['anon', 'authenticated']) {
    for (const permission of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
      assert.equal(await scalar('SELECT has_table_privilege($1,\'public.arena_feedback\',$2)', [role, permission]), false);
    }
    for (const routine of ['rpc_arena_submit_feedback(uuid,uuid,text,text,text,text)', 'rpc_arena_review_feedback(uuid,text,text,integer,text,timestamptz)']) {
      assert.equal(await scalar('SELECT has_function_privilege($1,$2,\'EXECUTE\')', [role, routine]), false);
    }
  }
  assert.equal(await scalar("SELECT has_table_privilege('service_role','arena_feedback','SELECT')"), true);
  for (const permission of ['INSERT', 'UPDATE', 'DELETE']) {
    assert.equal(await scalar('SELECT has_table_privilege(\'service_role\',\'arena_feedback\',$1)', [permission]), false);
  }
  await db.exec('SET ROLE authenticated');
  await assert.rejects(scalar('SELECT count(*) FROM public.arena_feedback'), /permission denied/);
  await assert.rejects(review(first.item.id, { packs: 5 }), /permission denied/);
  await db.exec('RESET ROLE; SET ROLE service_role');
  assert.ok(await scalar('SELECT count(*)::INTEGER FROM public.arena_feedback') > 0);
  await assert.rejects(db.query("UPDATE public.arena_feedback SET status='resolved' WHERE id=$1", [second.item.id]), /permission denied/);
  assert.equal((await review(second.item.id, { status: 'resolved', packs: 1 })).rewardGranted, true, 'service executes the narrow reward RPC');
  await db.exec('RESET ROLE');
  console.log('Arena feedback SQL: submissions, quotas, retries, stale edits, atomic gifts, pack opening and permissions passed.');
} finally { await db.close(); }
