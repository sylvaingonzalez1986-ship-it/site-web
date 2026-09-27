// Isolated PostgreSQL only: no credentials, network calls or production writes.
// Optional argument: path to @electric-sql/pglite/dist/index.js.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const modulePath = process.argv[2] || "output/reputation-test-tools/node_modules/@electric-sql/pglite/dist/index.js";
const { PGlite } = await import(pathToFileURL(path.resolve(modulePath)).href);
const db = new PGlite();
const migration = await readFile("supabase/migrations/20260927000100_contest_flower_price_tracks.sql", "utf8");
const checks = [];
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); checks.push(name); };
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
const entry = async (id) => (await rows("SELECT track::text, is_published FROM contest_entries WHERE id=$1", [id]))[0];
const product = async (id, price, weight = 1, options = {}) => db.query(
  "INSERT INTO products(id,category,price,original_price,weight_grams,variant_options,is_pack) VALUES($1,$2,$3,$4,$5,$6,$7)",
  [id, options.category || "fleurs", price, options.originalPrice ?? null, weight, options.variants === undefined ? null : JSON.stringify(options.variants), options.isPack ?? false],
);
const addEntry = async (id, productId, track = "regular", season = "active", published = true) => db.query(
  `INSERT INTO contest_entries(id,slug,title,product_id,producer_id,season_id,track,is_published,category,story,technical_sheet,image_url,gallery_urls,position)
   VALUES($1,$1,$2,$3,'producer-one',$4,$5,$6,'greenhouse','Editorial story preserved','{"drying":"Slow"}','/editorial.jpg','["/gallery.jpg"]',17)`,
  [id, "Editorial " + id, productId, season, track, published],
);
const content = () => rows("SELECT to_jsonb(entry)-'track'-'is_published'-'updated_at' AS content FROM contest_entries entry ORDER BY id");
const history = async () => ({
  reviews: await rows("SELECT * FROM contest_reviews ORDER BY id"),
  scores: await rows("SELECT * FROM contest_review_scores ORDER BY review_id"),
  unlocks: await rows("SELECT * FROM contest_notebook_unlocks ORDER BY entry_id"),
  rewards: await rows("SELECT * FROM reward_receipts ORDER BY id"),
});

