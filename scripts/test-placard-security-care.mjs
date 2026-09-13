// Local PostgreSQL fixtures only. No production connection or credentials.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "../output/reputation-test-tools/node_modules/@electric-sql/pglite/dist/index.js";
const db = new PGlite();
const migration = await readFile("supabase/migrations/20260913000700_kq_security_equipment_care.sql", "utf8");
const previous = await readFile("supabase/migrations/20260911000300_kq_cycle_electricity.sql", "utf8");
const player = "00000000-0000-4000-8000-000000000001";
const second = "00000000-0000-4000-8000-000000000002";
const energy = {version:1,mode:"balanced",lines:[],totalWattHours:20100,solarPercent:0,tariffCentsPerKwh:30,totalCents:603,savingsCents:0};
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY);
    CREATE TABLE kq_runs(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID REFERENCES auth.users(id),status TEXT DEFAULT 'active',state JSONB);
    CREATE TABLE kq_equipment_catalog(code TEXT PRIMARY KEY,category TEXT,slot TEXT,price_cents INTEGER,is_purchasable BOOLEAN,is_active BOOLEAN,sort_order INTEGER,metadata JSONB DEFAULT '{}',updated_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE kq_equipment_wallets(user_id UUID PRIMARY KEY REFERENCES auth.users(id),cash_cents INTEGER CHECK(cash_cents>=0),updated_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE kq_player_equipment(user_id UUID REFERENCES auth.users(id),equipment_code TEXT REFERENCES kq_equipment_catalog(code),PRIMARY KEY(user_id,equipment_code));
    CREATE TABLE kq_market_sale_receipts(id UUID PRIMARY KEY);
    CREATE FUNCTION rpc_kq_ensure_equipment_profile(p_user_id UUID) RETURNS VOID LANGUAGE sql AS $$ INSERT INTO kq_equipment_wallets VALUES(p_user_id,35000,now()) ON CONFLICT DO NOTHING $$;
    INSERT INTO auth.users VALUES('${player}'),('${second}');
    INSERT INTO kq_equipment_wallets VALUES('${player}',100000,now()),('${second}',100000,now());
  `);
  await db.exec(previous.slice(previous.indexOf("CREATE TABLE public.kq_energy_invoices"),previous.indexOf("-- The existing sale transaction")));
  await db.exec(migration);
  const start = async (user=player, state={energy,harvestGrams:100}) => (await db.query("INSERT INTO kq_runs(user_id,state) VALUES($1,$2) RETURNING id",[user,JSON.stringify(state)])).rows[0].id;
  const complete = async (id) => db.query("UPDATE kq_runs SET status='completed' WHERE id=$1",[id]);
  const snapshot = async (user=player) => (await db.query("SELECT rpc_kq_energy_snapshot($1) AS data",[user])).rows[0].data;
  const cash = async (user=player) => (await db.query("SELECT cash_cents AS cash FROM kq_equipment_wallets WHERE user_id=$1",[user])).rows[0].cash;
  const beforeAdoption = await start(); await complete(beforeAdoption);
  assert.equal((await snapshot()).dogCare,null);
  assert.equal(await cash(),100000);
  await db.query("INSERT INTO kq_player_equipment VALUES($1,'SECURITY-DOG')",[player]);
  const active = await start();
  await db.query("UPDATE kq_runs SET status='abandoned' WHERE id=$1",[active]);
  assert.equal((await snapshot()).dogCare.completedCycles,0);
  let tenth;
  for(let cycle=1;cycle<=20;cycle++) {
    const before = await snapshot();
    assert.equal(before.dogCare.nextTotalCents,cycle%10===0?4800:800);
    const id=await start(); await complete(id);
    if(cycle===10) tenth=id;
    const receipt=(await db.query("SELECT dog_care,total_cents,remaining_cents FROM kq_energy_invoices WHERE run_id=$1",[id])).rows[0];
    assert.equal(receipt.dog_care.cycle,cycle);
    assert.equal(receipt.dog_care.vetCents,cycle%10===0?4000:0);
    assert.equal(receipt.remaining_cents,603);
    assert.equal(receipt.total_cents,603+receipt.dog_care.totalCents);
    const balance=await cash(); await complete(id); assert.equal(await cash(),balance);
  }
  assert.equal(await cash(),76000);
  assert.equal((await snapshot()).dogCare.completedCycles,20);
  // Even a repeated transition cannot charge twice or advance the care counter.
  await db.query("UPDATE kq_runs SET status='active' WHERE id=$1",[tenth]); await complete(tenth);
  assert.equal(await cash(),76000);
  assert.equal((await snapshot()).dogCare.completedCycles,20);
  // A different player's cycle never advances this dog's calendar.
  const other=await start(second); await complete(other);
  assert.equal((await snapshot(second)).dogCare,null);
  assert.equal((await snapshot()).dogCare.completedCycles,20);
  // Insufficient cash: collect only the available balance, retain the rest as debt.
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=300 WHERE user_id=$1",[player]);
  const low=await start(player,{energy,harvestGrams:100,dogCare:{totalCents:0,cycle:999}}); await complete(low);
  const bill=(await db.query("SELECT * FROM kq_energy_invoices WHERE run_id=$1",[low])).rows[0];
  assert.equal(bill.dog_care.totalCents,800); assert.equal(bill.dog_care.paidCents,300);
  assert.equal(bill.remaining_cents,1103); assert.equal(await cash(),0);
  // Real existing settlement function pays the combined remaining balance exactly once.
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=100000 WHERE user_id=$1",[player]);
  const due=(await snapshot()).outstandingCents;
  const key="00000000-0000-4000-8000-000000000099";
  const pay=async()=> (await db.query("SELECT rpc_kq_pay_energy($1,$2,$3) AS receipt",[player,key,due])).rows[0].receipt;
  assert.equal((await pay()).paidCents,due); const after=await cash();
  assert.equal((await pay()).replayed,true); assert.equal(await cash(),after);
  assert.equal((await snapshot()).outstandingCents,0);
  // Transaction rollback cannot debit care or advance its schedule.
  const count=(await snapshot()).dogCare.completedCycles;
  await db.exec("BEGIN"); const rollback=await start(); await complete(rollback); await db.exec("ROLLBACK");
  assert.equal((await snapshot()).dogCare.completedCycles,count); assert.equal(await cash(),after);
  // Legacy cycles still charge the dog; no fabricated electricity charge.
  const legacy=await start(player,{harvestGrams:100}); await complete(legacy);
  const legacyBill=(await db.query("SELECT total_cents,quote FROM kq_energy_invoices WHERE run_id=$1",[legacy])).rows[0];
  assert.equal(legacyBill.total_cents,800); assert.equal(legacyBill.quote.totalCents,0);
  console.log("Security care PostgreSQL: cycles 10/20, ownership, no double debit, insufficient funds, settlement replay, isolation, rollback and legacy runs passed.");
} finally { await db.close(); }
