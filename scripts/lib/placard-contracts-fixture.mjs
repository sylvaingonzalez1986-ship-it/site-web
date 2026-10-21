// Local in-memory PostgreSQL fixture only. Never loads credentials or opens a
// remote database. Production contract, identity and accounting SQL is used;
// unrelated business settlement is an explicitly empty fixture dependency.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const migration = name => readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), "utf8");
const functionSql = (source, name) => {
  const match = source.match(new RegExp(`CREATE(?: OR REPLACE)? FUNCTION public\\.${name}\\([\\s\\S]*?\\$\\$;`));
  assert(match, `Missing production SQL function ${name}`);
  return match[0];
};

export async function createContractFixture({ renewable = false } = {}) {
  const db = new PGlite();
  const scalar = async (sql, params = []) => Object.values((await db.query(sql, params)).rows[0])[0];
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY);
      CREATE TABLE kq_culture_campaigns(id UUID PRIMARY KEY,user_id UUID REFERENCES auth.users,
        leader_run_id UUID,manifest JSONB);
      CREATE TABLE kq_runs(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID NOT NULL REFERENCES auth.users,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','abandoned')),
        state JSONB NOT NULL,campaign_id UUID REFERENCES kq_culture_campaigns,
        started_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),completed_at TIMESTAMPTZ);
      CREATE TABLE kq_flowers(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),run_id UUID NOT NULL UNIQUE REFERENCES kq_runs,
        owner_id UUID NOT NULL REFERENCES auth.users,quality INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'available');
      CREATE TABLE kq_equipment_wallets(user_id UUID PRIMARY KEY REFERENCES auth.users,
        cash_cents INTEGER NOT NULL DEFAULT 100000,updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
      CREATE TABLE contract_fixture_settlements(user_id UUID REFERENCES auth.users);
      CREATE FUNCTION kq_business_settle(p_user UUID) RETURNS VOID LANGUAGE sql AS $$
        INSERT INTO public.contract_fixture_settlements VALUES(p_user);
      $$;
    `);
    // Actual double-entry journal and observer, with only the opening valuation
    // simplified because this fixture has no shop, invoices or equipment.
    const treasury = await migration("20260921000200_kq_treasury_accounting.sql");
    await db.exec(treasury.slice(0, treasury.indexOf("-- Actual production cost only")) + "COMMIT;");
    await db.exec(`CREATE FUNCTION kq_treasury_initialize(p_user UUID) RETURNS VOID LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
      INSERT INTO kq_treasury_accounts(user_id) VALUES(p_user) ON CONFLICT DO NOTHING;
      IF FOUND THEN PERFORM kq_treasury_pair(p_user,'opening','opening',now(),'cash','opening_equity',
        COALESCE((SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=p_user),0),'Opening fixture'); END IF;
    END $$;`);
    await db.exec(functionSql(treasury, "kq_treasury_queue"));
    await db.exec(functionSql(treasury, "kq_treasury_observe"));
    await db.exec("CREATE TRIGGER kq_treasury_wallet AFTER INSERT OR UPDATE OF cash_cents ON kq_equipment_wallets FOR EACH ROW EXECUTE FUNCTION kq_treasury_observe()");
    const campaigns = await migration("20261013000200_kq_shared_campaigns.sql");
    await db.exec(functionSql(campaigns, "kq_campaign_run_identity"));
    await db.exec("CREATE TRIGGER aaa_kq_campaign_identity BEFORE INSERT OR UPDATE ON kq_runs FOR EACH ROW EXECUTE FUNCTION kq_campaign_run_identity()");
    await db.exec(await migration("20261020000100_kq_light_hand_contract.sql"));
    if (renewable) await db.exec(await migration("20261020000200_kq_renewable_contracts.sql"));
    return {
      db, scalar,
      player: async () => {
        const id = randomUUID();
        await db.query("INSERT INTO auth.users VALUES($1)", [id]);
        await db.query("INSERT INTO kq_equipment_wallets(user_id) VALUES($1)", [id]);
        return id;
      },
      snapshot: owner => scalar("SELECT rpc_kq_contract_state($1)", [owner]),
      action: (owner, action, code = "light-hand") => scalar("SELECT rpc_kq_contract_action($1,$2,$3)", [owner, code, action]),
    };
  } catch (error) { await db.close(); throw error; }
}
