// Validate the generated read-only SQL without any real database or player.
// Run prepare-kq-customer-demand-deployment.mjs first to generate the SQL files.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const migration = '20261012002000_kq_variety_market_demands.sql';
const sql = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
const scalar = async (query, values = []) => Object.values((await db.query(query, values)).rows[0])[0];
try {
  const source = (await readFile(new URL('./test-placard-online.mjs', import.meta.url), 'utf8')).replace(`,'${migration}'`, '');
  const start = source.indexOf(' await db.exec(`');
  const end = source.indexOf(' // All relative timestamps');
  assert(start >= 0 && end > start);
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  await new AsyncFunction('db', 'sql', 'scalar', source.slice(start, end))(db, sql, scalar);
  await db.exec("CREATE SCHEMA supabase_migrations; CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY); INSERT INTO supabase_migrations.schema_migrations VALUES('20261011150000'),('20261012000700');");
  const audit = async (file, field) => {
    const results = await db.exec(await readFile(new URL(`../output/customer-demand-migration/${file}`, import.meta.url), 'utf8'));
    const report = results.flatMap(result => result.rows).find(row => row[field])?.[field];
    assert(report, `${field} result missing`);
    assert.equal(report.ok, true, JSON.stringify(report));
  };
  await audit('preflight.sql', 'preflight');
  await db.exec(await sql(migration));
  await db.exec("INSERT INTO supabase_migrations.schema_migrations VALUES('20261012002000')");
  await audit('verification.sql', 'verification');
  assert.equal(Number(await scalar('SELECT count(*) FROM auth.users')), 0);
  console.log('Read-only preflight and verification SQL passed with zero player accounts.');
} catch (error) { console.error(error.message, error.where ?? ''); process.exitCode = 1; }
finally { await db.close(); }
