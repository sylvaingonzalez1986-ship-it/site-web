// Invoked by test-placard-postharvest.mjs after the complete production SQL
// chain. PGlite is isolated; no credentials or deployed database are used.
import { randomUUID } from "node:crypto";

export async function climateBillingChecks({ db, scalar, equal, reject, player, layout, warehouse, catalog, legacyOwner, legacyWarehouse, legacyStart, harvest }) {
  const now = new Date(await scalar("SELECT now()")), hour = 3600000;
  const at = hoursAgo => new Date(now.getTime() - hoursAgo * hour).toISOString();
  const cash = owner => scalar("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [owner]);
  const billing = owner => scalar("SELECT kq_storage_climate_snapshot($1)", [owner]);
  const debt = owner => scalar("SELECT COALESCE(sum(remaining_cents),0)::integer FROM kq_storage_climate_invoices WHERE user_id=$1", [owner]);
  const rewind = (owner, hoursAgo = 120) => db.query("UPDATE kq_storage_climate_accounts SET period_started_at=$2,next_billing_at=$2::timestamptz+interval '120 hours',settled_at=$2,accrued_cents=0 WHERE user_id=$1", [owner, at(hoursAgo)]);
  const settle = (owner, until = now.toISOString()) => scalar("SELECT kq_storage_climate_settle_until($1,$2)", [owner, until]);
  const make = async (code = "SIM-STORAGE-CLIMATE-01", area = 1) => {
    const owner = await player(), original = await layout(owner);
    const draft = { ...original.state, storageClimateCode: code, serviceZones: original.state.serviceZones.map(z => z.kind === "storage" ? { ...z, width: area, height: 1 } : z) };
    const quote = warehouse.getKqWarehouseQuote(draft, original.state);
    const saved = await scalar("SELECT rpc_kq_warehouse_save($1,$2,$3,$4,$5,$6,$7)", [owner, randomUUID(), { expectedCostCents: quote.totalCostCents }, original.revision, original.state, quote.nextState, quote.totalCostCents]);
    return { owner, saved };
  };

  for (const [code, price] of Object.entries({ "SJ-DRYIT90": 14900, "SIM-DRYING-02": 69900, "SIM-DRYING-03": 249900, "LP-SUPER-1L": 2990, "BROR-JARS-48": 64900, "CURTEC-60L": 89900, "SIM-STORAGE-CLIMATE-01": 49900, "SIM-STORAGE-CLIMATE-02": 179900, "SIM-STORAGE-CLIMATE-03": 499900 })) {
    equal((await scalar("SELECT kq_warehouse_device($1)", [code])).priceCents, price, `${code} new price is authoritative in SQL`);
    equal(catalog.getKqWarehouseDevice(code).priceCents, price, `${code} advertised price agrees`);
  }
  const simple = await make(), enabled = await billing(simple.owner);
  equal([enabled.areaM2, enabled.monthlyKwh, enabled.monthlyCostCents], [1, 6, 150], "one equipped storage square metre costs 1.50 EUR per game month");
  equal(new Date(enabled.nextBillingAt) - new Date(enabled.periodStartedAt), 120 * hour, "first bill is due 120 real hours after activation");
  equal(Number(await scalar("SELECT count(*) FROM kq_runs WHERE user_id=$1", [simple.owner])), 0, "monthly consumption exists without a culture");
  const inactive = { ...simple.saved.state, zones: simple.saved.state.zones.map(z => ({ ...z, active: false })) };
  equal((await scalar("SELECT kq_storage_climate_quote($1)", [inactive])).monthlyCostCents, 150, "turning off every culture does not turn off storage climate");
  const reserve = { ...simple.saved.state }; delete reserve.storageClimateCode;
  equal((await scalar("SELECT kq_storage_climate_quote($1)", [reserve])).monthlyCostCents, 0, "owned reserve equipment consumes nothing");
  for (const [code, kwh, cents] of [["SIM-STORAGE-CLIMATE-01", 6, 150], ["SIM-STORAGE-CLIMATE-02", 12, 300], ["SIM-STORAGE-CLIMATE-03", 24, 600]]) {
    const state = { ...simple.saved.state, storageClimateCode: code, serviceZones: simple.saved.state.serviceZones.map(z => z.kind === "storage" ? { ...z, width: 7 } : z) };
    const q = await scalar("SELECT kq_storage_climate_quote($1)", [state]);
    equal([q.monthlyKwh, q.monthlyCostCents], [7 * kwh, 7 * cents], `${code} charges actual storage surface at 25 cents per kWh`);
  }
  const before = await cash(simple.owner);
  await rewind(simple.owner); await settle(simple.owner);
  equal(await cash(simple.owner), before - 150, "first full month debits real wallet cash once");
  equal((await billing(simple.owner)).invoices[0].amountCents, 150, "monthly invoice records actual consumption");
  await settle(simple.owner); await settle(simple.owner);
  equal(await cash(simple.owner), before - 150, "repeated settlement never bills the same period twice");
  equal(await debt(simple.owner), 0, "funded monthly invoice leaves no electricity debt");

  const changing = await make(); await rewind(changing.owner);
  const larger = { ...changing.saved.state, serviceZones: changing.saved.state.serviceZones.map(z => z.kind === "storage" ? { ...z, width: 2 } : z) };
  await scalar("SELECT kq_storage_climate_change($1,$2,$3)", [changing.owner, larger, at(60)]);
  equal(Number(await scalar("SELECT accrued_cents FROM kq_storage_climate_accounts WHERE user_id=$1", [changing.owner])), 75, "surface change preserves first half of old rate");
  await settle(changing.owner);
  equal((await billing(changing.owner)).invoices[0].amountCents, 225, "one month charges half at 1 m2 and half at 2 m2");
  const upgrading = await make(); await rewind(upgrading.owner);
  await scalar("SELECT kq_storage_climate_change($1,$2,$3)", [upgrading.owner, { ...upgrading.saved.state, storageClimateCode: "SIM-STORAGE-CLIMATE-03" }, at(60)]);
  await settle(upgrading.owner);
  equal((await billing(upgrading.owner)).invoices[0].amountCents, 375, "tier change charges half at economy and half at premium");
  const stopped = await make(); await rewind(stopped.owner);
  const off = { ...stopped.saved.state }; delete off.storageClimateCode;
  await scalar("SELECT kq_storage_climate_change($1,$2,$3)", [stopped.owner, off, at(60)]);
  await settle(stopped.owner);
  equal((await billing(stopped.owner)).invoices[0].amountCents, 75, "deactivation preserves the consumption already incurred");
  equal(Number(await scalar("SELECT monthly_cents FROM kq_storage_climate_accounts WHERE user_id=$1", [stopped.owner])), 0, "deactivated device adds no new consumption");
  const stoppedDate = await scalar("SELECT next_billing_at FROM kq_storage_climate_accounts WHERE user_id=$1", [stopped.owner]);
  await scalar("SELECT kq_storage_climate_change($1,$2,$3)", [stopped.owner, stopped.saved.state, now.toISOString()]);
  equal(await scalar("SELECT next_billing_at FROM kq_storage_climate_accounts WHERE user_id=$1", [stopped.owner]), stoppedDate, "reactivation cannot reset the monthly deadline");

  const poor = await make("SIM-STORAGE-CLIMATE-03", 3); await rewind(poor.owner);
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=100 WHERE user_id=$1", [poor.owner]);
  await settle(poor.owner);
  equal([await cash(poor.owner), await debt(poor.owner)], [0, 1700], "insufficient funds produce partial payment and durable debt");
  equal((await scalar("SELECT rpc_kq_energy_snapshot($1)", [poor.owner])).outstandingCents, 1700, "electricity panel includes monthly climate debt");
  const business = await scalar("SELECT kq_business_snapshot($1)", [poor.owner]);
  equal(business.storageClimate.outstandingCents, 1700, "business summary exposes the same debt");
  equal(Number(await scalar("SELECT balance_cents FROM kq_treasury_balances WHERE user_id=$1 AND account='energy_payable'", [poor.owner])), -1700, "real treasury payable postings equal monthly climate debt");
  equal(Number(await scalar("SELECT balance_cents FROM kq_treasury_balances WHERE user_id=$1 AND account='expense_energy'", [poor.owner])), 1800, "monthly consumption is booked as electricity expense exactly once");
  equal(await scalar("SELECT strpos(pg_get_functiondef('rpc_kq_treasury_snapshot(uuid,text,integer,integer)'::regprocedure),'FROM public.kq_storage_climate_invoices WHERE user_id=p_user_id')>0"), true, "treasury reconciliation reads monthly debt as well as cycle debt");
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=5000 WHERE user_id=$1", [poor.owner]);
  const key = randomUUID(), paid = await scalar("SELECT rpc_kq_pay_energy($1,$2,1700)", [poor.owner, key]);
  equal(paid.paidCents, 1700, "existing manual electricity action settles monthly climate debt");
  equal(await cash(poor.owner), 3300, "manual monthly payment debits the actual wallet");
  equal((await scalar("SELECT rpc_kq_pay_energy($1,$2,1700)", [poor.owner, key])).replayed, true, "monthly debt payment keeps existing idempotency");
  equal(await debt(poor.owner), 0, "manual monthly payment clears climate debt");

  const sale = await make("SIM-STORAGE-CLIMATE-01", 3); await rewind(sale.owner);
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=0 WHERE user_id=$1", [sale.owner]); await settle(sale.owner);
  const preview = await scalar("SELECT kq_business_sale_preview($1,1000)", [sale.owner]);
  equal(preview.electricityPaidCents, 416, "wholesale preview reserves its normal repayment share for monthly debt");
  const collected = await scalar("SELECT kq_online_collect($1,1000,now())", [sale.owner]);
  equal([collected.electricityPaidCents, await debt(sale.owner)], [404, 46], "online sales repay climate debt from their existing after-tax budget");
  equal(await cash(sale.owner), collected.netPayoutCents, "online debt repayment is not debited twice");

  const frequent = await make(), once = await make();
  for (const entry of [frequent, once]) {
    await rewind(entry.owner, 240);
    await db.query("UPDATE kq_online_accounts SET settled_until=$2 WHERE user_id=$1", [entry.owner, at(240)]);
  }
  const frequentCash = await cash(frequent.owner), onceCash = await cash(once.owner);
  for (let remaining = 228; remaining >= 0; remaining -= 12) await scalar("SELECT kq_online_settle_until($1,$2)", [frequent.owner, at(remaining)]);
  await scalar("SELECT kq_online_settle_until($1,now())", [once.owner]);
  equal([frequentCash - await cash(frequent.owner), onceCash - await cash(once.owner)], [300, 300], "frequent polling and two offline months produce identical real charges");
  equal(Number(await scalar("SELECT count(*) FROM kq_storage_climate_invoices WHERE user_id=$1", [once.owner])), 2, "offline catch-up issues one invoice per complete month");
  const throughWarehouse = await make(); await rewind(throughWarehouse.owner);
  const warehouseCash = await cash(throughWarehouse.owner);
  const opened = await scalar("SELECT rpc_kq_warehouse_snapshot($1)", [throughWarehouse.owner]);
  equal(opened.cashCents, warehouseCash - 150, "opening warehouse settles monthly charges before displaying cash");
  equal(opened.storageClimateBilling.invoices.length, 1, "warehouse GET returns its settled billing summary");

  const legacyBaseline = warehouse.getKqWarehouseRunSnapshot(legacyWarehouse.sourceState, legacyWarehouse.revision, legacyWarehouse.zoneId);
  const expectedCredit = legacyWarehouse.energyCostCents - legacyBaseline.energyCostCents;
  equal((await billing(legacyOwner)).transitionCreditCents, expectedCredit, "migration credits only committed climate cost from an active historical cycle");
  equal(Number(await scalar("SELECT count(*) FROM kq_storage_climate_invoices WHERE user_id=$1", [legacyOwner])), 0, "migration does not bill historical months");
  await scalar("SELECT kq_warehouse_validate_postharvest_run($1)", [legacyWarehouse]);
  await reject(() => scalar("SELECT kq_validate_warehouse_run_start($1,$2,$3)", [legacyOwner, randomUUID(), legacyStart.run.state]), "warehouse_layout_changed");
  equal(warehouse.isKqWarehouseRunSnapshot(legacyWarehouse), true, "historical climate quotes remain valid in TypeScript");
  await scalar("SELECT kq_warehouse_validate_postharvest_run($1)", [legacyBaseline]);
  equal(Number(await scalar("SELECT kq_storage_climate_legacy_credit($1)", [{ warehouse: legacyBaseline }])), 0, "new monthly cultures cannot generate transition credits");
  for (const marker of [0, 1, 3, "2", null]) await reject(() => scalar("SELECT kq_warehouse_validate_postharvest_run($1)", [{ ...legacyBaseline, climateBillingVersion: marker }]), "warehouse_climate_billing_version_invalid");
  await harvest(legacyStart.run.id);
  equal(Number(await scalar("SELECT total_cents FROM kq_energy_invoices WHERE run_id=$1", [legacyStart.run.id])), legacyWarehouse.energyCostCents, "historical cycle finishes with its exact original electricity bill");
  await rewind(legacyOwner);
  await settle(legacyOwner);
  equal((await billing(legacyOwner)).transitionCreditCents, expectedCredit - 450, "legacy transition credit offsets monthly consumption once");
  const creditAfter = (await billing(legacyOwner)).transitionCreditCents;
  await settle(legacyOwner);
  equal((await billing(legacyOwner)).transitionCreditCents, creditAfter, "retry cannot consume or recreate transition credit");

  for (const role of ["anon", "authenticated", "service_role"]) {
    for (const table of ["kq_storage_climate_accounts", "kq_storage_climate_invoices"]) equal(await scalar("SELECT has_table_privilege($1,$2,'SELECT') OR has_table_privilege($1,$2,'INSERT') OR has_table_privilege($1,$2,'UPDATE') OR has_table_privilege($1,$2,'DELETE')", [role, table]), false, `${role} cannot directly access private ${table}`);
    for (const signature of ["kq_storage_climate_settle_until(uuid,timestamptz)", "kq_storage_climate_change(uuid,jsonb,timestamptz)", "kq_storage_climate_collect(uuid,integer,timestamptz,boolean)", "kq_storage_climate_quote(jsonb)", "kq_storage_climate_legacy_credit(jsonb)"]) equal(await scalar("SELECT has_function_privilege($1,$2,'EXECUTE')", [role, signature]), false, `${role} cannot invoke private ${signature}`);
    equal(await scalar("SELECT has_function_privilege($1,'rpc_kq_energy_snapshot(uuid)','EXECUTE')", [role]), role === "service_role", `${role} keeps only the named energy read RPC permission`);
  }
  console.log("Monthly storage climate: authoritative prices, prorated area/tier/stop, wallet/debt/payment/sales, offline timeline, legacy credits and private grants passed.");
}
