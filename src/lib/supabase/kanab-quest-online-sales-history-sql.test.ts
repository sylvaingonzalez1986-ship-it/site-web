import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const id = (value: number) => `10000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const owner = id(1), other = id(2);
const signature = "public.rpc_kq_online_sales_history(uuid,integer,timestamp with time zone,text,uuid)";
const timestamp = "2026-10-28T12:00:00.123456Z";
type Cursor = { soldAt: string; source: "flower" | "merch"; id: string };
type Sale = Cursor & {
  name: string | null; code: string | null; route: string | null; quantity: number;
  formatGrams: number | null; revenueCents: number; netPayoutCents: number;
  feesCents: number; costCents: number | null; satisfaction: number | null;
};
type Page = { version: 1; sales: Sale[]; nextCursor: Cursor | null };
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE public.kq_flowers(id UUID PRIMARY KEY,owner_id UUID NOT NULL,variety_name TEXT NOT NULL);
    CREATE TABLE public.kq_commerce_stock(id UUID PRIMARY KEY,user_id UUID NOT NULL,flower_id UUID NOT NULL,route TEXT NOT NULL);
    CREATE TABLE public.kq_online_listings(id UUID PRIMARY KEY,user_id UUID NOT NULL,stock_id UUID NOT NULL,format_grams INTEGER NOT NULL,packet_price_cents INTEGER NOT NULL);
    CREATE TABLE public.kq_online_sales(id UUID PRIMARY KEY,user_id UUID NOT NULL,listing_id UUID NOT NULL,occurred_at TIMESTAMPTZ NOT NULL,
      payout_cents INTEGER NOT NULL,net_payout_cents INTEGER NOT NULL,fee_cents INTEGER NOT NULL,satisfaction_score NUMERIC NOT NULL);
    CREATE TABLE public.kq_online_merch_sales(id UUID PRIMARY KEY,user_id UUID NOT NULL,code TEXT NOT NULL,occurred_at TIMESTAMPTZ NOT NULL,
      price_cents INTEGER NOT NULL,net_payout_cents INTEGER NOT NULL,fee_cents INTEGER NOT NULL,cost_cents INTEGER NOT NULL);
    CREATE INDEX ON public.kq_online_sales(user_id,occurred_at DESC,id);
    CREATE INDEX ON public.kq_online_merch_sales(user_id,occurred_at DESC,id);
    REVOKE ALL ON public.kq_flowers,public.kq_commerce_stock,public.kq_online_listings,public.kq_online_sales,public.kq_online_merch_sales
      FROM PUBLIC,anon,authenticated,service_role;
  `);
  await db.exec(readFileSync("supabase/migrations/20261028000100_kq_online_sales_history.sql", "utf8"));
}, 30_000);

beforeEach(async () => {
  await db.exec(`
    TRUNCATE public.kq_flowers,public.kq_commerce_stock,public.kq_online_listings,public.kq_online_sales,public.kq_online_merch_sales;
    INSERT INTO public.kq_flowers VALUES('${id(11)}','${owner}','Fleur du joueur'),('${id(12)}','${other}','Fleur privée');
    INSERT INTO public.kq_commerce_stock VALUES('${id(21)}','${owner}','${id(11)}','raw'),('${id(22)}','${other}','${id(12)}','dry-sift');
    INSERT INTO public.kq_online_listings VALUES('${id(31)}','${owner}','${id(21)}',5,9999),('${id(32)}','${other}','${id(22)}',10,8888);
  `);
});
afterAll(async () => { await db?.close(); });

async function page(limit = 50, cursor: Cursor | null = null, user = owner) {
  return (await db.query<{ result: Page }>(
    "SELECT public.rpc_kq_online_sales_history($1,$2,$3,$4,$5) AS result",
    [user, limit, cursor?.soldAt ?? null, cursor?.source ?? null, cursor?.id ?? null],
  )).rows[0].result;
}

async function flowerSale(index: number, at = timestamp, user = owner, listing = id(31)) {
  await db.query("INSERT INTO public.kq_online_sales VALUES($1,$2,$3,$4,1200,0,30,74.65)", [id(index), user, listing, at]);
}
async function merchSale(index: number, at = timestamp, user = owner) {
  await db.query("INSERT INTO public.kq_online_merch_sales VALUES($1,$2,'stickers',$3,1,0,1,80)", [id(index), user, at]);
}