try {
  await db.exec(`
    CREATE TYPE contest_entry_track AS ENUM ('regular','concours');
    CREATE TABLE products(id text PRIMARY KEY, category text NOT NULL, price numeric, original_price numeric,
      weight_grams integer, variant_options jsonb, is_pack boolean);
    CREATE TABLE contest_seasons(id text PRIMARY KEY,label text,is_active boolean,is_archived boolean,
      year integer,harvest_end date,created_at timestamptz DEFAULT now());
    CREATE TABLE contest_entries(id text PRIMARY KEY,slug text UNIQUE,title text,product_id text REFERENCES products,
      producer_id text,season_id text REFERENCES contest_seasons,track contest_entry_track NOT NULL,is_published boolean NOT NULL,
      category text,story text,technical_sheet jsonb,image_url text,gallery_urls jsonb,position integer,
      created_at timestamptz DEFAULT '2020-01-01',updated_at timestamptz DEFAULT '2020-01-01');
    CREATE TABLE contest_reviews(id text PRIMARY KEY,entry_id text REFERENCES contest_entries,customer_id text,status text,comment text);
    CREATE TABLE contest_review_scores(review_id text REFERENCES contest_reviews,criterion text,score integer);
    CREATE TABLE contest_notebook_unlocks(entry_id text REFERENCES contest_entries,customer_id text,unlocked_at timestamptz);
    CREATE TABLE reward_receipts(id text PRIMARY KEY,entry_id text REFERENCES contest_entries,payload jsonb);
    INSERT INTO contest_seasons VALUES('active','2026',true,false,2026,NULL,now()),
      ('archived','2025',true,true,2025,NULL,now()),('inactive','2024',false,false,2024,NULL,now());
  `);
  // Use the application's actual requirement query to verify that hidden Mix
  // no longer creates an obligation while its review and rewards remain intact.
  const rewardMigration = await readFile("supabase/migrations/20260925000200_kq_producer_tasting_completion.sql", "utf8");
  for (const functionName of ["kq_current_notebook_season", "kq_producer_notebook_products"]) {
    const definition = rewardMigration.match(new RegExp(`CREATE FUNCTION public\\.${functionName}\\([\\s\\S]*?\\$\\$;`))?.[0];
    assert(definition, "Missing existing requirement function " + functionName);
    await db.exec(definition);
  }

  // Mirror the audited live shape: 18 products, four duplicate Regular entries,
  // White Cbg on the wrong track, and the 1 EUR/g Small Bud Mix with a review.
  for (let index = 1; index <= 12; index += 1) {
    await product(`regular-${index}`, 2.5);
    await addEntry(`regular-entry-${index}`, `regular-${index}`);
  }
  for (const [name, price] of [["cake",4],["strawnana",4],["legendary",4],["shaolin",4.5]]) {
    await product(name, price);
    await addEntry(`${name}-concours`, name, "concours");
    await addEntry(`${name}-regular`, name);
  }
  await product("white-cbg", 4); await addEntry("white-cbg-entry", "white-cbg");
  await product("small-bud-mix", 1); await addEntry("mix-entry", "small-bud-mix");
  await db.exec(`
    INSERT INTO contest_reviews VALUES('mix-review','mix-entry','customer-one','approved','Existing Mix notes'),
      ('duplicate-review','cake-regular','customer-one','approved','Preserved duplicate notes');
    INSERT INTO contest_review_scores VALUES('mix-review','appearance',83),('duplicate-review','appearance',91);
    INSERT INTO contest_notebook_unlocks VALUES('mix-entry','customer-one','2026-01-01'),('cake-regular','customer-one','2026-01-02');
    INSERT INTO reward_receipts VALUES('mix-reward','mix-entry','{"granted":true}'),('duplicate-reward','cake-regular','{"granted":true}');
    CREATE TEMP TABLE before_entries AS SELECT * FROM contest_entries;
  `);
  const beforeContent = await content();
  const beforeHistory = await history();
  check("producer obligations start at 18 distinct products", (await rows("SELECT count(*)::int AS n FROM kq_producer_notebook_products('producer-one')"))[0].n, 18);
  await db.exec(migration);
  check("published live shape is 12 Regular and 5 Concours", await rows("SELECT track::text,count(*)::int AS count FROM contest_entries WHERE is_published GROUP BY track ORDER BY track"), [{track:"concours",count:5},{track:"regular",count:12}]);
  check("exactly six live-shape entries change", (await rows("SELECT count(*)::int AS n FROM contest_entries e JOIN before_entries b USING(id) WHERE (e.track,e.is_published) IS DISTINCT FROM (b.track,b.is_published)"))[0].n, 6);
  check("White Cbg keeps its ID and becomes Concours", await entry("white-cbg-entry"), {track:"concours",is_published:true});
  check("Mix is hidden without changing its track", await entry("mix-entry"), {track:"regular",is_published:false});
  for (const name of ["cake","strawnana","legendary","shaolin"]) {
    check(`${name} wrong-track duplicate is unpublished`, await entry(`${name}-regular`), {track:"regular",is_published:false});
    check(`${name} editorial Concours entry stays published`, await entry(`${name}-concours`), {track:"concours",is_published:true});
  }
  check("all entry IDs, slugs and editorial content remain identical", await content(), beforeContent);
  check("reviews, scores, unlocks and reward receipts remain identical", await history(), beforeHistory);
  check("producer obligations become 17 distinct products", (await rows("SELECT count(*)::int AS n FROM kq_producer_notebook_products('producer-one')"))[0].n, 17);
  check("Mix no longer creates an obligation", await rows("SELECT product_id FROM kq_producer_notebook_products('producer-one') WHERE product_id='small-bud-mix'"), []);

  const cases = [
    {id:"gram-price-regular",price:25,weight:10,track:"concours",expected:{track:"regular",is_published:true}},
    {id:"gram-price-concours",price:40,weight:10,expected:{track:"concours",is_published:true}},
    {id:"rounded-regular",price:7.49,weight:3,track:"concours",expected:{track:"regular",is_published:true}},
    {id:"rounded-low",price:2.494,expected:{track:"regular",is_published:false}},
    {id:"promotion-concours",price:2.5,options:{originalPrice:4},expected:{track:"concours",is_published:true}},
    {id:"promotion-regular",price:2,options:{originalPrice:2.5},expected:{track:"regular",is_published:true}},
    {id:"invalid-original",price:2.5,options:{originalPrice:"NaN"},expected:{track:"regular",is_published:true}},
    {id:"lower-original",price:4,options:{originalPrice:2.5},expected:{track:"concours",is_published:true}},
    {id:"empty-variants",price:4,options:{variants:[]},expected:{track:"concours",is_published:true}},
  ];
  for (const item of cases) {
    await product(item.id,item.price,item.weight ?? 1,item.options);
    await addEntry(item.id,item.id,item.track ?? "regular");
  }
  const excluded = [
    {id:"null-price",price:null},{id:"zero-price",price:0},{id:"negative-price",price:-1},{id:"nan-price",price:"NaN"},
    {id:"infinite-price",price:"Infinity"},{id:"null-weight",price:4,weight:null},{id:"zero-weight",price:4,weight:0},
    {id:"negative-weight",price:4,weight:-1},{id:"pack",price:4,options:{isPack:true}},
    {id:"variants",price:4,options:{variants:[{weightGrams:1,price:4}]}},{id:"malformed-variants",price:4,options:{variants:{}}},
    {id:"json-null-variants",price:4,options:{variants:null}},{id:"not-flower",price:4,options:{category:"resines"}},
  ];
  for (const item of excluded) {
    await product(item.id,item.price,Object.hasOwn(item,"weight")?item.weight:1,item.options);
    await addEntry(item.id,item.id);
  }
  await product("season-scope",4);
  await addEntry("archived-entry","season-scope","regular","archived");
  await addEntry("inactive-entry","season-scope","regular","inactive");
  await addEntry("unpublished-entry","season-scope","regular","active",false);
  await product("ambiguous",4); await addEntry("ambiguous-one","ambiguous"); await addEntry("ambiguous-two","ambiguous");
  const beforeEdgesContent = await content();
  await db.exec(migration);
  for (const item of cases) check(item.id,await entry(item.id),item.expected);
  for (const item of excluded) check(`${item.id} is excluded safely`,await entry(item.id),{track:"regular",is_published:true});
  for (const id of ["archived-entry","inactive-entry","ambiguous-one","ambiguous-two"]) check(`${id} unchanged`,await entry(id),{track:"regular",is_published:true});
  check("unpublished entries are never reactivated",await entry("unpublished-entry"),{track:"regular",is_published:false});
  check("edge-case editorial data and all IDs remain unchanged",await content(),beforeEdgesContent);
  check("history remains unchanged after all classifications",await history(),beforeHistory);
  const beforeReplay = await rows("SELECT * FROM contest_entries ORDER BY id");
  await db.exec(migration);
  check("migration is idempotent, including updated_at",await rows("SELECT * FROM contest_entries ORDER BY id"),beforeReplay);
  console.log(JSON.stringify({passed:true,engine:"PGlite isolated PostgreSQL",checks:checks.length,details:checks},null,2));
} finally {
  await db.close();
}
