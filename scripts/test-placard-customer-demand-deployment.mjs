// Local PostgreSQL only: rehearse the actual deployed 007 baseline, install
// customer demand, then install the independent pending warehouse migrations.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const vite = await createServer({ configFile: false, envDir: false, resolve: { alias: { '@': path.resolve('src') } }, server: { middlewareMode: true, watch: null, hmr: false } });
const sql = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
const scalar = async (query, values = []) => Object.values((await db.query(query, values)).rows[0])[0];
let checks = 0;
const equal = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
const reject = async (fn, code) => {
  await db.exec('SAVEPOINT expected_failure');
  try { await assert.rejects(fn, error => error.message.includes(code)); checks++; }
  finally { await db.exec('ROLLBACK TO SAVEPOINT expected_failure'); }
};
const definition = async (file, name) => {
  const source = await sql(file);
  const found = source.match(new RegExp(`CREATE(?: OR REPLACE)? FUNCTION public\\.${name}\\([\\s\\S]*?\\$\\$;`));
  assert(found, `Missing migration function ${name}`);
  return found[0].replace(/^CREATE FUNCTION/, 'CREATE OR REPLACE FUNCTION');
};
try {
  const source = await readFile(new URL('./test-placard-warehouse.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('try {\n  // Reuse');
  const end = source.lastIndexOf('} catch (error) {');
  assert(start >= 0 && end > start, 'warehouse fixture markers changed');
  let body = source.slice(start + 'try {'.length, end).replaceAll('import.meta.url', 'fixtureUrl');
  const originalInstall = '  await db.exec(await sql(customerDemandMigration));';
  const beforePending = '  await db.exec(await sql("20261012000800_kq_warehouse_simulation_options.sql"));';
  assert.equal(body.split(originalInstall).length, 2, 'exactly one deferred demand migration');
  assert.equal(body.split(beforePending).length, 2, 'exactly one pending warehouse boundary');
  body = body.replace(originalInstall, '  // Customer demand already installed immediately after 007.');
  body = body.replace(beforePending, `${originalInstall}\n  console.log('Customer demand installed directly after warehouse 007.');\n${beforePending}`);
  body = body.replace(/  console\.log\(`Warehouse: \$\{checks\} PostgreSQL integration checks passed\.`\);/, '');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  await new AsyncFunction('db', 'vite', 'sql', 'scalar', 'equal', 'reject', 'definition', 'readFile', 'randomUUID', 'assert', 'fixtureUrl', body)
    (db, vite, sql, scalar, equal, reject, definition, readFile, randomUUID, assert, import.meta.url);
  equal(await scalar("SELECT to_regclass('public.kq_customer_demand_usage') IS NOT NULL"), true, 'quota table remains after future independent migrations');
  console.log(`Customer demand deployment order: ${checks} PostgreSQL checks passed (007 -> 02000 -> 008/009/010).`);
} catch (error) {
  console.error(error.message, error.where ?? '');
  process.exitCode = 1;
} finally { await db.close(); await vite.close(); }
