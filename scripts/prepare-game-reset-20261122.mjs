// Input: the JSON result of scripts/sql/game-reset-20261122-inventory.sql in the output directory.
// Prepare the one-off reset locally. The generated transaction ends in ROLLBACK.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const output = 'output/game-reset-20261122';
const read = path => readFile(path, 'utf8');
const json = async path => JSON.parse((await read(path)).replace(/^\uFEFF/, ''));
const base = await json('scripts/lib/game-reset-20261115-scope.json');
const delta = await json('scripts/lib/game-reset-20261122-table-delta.json');
const collections = await json('scripts/lib/game-reset-20261122-mixed.json');
const inventory = (await json(output + '/inventory.json')).rows[0].inventory;
const reset = [...new Set([...delta.orderedResetTables, ...collections.extraResetTables, ...base.deleteOrder])];
const mixed = [...new Set([...base.mixedTables, ...collections.mixedTables])];
const protectedTables = [...base.preserveTables, ...delta.preserveTables, ...delta.optionalPreserveTables.filter(table => inventory.tables.includes(table))]
  .filter(table => !mixed.includes(table) && !reset.includes(table));
const touched = [...reset, ...mixed].sort();
const all = [...touched, ...protectedTables].sort();
assert.deepEqual(all, [...inventory.tables].sort(), 'Every production table must have exactly one disposition');
assert(all.every(name => /^[a-z_0-9]+$/.test(name)));
for (const name of ['orders', 'order_items', 'invoices', 'profiles', 'contest_reviews', 'contest_tester_points',
  'contest_review_scores', 'contest_review_aroma_tags', 'contest_review_terpene_guesses', 'contest_review_votes',
  'kq_arena_tasting_transition_credits', 'kq_pioneer_pack_grants', 'kq_support_points_purchases']) {
  assert(protectedTables.includes(name), 'Protected business or notebook table: ' + name);
}
const keys = { ...Object.fromEntries(base.staleRequestTables.map(table => [table, 'request_key'])), ...delta.retiredRequestKeys, ...collections.extraRequestKeys };
for (const [table, key] of Object.entries(keys)) {
  assert(reset.includes(table) || mixed.includes(table));
  assert(inventory.columns[table].includes(key) && /^[a-z_]+$/.test(key));
  assert(inventory.columns[table].some(column => ['owner_id', 'user_id'].includes(column)));
}
const array = values => `ARRAY[${values.map(value => `'${value}'`).join(',')}]::text[]`;
const restarts = ['kq_equipment_wallets', 'kq_school_tournament_championship'];
const filterCollections = await read('scripts/sql/game-reset-20261122-collections.sql');
const verifyCollections = await read('scripts/sql/game-reset-20261122-collections-verify.sql');
const sql = `BEGIN ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='180s';
LOCK TABLE ${touched.map(table => 'public.'+table).join(',')} IN ACCESS EXCLUSIVE MODE;
SELECT pg_advisory_xact_lock(hashtextextended('game-reset-20261122',0));
DO $preflight$
BEGIN
 IF to_regnamespace('game_reset_20261122') IS NOT NULL THEN RAISE EXCEPTION 'game_reset_already_applied'; END IF;
 IF (SELECT array_agg(relname::text ORDER BY relname::text COLLATE "C") FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('r','p'))
     IS DISTINCT FROM ${array(all)} THEN RAISE EXCEPTION 'game_reset_schema_changed'; END IF;
 IF NOT EXISTS(SELECT FROM pg_attrdef d JOIN pg_attribute a ON d.adrelid=a.attrelid AND d.adnum=a.attnum
   WHERE d.adrelid='public.kq_equipment_wallets'::regclass AND a.attname='cash_cents' AND pg_get_expr(d.adbin,d.adrelid)='200000') THEN
   RAISE EXCEPTION 'game_reset_incorrect_opening_default';
 END IF;
END $preflight$;

CREATE SCHEMA game_reset_20261122 AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA game_reset_20261122 FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE game_reset_20261122.rows(table_name text NOT NULL,row_data jsonb NOT NULL);
CREATE INDEX ON game_reset_20261122.rows(table_name,(row_data->>'id'));
CREATE TABLE game_reset_20261122.meta(id boolean PRIMARY KEY CHECK(id),report jsonb NOT NULL);
CREATE TABLE game_reset_20261122.retired_requests(table_name text NOT NULL,owner_key text NOT NULL,request_key text NOT NULL,
 PRIMARY KEY(table_name,owner_key,request_key));
ALTER TABLE game_reset_20261122.rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_reset_20261122.meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_reset_20261122.retired_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE game_reset_20261122.rows,game_reset_20261122.meta,game_reset_20261122.retired_requests FROM PUBLIC,anon,authenticated,service_role;

CREATE TEMP TABLE reset_protected(table_name text PRIMARY KEY,digest text NOT NULL) ON COMMIT DROP;
CREATE FUNCTION pg_temp.reset_digest(tab text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE result text;
BEGIN
 EXECUTE format('SELECT md5(coalesce(string_agg(d,'''' ORDER BY d),'''')) FROM (SELECT md5(to_jsonb(t)::text) d FROM public.%I t) s',tab) INTO result;
 RETURN result;
END $f$;
CREATE TEMP TABLE reset_triggers ON COMMIT DROP AS
 SELECT tgrelid, tgname, tgenabled FROM pg_trigger WHERE NOT tgisinternal AND
 tgrelid IN (SELECT ('public.'||unnest(${array(reset)}))::regclass);
CREATE TEMP TABLE reset_wallet_owners ON COMMIT DROP AS
 SELECT user_id FROM public.kq_equipment_wallets UNION SELECT user_id FROM public.kq_pioneer_pack_grants;
CREATE TEMP TABLE reset_welcome_owners ON COMMIT DROP AS
 SELECT user_id FROM public.lottery_welcome_pack_claims UNION SELECT user_id FROM reset_wallet_owners;
CREATE TEMP TABLE reset_prior_counts ON COMMIT DROP AS SELECT
 (SELECT count(*) FROM public.arena_chanvrier_profiles) AS characters,
 (SELECT count(*) FROM public.kq_runs) AS runs,
 (SELECT count(*) FROM public.lottery_card_instances) AS cards;
CREATE TEMP TABLE reset_key_columns(table_name text PRIMARY KEY,column_name text NOT NULL) ON COMMIT DROP;
INSERT INTO reset_key_columns VALUES ${Object.entries(keys).map(([table,key]) => `('${table}','${key}')`).join(',')};
DO $archive$
DECLARE tab text; n bigint; archived bigint; item record;
BEGIN
 FOREACH tab IN ARRAY ${array(touched)} LOOP
   EXECUTE format('INSERT INTO game_reset_20261122.rows SELECT %L,to_jsonb(t) FROM public.%I t',tab,tab);
   GET DIAGNOSTICS archived=ROW_COUNT;
   EXECUTE format('SELECT count(*) FROM public.%I',tab) INTO n;
   IF n<>archived THEN RAISE EXCEPTION 'game_reset_archive_incomplete: %',tab; END IF;
 END LOOP;
 FOREACH tab IN ARRAY ${array(protectedTables)} LOOP
   INSERT INTO reset_protected VALUES(tab,pg_temp.reset_digest(tab));
 END LOOP;
 INSERT INTO game_reset_20261122.retired_requests
 SELECT r.table_name,coalesce(r.row_data->>'user_id',r.row_data->>'owner_id'),r.row_data->>k.column_name
 FROM game_reset_20261122.rows r JOIN reset_key_columns k USING(table_name)
 WHERE r.row_data->>k.column_name IS NOT NULL ON CONFLICT DO NOTHING;
 FOR item IN SELECT * FROM reset_triggers WHERE tgenabled<>'D' LOOP
   EXECUTE format('ALTER TABLE %s DISABLE TRIGGER %I',item.tgrelid::regclass,item.tgname);
 END LOOP;
END $archive$;

${filterCollections}

DELETE FROM public.lottery_welcome_pack_claims;
DO $clear$
DECLARE tab text;
BEGIN
 FOREACH tab IN ARRAY ${array(reset)} LOOP EXECUTE format('DELETE FROM public.%I',tab); END LOOP;
END $clear$;
SET CONSTRAINTS ALL IMMEDIATE;
INSERT INTO public.kq_equipment_wallets(user_id,cash_cents)
 SELECT o.user_id,200000+coalesce(p.cash_cents,0) FROM reset_wallet_owners o LEFT JOIN public.kq_pioneer_pack_grants p USING(user_id);
INSERT INTO public.kq_school_tournament_championship(singleton) VALUES(true);
DO $restore$
DECLARE item record;
BEGIN
 FOR item IN SELECT * FROM reset_triggers WHERE tgenabled<>'D' LOOP
   EXECUTE format('ALTER TABLE %s ENABLE %s TRIGGER %I',item.tgrelid::regclass,
      CASE item.tgenabled WHEN 'A' THEN 'ALWAYS' WHEN 'R' THEN 'REPLICA' ELSE '' END,item.tgname);
 END LOOP;
 FOR item IN SELECT user_id FROM reset_welcome_owners LOOP
   IF NOT public.rpc_claim_welcome_pack(item.user_id) THEN RAISE EXCEPTION 'game_reset_welcome_not_created'; END IF;
 END LOOP;
END $restore$;

CREATE FUNCTION game_reset_20261122.reject_retired_request() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $f$
DECLARE row_json jsonb:=to_jsonb(NEW);
BEGIN
 IF EXISTS(SELECT FROM game_reset_20261122.retired_requests WHERE table_name=TG_TABLE_NAME
  AND owner_key=coalesce(row_json->>'user_id',row_json->>'owner_id') AND request_key=row_json->>TG_ARGV[0]) THEN
   RAISE EXCEPTION 'game_reset_command_expired';
 END IF;
 RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION game_reset_20261122.reject_retired_request() FROM PUBLIC,anon,authenticated,service_role;
DO $guards$
DECLARE item record;
BEGIN
 FOR item IN SELECT * FROM reset_key_columns LOOP
   EXECUTE format('CREATE TRIGGER game_reset_20261122_reject_old_command BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION game_reset_20261122.reject_retired_request(%L)',item.table_name,item.column_name);
 END LOOP;
END $guards$;

${verifyCollections}
DO $verify$
DECLARE tab text; item record; n bigint;
BEGIN
 FOR item IN SELECT * FROM reset_protected LOOP
   IF pg_temp.reset_digest(item.table_name) IS DISTINCT FROM item.digest THEN RAISE EXCEPTION 'game_reset_protected_table_changed: %',item.table_name; END IF;
 END LOOP;
 FOREACH tab IN ARRAY ${array(reset.filter(table=>!restarts.includes(table)))} LOOP
   EXECUTE format('SELECT count(*) FROM public.%I',tab) INTO n;
   IF n<>0 THEN RAISE EXCEPTION 'game_reset_remaining_progress: %',tab; END IF;
 END LOOP;
 IF EXISTS(SELECT FROM reset_wallet_owners o FULL JOIN public.kq_equipment_wallets w USING(user_id)
  LEFT JOIN public.kq_pioneer_pack_grants p ON p.user_id=o.user_id WHERE o.user_id IS NULL OR w.user_id IS NULL OR
   w.cash_cents<>200000+coalesce(p.cash_cents,0) OR w.reputation<>0)
 THEN RAISE EXCEPTION 'game_reset_wallet_mismatch'; END IF;
 IF (SELECT count(*) FROM public.kq_school_tournament_championship)<>1 OR EXISTS(SELECT FROM public.kq_school_tournament_championship WHERE user_id IS NOT NULL)
 THEN RAISE EXCEPTION 'game_reset_championship_mismatch'; END IF;
 IF EXISTS(SELECT FROM reset_welcome_owners o FULL JOIN public.lottery_welcome_pack_claims w USING(user_id)
   LEFT JOIN public.lottery_tickets t ON t.id=w.ticket_id WHERE o.user_id IS NULL OR w.user_id IS NULL OR t.status IS DISTINCT FROM 'available' OR w.opening_result IS NOT NULL)
 THEN RAISE EXCEPTION 'game_reset_welcome_mismatch'; END IF;
 IF EXISTS(SELECT FROM reset_triggers old LEFT JOIN pg_trigger t USING(tgrelid,tgname) WHERE old.tgenabled IS DISTINCT FROM t.tgenabled)
 THEN RAISE EXCEPTION 'game_reset_trigger_mismatch'; END IF;
 IF EXISTS(SELECT FROM unnest(ARRAY['anon','authenticated','service_role']) role WHERE has_schema_privilege(role,'game_reset_20261122','USAGE') OR has_table_privilege(role,'game_reset_20261122.rows','SELECT'))
 THEN RAISE EXCEPTION 'game_reset_archive_exposed'; END IF;
 INSERT INTO game_reset_20261122.meta VALUES(true,jsonb_build_object(
  'resetId','game-reset-20261122','resetAt',clock_timestamp(),'startingCashCents',200000,
  'charactersReset',(SELECT characters FROM reset_prior_counts),'charactersAfter',(SELECT count(*) FROM public.arena_chanvrier_profiles),
  'runsReset',(SELECT runs FROM reset_prior_counts),'wallets',(SELECT count(*) FROM public.kq_equipment_wallets),
  'pioneers',(SELECT count(*) FROM public.kq_pioneer_pack_grants),'pioneerCashCents',(SELECT sum(cash_cents) FROM public.kq_pioneer_pack_grants),
  'cardsBefore',(SELECT cards FROM reset_prior_counts),'cardsAfter',(SELECT count(*) FROM public.lottery_card_instances),
  'paidCards',(SELECT count(*) FROM reset_paid_cards),'paidBoosters',(SELECT count(*) FROM reset_paid_boosters),
  'paidTickets',(SELECT count(*) FROM reset_paid_tickets),'keptHeritages',(SELECT count(*) FROM reset_kept_heritages),
  'welcomePacks',(SELECT count(*) FROM public.lottery_welcome_pack_claims),'reviews',(SELECT count(*) FROM public.contest_reviews),
  'notebookPointRows',(SELECT count(*) FROM public.contest_tester_points),'notebookPoints',(SELECT coalesce(sum(points),0) FROM public.contest_tester_points),
  'protectedTables',(SELECT count(*) FROM reset_protected),'archivedRows',(SELECT count(*) FROM game_reset_20261122.rows),'retiredCommands',(SELECT count(*) FROM game_reset_20261122.retired_requests)));
END $verify$;
SELECT report FROM game_reset_20261122.meta;
ROLLBACK;
`;
await mkdir(output,{recursive:true});
await writeFile(output + '/reset.sql',sql);
console.log(`Prepared rollback SQL for ${reset.length} progression, ${mixed.length} mixed and ${protectedTables.length} protected tables.`);
