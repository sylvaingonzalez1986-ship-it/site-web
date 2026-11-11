// Actual backend functions and migration RPCs against an in-memory SQL adapter.
// All identities/orders are fictional; no live Data API or network.
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), deleteUser: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: () => ({
  from: mocks.from, rpc: mocks.rpc, auth: { admin: { deleteUser: mocks.deleteUser } },
}) }));
vi.mock("@/lib/mission-proof-storage", () => ({
  listMissionProofPathsForUser: async () => [], deleteMissionProof: vi.fn(),
}));
import { listCustomerOrdersForLoyaltyInSupabase } from "@/lib/supabase/order-backend";
import { deleteCustomerAccount } from "@/lib/customer-account-deletion";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
let db: PGlite;

function queryFor(table: string, rpc?: { name: string; parameters: Record<string, string> }) {
  const args: unknown[] = [];
  const predicates: string[] = [];
  let patch: Record<string, unknown> | undefined;
  const ident = (name: string) => { if (!/^[a-z_]+$/.test(name)) throw new Error("Invalid fixture identifier"); return `"${name}"`; };
  const bind = (value: unknown) => { args.push(value); return `$${args.length}`; };
  const query = {
    select: () => query,
    order: () => query,
    update: (value: Record<string, unknown>) => { patch = value; return query; },
    delete: () => query,
    eq: (field: string, value: unknown) => { predicates.push(`${ident(field)} = ${bind(value)}`); return query; },
    is: (field: string, value: unknown) => { expect(value).toBeNull(); predicates.push(`${ident(field)} IS NULL`); return query; },
    then: (resolve: (result: { data: unknown; error: null }) => unknown, reject: (error: unknown) => unknown) => {
      if (rpc) {
        const query = rpc.name === "rpc_get_customer_guest_orders"
          ? db.query<Record<string, unknown>>("SELECT * FROM public.rpc_get_customer_guest_orders($1)", [rpc.parameters.p_email])
          : db.query<{ changed: number }>("SELECT public.rpc_anonymize_customer_orders($1,$2) AS changed", [rpc.parameters.p_customer_id, rpc.parameters.p_email]);
        return query.then(result => ({ data: rpc.name === "rpc_get_customer_guest_orders" ? result.rows : result.rows[0].changed, error: null })).then(resolve, reject);
      }
      if (table !== "orders") return Promise.resolve({ data: [], error: null }).then(resolve, reject);
      const where = predicates.length ? ` WHERE ${predicates.join(" AND ")}` : "";
      const sql = patch
        ? `UPDATE orders SET ${Object.entries(patch).map(([key, value]) => `${ident(key)} = ${bind(value)}`).join(", ")}${where} RETURNING *`
        : `SELECT * FROM orders${where}`;
      return db.query(sql, args).then(result => ({ data: result.rows, error: null })).then(resolve, reject);
    },
  };
  return query;
}

describe("legacy order ownership uses exact case-insensitive email", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE TABLE orders (
      id text PRIMARY KEY, customer_id uuid, customer_email text, customer_name text,
      legacy_customer_id text, shipping_address text, shipping_city text, shipping_postal_code text,
      shipping_country text, shipping_phone text, relay_id text, relay_name text, relay_address text,
      relay_postal_code text, relay_city text, relay_country text,
      total_amount numeric DEFAULT 100, created_at timestamptz DEFAULT now(), payment_state text DEFAULT 'paid'
    ); GRANT SELECT,UPDATE ON orders TO service_role;`);
    const migration = await readFile("supabase/migrations/20261110000200_security_data_api_boundaries.sql", "utf8");
    for (const name of ["rpc_get_customer_guest_orders", "rpc_anonymize_customer_orders"]) {
      const definition = migration.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\\$\\$;`));
      expect(definition).not.toBeNull();
      await db.exec(definition![0]);
      for (const acl of migration.matchAll(new RegExp(`^(?:REVOKE|GRANT)[^;]*ON FUNCTION public\\.${name}\\([^;]*;`, "gm"))) {
        await db.exec(acl[0]);
      }
    }
  });
  beforeEach(async () => {
    vi.stubGlobal("fetch", () => { throw new Error("Audit forbids network"); });
    vi.clearAllMocks();
    mocks.from.mockImplementation(queryFor);
    mocks.rpc.mockImplementation((name: string, parameters: Record<string, string>) => name === "rpc_delete_mailing_contact"
      ? Promise.resolve({ data: null, error: null }) : name === "rpc_delete_customer_newsletter_data"
        ? Promise.resolve({ data: false, error: null }) : queryFor("orders", { name, parameters }));
    mocks.deleteUser.mockResolvedValue({ error: null });
    await db.exec("RESET ROLE; TRUNCATE orders");
    await db.query("INSERT INTO orders(id, customer_id, customer_email, customer_name, shipping_address) VALUES ('legacy-b',NULL,'axb@example.invalid','Fixture B','Fixture address B'),('linked-b',$1,'axb@example.invalid','Fixture B','Fixture address B')", [B]);
    await db.exec("SET ROLE service_role");
  });
  afterAll(async () => { vi.unstubAllGlobals(); await db.close(); });

  it("does not include B's legacy order in A's export or loyalty query", async () => {
    const orders = await listCustomerOrdersForLoyaltyInSupabase({ customerId: A, customerEmail: "a_b@example.invalid" });
    expect(orders).toEqual([]);
  });
  it("deleting A leaves both B's unlinked and linked orders intact", async () => {
    const summary = await deleteCustomerAccount({ customerId: A, customerEmail: "a_b@example.invalid" });
    expect(summary.anonymizedOrderCount).toBe(0);
    const result = await db.query<{ id: string; customer_email: string; shipping_address: string | null }>("SELECT id,customer_email,shipping_address FROM orders ORDER BY id");
    expect(result.rows[0]).toEqual({ id: "legacy-b", customer_email: "axb@example.invalid", shipping_address: "Fixture address B" });
    expect(result.rows[1].customer_email).toBe("axb@example.invalid");
    expect(mocks.deleteUser).toHaveBeenCalledWith(A);
  });

  it.each(["a_b", "a%b", "a*b", "a\\b"])("reads and anonymizes only the exact legacy address %s", async (localPart) => {
    const email = `${localPart}@example.invalid`;
    await db.exec("RESET ROLE");
    await db.query(`INSERT INTO orders(id,customer_id,customer_email,shipping_address) VALUES
      ('legacy-a',NULL,$1,'A address'),('linked-a',$2,'old-address@example.invalid','A address'),
      ('linked-b-same-email',$3,$1,'B address')`, [email.toUpperCase(), A, B]);
    await db.exec("SET ROLE service_role");
    const orders = await listCustomerOrdersForLoyaltyInSupabase({ customerId: A, customerEmail: ` ${email} ` });
    expect(orders.map(order => order.id).sort()).toEqual(["legacy-a", "linked-a"]);
    const summary = await deleteCustomerAccount({ customerId: A, customerEmail: ` ${email} ` });
    expect(summary.anonymizedOrderCount).toBe(2);
    const rows = (await db.query<{ id: string; customer_email: string; shipping_address: string | null }>("SELECT id,customer_email,shipping_address FROM orders ORDER BY id")).rows;
    expect(rows.filter(row => row.customer_email === "deleted+11111111@privacy.invalid").map(row => row.id)).toEqual(["legacy-a", "linked-a"]);
    expect(rows.find(row => row.id === "linked-b-same-email")?.shipping_address).toBe("B address");
    expect(rows.find(row => row.id === "legacy-b")?.shipping_address).toBe("Fixture address B");
  });
});