describe("completed online sales history in PostgreSQL", () => {
  it("paginates every retained flower/extract and merch receipt beyond both snapshot limits", async () => {
    await db.query(`INSERT INTO public.kq_online_sales
      SELECT ('10000000-0000-4000-8000-'||lpad(n::TEXT,12,'0'))::UUID,$1,$2,
        $3::TIMESTAMPTZ-n*INTERVAL '2 seconds',1200,1000,30,75 FROM generate_series(1,63) n`, [owner, id(31), timestamp]);
    await db.query(`INSERT INTO public.kq_online_merch_sales
      SELECT ('10000000-0000-4000-8000-'||lpad(n::TEXT,12,'0'))::UUID,$1,'poster',
        $2::TIMESTAMPTZ-(n*2+1)*INTERVAL '1 second',400,350,10,80 FROM generate_series(1,47) n`, [owner, timestamp]);
    const sales: Sale[] = [];
    let cursor: Cursor | null = null;
    for (let request = 0; request < 10; request++) {
      const result = await page(17, cursor);
      expect(result.version).toBe(1);
      expect(result.sales.length).toBeLessThanOrEqual(17);
      sales.push(...result.sales);
      cursor = result.nextCursor;
      if (!cursor) break;
    }
    expect(cursor).toBeNull();
    expect(sales.filter(sale => sale.source === "flower")).toHaveLength(63);
    expect(sales.filter(sale => sale.source === "merch")).toHaveLength(47);
    expect(new Set(sales.map(sale => `${sale.source}:${sale.id}`)).size).toBe(110);
    expect(sales.map(sale => Date.parse(sale.soldAt))).toEqual(sales.map(sale => Date.parse(sale.soldAt)).sort((a, b) => b - a));
  });

  it("continues exact timestamp ties across both streams and their independent UUIDs", async () => {
    await flowerSale(101); await flowerSale(102); await merchSale(101); await merchSale(102);
    const first = await page(1);
    expect(first.sales.map(sale => [sale.source, sale.id])).toEqual([["flower", id(101)]]);
    expect(first.nextCursor?.soldAt).toContain(".123456");
    const second = await page(1, first.nextCursor);
    const third = await page(1, second.nextCursor);
    const last = await page(1, third.nextCursor);
    expect([second, third, last].map(result => [result.sales[0].source, result.sales[0].id])).toEqual([
      ["flower", id(102)], ["merch", id(101)], ["merch", id(102)],
    ]);
    expect(last.nextCursor).toBeNull();
    expect((await page(4)).nextCursor).toBeNull();
  });

  it("does not repeat prior rows when a newer completed receipt arrives between pages", async () => {
    await flowerSale(101, "2026-10-28T10:00:00Z");
    await merchSale(102, "2026-10-28T09:00:00Z");
    const first = await page(1);
    await merchSale(103, "2026-10-28T11:00:00Z");
    const second = await page(1, first.nextCursor);
    expect(first.sales[0].id).toBe(id(101));
    expect(second.sales.map(sale => sale.id)).toEqual([id(102)]);
    expect(second.nextCursor).toBeNull();
    expect((await page()).sales.map(sale => sale.id)).toEqual([id(103), id(101), id(102)]);
  });

  it("isolates ownership through the sale, listing, stock and flower", async () => {
    await flowerSale(101); await merchSale(102);
    await flowerSale(201, timestamp, other, id(32)); await merchSale(202, timestamp, other);
    await flowerSale(301, timestamp, owner, id(32));
    expect((await page()).sales.map(sale => sale.id)).toEqual([id(101), id(102)]);
    expect((await page(50, null, other)).sales.map(sale => sale.id)).toEqual([id(201), id(202)]);
    expect(await page(50, null, id(999))).toEqual({ version: 1, sales: [], nextCursor: null });
    await db.query("UPDATE public.kq_commerce_stock SET user_id=$1 WHERE id=$2", [other, id(21)]);
    expect((await page()).sales.map(sale => sale.id)).toEqual([id(102)]);
    await db.query("UPDATE public.kq_commerce_stock SET user_id=$1 WHERE id=$2", [owner, id(21)]);
    await db.query("UPDATE public.kq_flowers SET owner_id=$1 WHERE id=$2", [other, id(11)]);
    expect((await page()).sales.map(sale => sale.id)).toEqual([id(102)]);
  });

  it("returns recorded amounts including zero net payouts and preserves extract identity", async () => {
    await flowerSale(101); await merchSale(102);
    await db.query("UPDATE public.kq_commerce_stock SET route='dry-sift' WHERE id=$1", [id(21)]);
    await db.query("UPDATE public.kq_online_listings SET packet_price_cents=5555 WHERE id=$1", [id(31)]);
    const result = await page();
    expect(result.sales[0]).toMatchObject({ id: id(101), source: "flower", name: "Fleur du joueur", code: null, route: "dry-sift",
      quantity: 1, formatGrams: 5, revenueCents: 1200, netPayoutCents: 0, feesCents: 30, costCents: null, satisfaction: 74.65 });
    expect(result.sales[1]).toMatchObject({ id: id(102), source: "merch", name: null, code: "stickers", route: null,
      quantity: 1, formatGrams: null, revenueCents: 1, netPayoutCents: 0, feesCents: 1, costCents: 80, satisfaction: null });
  });

  it("rejects invalid limits, missing identity and partial or unknown cursor tuples", async () => {
    for (const args of [[null, 50], [owner, null], [owner, 0], [owner, 101]]) {
      await expect(db.query("SELECT public.rpc_kq_online_sales_history($1,$2)", args)).rejects.toThrow("invalid_online_sales_history_page");
    }
    for (const cursor of [[timestamp, null, null], [null, "flower", id(101)], [timestamp, "unknown", id(101)], ["infinity", "flower", id(101)]]) {
      await expect(db.query("SELECT public.rpc_kq_online_sales_history($1,50,$2,$3,$4)", [owner, ...cursor])).rejects.toThrow("invalid_online_sales_history_cursor");
    }
    expect((await page(100)).sales).toEqual([]);
  });

  it("permits only the service role to execute while all underlying tables stay private", async () => {
    const result = (await db.query<{ service: boolean; anonymous: boolean; authenticated: boolean; secured: boolean; volatility: string }>(`SELECT
      has_function_privilege('service_role',$1,'EXECUTE') AS service,
      has_function_privilege('anon',$1,'EXECUTE') AS anonymous,
      has_function_privilege('authenticated',$1,'EXECUTE') AS authenticated,
      (SELECT prosecdef AND 'search_path=pg_catalog, public'=ANY(proconfig) FROM pg_proc WHERE oid=$1::regprocedure) AS secured,
      (SELECT provolatile::TEXT FROM pg_proc WHERE oid=$1::regprocedure) AS volatility`, [signature])).rows[0];
    expect(result).toEqual({ service: true, anonymous: false, authenticated: false, secured: true, volatility: "s" });
    const privileges = await db.query<{ allowed: boolean }>(`SELECT has_table_privilege(role_name,relation_name,'SELECT,INSERT,UPDATE,DELETE') AS allowed
      FROM unnest(ARRAY['anon','authenticated','service_role']) role_name
      CROSS JOIN unnest(ARRAY['public.kq_flowers','public.kq_commerce_stock','public.kq_online_listings','public.kq_online_sales','public.kq_online_merch_sales']) relation_name`);
    expect(privileges.rows.every(row => row.allowed === false)).toBe(true);
    await flowerSale(101);
    await db.exec("SET ROLE service_role");
    try { expect((await page()).sales).toHaveLength(1); }
    finally { await db.exec("RESET ROLE"); }
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`SET ROLE ${role}`);
      try { await expect(page()).rejects.toThrow("permission denied for function rpc_kq_online_sales_history"); }
      finally { await db.exec("RESET ROLE"); }
    }
  });

  it("runs in a read-only transaction without settling sales or changing any stored row", async () => {
    await flowerSale(101); await merchSale(102);
    const snapshot = async () => (await db.query(`SELECT jsonb_build_object(
      'flowers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.kq_flowers t),
      'stock',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.kq_commerce_stock t),
      'listings',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.kq_online_listings t),
      'sales',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.kq_online_sales t),
      'merch',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.kq_online_merch_sales t)) AS state`)).rows;
    const before = await snapshot();
    await db.exec("BEGIN READ ONLY");
    try { const first = await page(1); await page(1, first.nextCursor); }
    finally { await db.exec("ROLLBACK"); }
    expect(await snapshot()).toEqual(before);
  });
});
