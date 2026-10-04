// Isolated PostgreSQL checks; this never connects to the deployed database.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const modulePath = process.argv[2] ?? "output/reputation-test-tools/node_modules/@electric-sql/pglite/dist/index.js";
const { PGlite } = await import(pathToFileURL(resolve(modulePath)).href);
const db = new PGlite();
const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE TABLE public.producers(id TEXT PRIMARY KEY, name TEXT);
    CREATE TABLE public.products(id TEXT PRIMARY KEY, producer_id TEXT REFERENCES public.producers ON DELETE SET NULL,weight_grams NUMERIC,variant_options JSONB);
    CREATE TABLE public.order_items(id BIGSERIAL PRIMARY KEY, product_id TEXT,unit_weight_grams NUMERIC);
    INSERT INTO public.producers VALUES('supplier','Producteur historique');
    INSERT INTO public.products VALUES('flower','supplier',1,'[{"id":"5g","label":"5g"},{"id":"10g","label":"10 g"},{"id":"fraction","label":"2,5 g"},{"id":"ambiguous","label":"Lot 5g + cadeau"}]'),('own',NULL,1,NULL);
    INSERT INTO public.order_items(product_id) VALUES('flower'),('flower::5g'),('own'),('deleted');
    CREATE TABLE public.reward_trigger_calls(id BIGSERIAL PRIMARY KEY);
    CREATE FUNCTION public.test_reward_trigger() RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN INSERT INTO public.reward_trigger_calls DEFAULT VALUES; RETURN NULL; END;
    $$;
    CREATE CONSTRAINT TRIGGER kq_contest_bundle_after_items AFTER INSERT OR UPDATE ON public.order_items
      DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.test_reward_trigger();
  `);
  await db.exec(await readFile(resolve("supabase/migrations/20261003000300_producer_settlements.sql"), "utf8"));
  assert.equal(Number(await scalar("SELECT count(*) FROM public.reward_trigger_calls")), 0, "Accounting backfill must not grant game rewards");
  assert.equal(await scalar("SELECT tgenabled FROM pg_trigger WHERE tgname='kq_contest_bundle_after_items'"), "O");
  assert.deepEqual((await db.query("SELECT producer_attribution FROM public.order_items ORDER BY id")).rows.map(row => row.producer_attribution),
    ["producer", "producer", "own", "unknown"]);
  assert.equal(Number(await scalar("SELECT producer_unit_weight_grams FROM public.order_items WHERE id=2")), 5);
  await db.exec("INSERT INTO public.order_items(product_id,producer_id_snapshot,producer_name_snapshot,producer_attribution,unit_weight_grams) VALUES('flower::10g','forged','Forged','producer',1)");
  assert.equal(Number(await scalar("SELECT count(*) FROM public.reward_trigger_calls")), 1, "Normal orders must retain the reward trigger");
  assert.equal(await scalar("SELECT producer_id_snapshot FROM public.order_items WHERE id=5"), "supplier");
  assert.equal(Number(await scalar("SELECT producer_unit_weight_grams FROM public.order_items WHERE id=5")), 10);
  assert.equal(Number(await scalar("SELECT public.resolve_producer_settlement_weight('flower::fraction',1)")), 2.5);
  assert.equal(await scalar("SELECT public.resolve_producer_settlement_weight('flower::ambiguous',1)"), null);
  assert.equal(Number(await scalar("SELECT public.resolve_producer_settlement_weight('flower',3)")), 3);
  assert.equal(Number(await scalar("SELECT public.resolve_producer_settlement_weight('deleted',4)")), 4);
  await db.exec("UPDATE public.producers SET name='Nouveau nom'; DELETE FROM public.products WHERE id='flower'; DELETE FROM public.producers WHERE id='supplier'");
  assert.equal(await scalar("SELECT producer_name_snapshot FROM public.order_items WHERE id=5"), "Producteur historique");
  await db.exec("INSERT INTO public.order_items(product_id) VALUES('flower')");
  assert.equal(await scalar("SELECT producer_attribution FROM public.order_items WHERE id=6"), "unknown");

  for (const role of ["anon", "authenticated"]) {
    for (const table of ["producer_settlement_rates", "producer_settlement_payments"]) {
      for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
        assert.equal(await scalar("SELECT has_table_privilege($1,$2,$3)", [role, table, privilege]), false);
      }
    }
  }
  assert.equal(await scalar("SELECT has_column_privilege('service_role','producer_settlement_payments','voided_at','UPDATE')"), true);
  assert.equal(await scalar("SELECT has_column_privilege('service_role','producer_settlement_payments','amount_cents','UPDATE')"), false);
  assert.equal(await scalar("SELECT has_table_privilege('service_role','producer_settlement_payments','DELETE')"), false);

  await db.exec("SET ROLE service_role");
  await db.exec(`INSERT INTO public.producer_settlement_rates(producer_id,product_id,effective_month,mode,rate)
    VALUES('supplier','flower','2026-09-01','percent_ht',80)`);
  await assert.rejects(db.exec("INSERT INTO public.producer_settlement_rates VALUES('supplier','flower','2026-10-02','unit',2,NULL,now())"));
  await assert.rejects(db.exec("INSERT INTO public.producer_settlement_rates VALUES('supplier','flower','2026-10-01','gram',2,NULL,now())"));
  await assert.rejects(db.exec("INSERT INTO public.producer_settlement_rates VALUES('supplier','flower','2026-10-01','percent_ht',101,NULL,now())"));
  await db.exec("UPDATE public.producer_settlement_rates SET rate=75 WHERE producer_id='supplier'");
  const id = "11111111-1111-4111-8111-111111111111";
  await db.query(`INSERT INTO public.producer_settlement_payments(id,producer_id,producer_name,sales_from_month,sales_month,amount_cents,paid_on,reference,note)
    VALUES($1,'supplier','Producteur historique','2026-08-01','2026-09-01',12500,'2026-10-03','VIR-1','Août et septembre')`, [id]);
  await assert.rejects(db.query(`INSERT INTO public.producer_settlement_payments(id,producer_id,producer_name,sales_from_month,sales_month,amount_cents,paid_on)
    VALUES($1,'supplier','Producteur historique','2026-08-01','2026-09-01',12500,'2026-10-03')`, [id]));
  await assert.rejects(db.exec(`INSERT INTO public.producer_settlement_payments(id,producer_id,producer_name,sales_from_month,sales_month,amount_cents,paid_on)
    VALUES('22222222-2222-4222-8222-222222222222','supplier','Producteur historique','2026-10-01','2026-09-01',100,'2026-10-03')`));
  await assert.rejects(db.exec("UPDATE public.producer_settlement_payments SET amount_cents=1"));
  await assert.rejects(db.exec("UPDATE public.producer_settlement_payments SET voided_at=now(),void_reason=NULL"));
  await db.exec("UPDATE public.producer_settlement_payments SET voided_at=now(),void_reason='Erreur de saisie'");
  await assert.rejects(db.exec("UPDATE public.producer_settlement_payments SET voided_at=NULL,void_reason=NULL"));
  await assert.rejects(db.exec("UPDATE public.producer_settlement_payments SET void_reason='Autre motif'"));
  assert.equal(await scalar("SELECT amount_cents FROM public.producer_settlement_payments"), 12500);
  await db.exec("RESET ROLE");
  await assert.rejects(db.exec("UPDATE public.producer_settlement_payments SET amount_cents=1"));
  console.log("Producer settlements: snapshots, historical retention, private grants, rate constraints and immutable payment audit passed.");
} finally {
  await db.close();
}
