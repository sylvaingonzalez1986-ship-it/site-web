// Exercises the real report SQL against an isolated PostgreSQL engine; no network.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const original = await readFile('scripts/sql/placard-player-progression.sql', 'utf8');
const reportSql = original.replace('CURRENT_TIMESTAMP AS as_of', "TIMESTAMPTZ '2026-10-20T00:00:00Z' AS as_of");
assert.notEqual(original, reportSql);
let checks = 0;
const check = (label, actual, expected) => { assert.deepEqual(actual, expected, label); checks++; };
const report = async () => (await db.exec(reportSql)).find(result => result.rows[0]?.report)?.rows[0].report;
const at = (start, hours) => new Date(Date.parse(start) + hours * 3600_000).toISOString();
const run = async (user, start, { campaign = null, harvest = null, updated = start, dead = false } = {}) => {
  const id = randomUUID();
  await db.query('INSERT INTO kq_runs VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [id, user, campaign, start, harvest, harvest ? 'completed' : dead ? 'abandoned' : 'active', updated, { cultureDead: dead }]);
  return id;
};
const sale = (user, date, online = false) => online
  ? db.query('INSERT INTO kq_online_sales VALUES ($1,$2)', [user, date])
  : db.query('INSERT INTO kq_market_sale_receipts VALUES ($1,$2)', [user, date]);
const burn = (user, date) => db.query('INSERT INTO kq_card_burn_receipts VALUES ($1,$2)', [user, date]);

try {
  await db.exec(`
    CREATE TABLE kq_runs(id UUID PRIMARY KEY,user_id UUID,campaign_id UUID,started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,status TEXT,updated_at TIMESTAMPTZ,state JSONB);
    CREATE TABLE kq_market_sale_receipts(owner_id UUID,created_at TIMESTAMPTZ);
    CREATE TABLE kq_online_sales(user_id UUID,occurred_at TIMESTAMPTZ);
    CREATE TABLE kq_card_burn_receipts(user_id UUID,burned_at TIMESTAMPTZ);
  `);
  const empty = await report();
  check('empty database yields a real empty population', [empty.overall.players, empty.weeklyCohorts], [0, []]);
  check('no eligible account means null, not 0%', Object.values(empty.overall.metrics).map(m => m.percent), [null, null, null, null, null]);

  const [a,b,c,d,e,f,g] = Array.from({ length: 7 }, randomUUID);
  const start = '2026-10-10T00:00:00Z', later = '2026-10-12T00:00:00Z';
  const campaignA = randomUUID();
  await run(a, start, { campaign: campaignA, harvest: at(start, 2) });
  await run(a, start, { campaign: campaignA, harvest: at(start, 3) });
  await run(a, at(start, 24));
  await burn(a, at(start, 168));
  await burn(a, at(start, 169)); // Duplicate activity never increases the number of players.
  await sale(a, at(start, 4));
  await sale(a, at(start, 5), true);
  await run(b, start, { dead: true, updated: at(start, 168) });
  await sale(b, at(start, 168), true); // Passive sale on D7 must not imply a return.
  const campaignC = randomUUID();
  await run(c, start, { campaign: campaignC });
  await run(c, start, { campaign: campaignC });
  await sale(c, at(start, 6), true);
  await run(d, later, { harvest: at(later, 168) }); // Exactly outside the seven-day conversion window.
  await run(d, at(later, 48)); // Exactly outside D1.
  await burn(d, at(later, 192)); // Exactly outside D7.
  const recent = '2026-10-19T12:00:00Z';
  await run(e, recent, { harvest: at(recent, 1) });
  await sale(e, at(recent, 2)); // Converted, but not mature: omit from both sides of seven-day rate.
  const threeDaysAgo = '2026-10-17T00:00:00Z';
  await run(f, threeDaysAgo);
  await burn(f, at(threeDaysAgo, 24));
  await run(g, '2026-10-21T00:00:00Z'); // Future-dated anomalies are outside the snapshot.
  await burn(b, '2026-10-21T00:00:00Z');

  const populated = await report(), overall = populated.overall, metrics = overall.metrics;
  check('future dates do not enter the population', overall.players, 6);
  check('mature denominators differ by full observation window',
    [metrics.harvestWithin7Days.denominator, metrics.cultureActivityD1.denominator, metrics.cultureActivityD7.denominator], [4, 5, 4]);
  check('new cohorts remain pending instead of lowering rates',
    [overall.pendingSevenDayWindow, overall.pendingD1Window, overall.pendingD7Window], [2, 1, 2]);
  check('death, immature success and exact 168-hour harvest are excluded',
    [metrics.harvestWithin7Days.numerator, metrics.harvestWithin7Days.percent], [1, 25]);
  check('a second zone is not a second culture cycle',
    [metrics.secondCycleWithin7Days.numerator, metrics.secondCycleWithin7Days.percent], [2, 50]);
  check('first sale unions manual and automatic receipts without counting a player twice',
    [metrics.saleWithin7Days.numerator, metrics.saleWithin7Days.percent], [2, 50]);
  check('D1 uses [24,48) hours and mature players only',
    [metrics.cultureActivityD1.numerator, metrics.cultureActivityD1.percent], [2, 40]);
  check('D7 ignores passive sales, updated_at, repeat actions and the 192-hour boundary',
    [metrics.cultureActivityD7.numerator, metrics.cultureActivityD7.percent], [2, 50]);
  check('median durations use mature seven-day converters only',
    overall.medianHoursAmongSevenDayConverters, { firstSale: 5, firstHarvest: 2 });
  const youngest = populated.weeklyCohorts.find(cohort => cohort.cohortWeek === '2026-10-19');
  check('young cohort rates stay unavailable',
    [youngest.players, youngest.metrics.harvestWithin7Days.percent], [1, null]);
  check('results expose neither IDs nor individual events', [a,b,c,d,e,f,g,campaignA,campaignC].some(id => JSON.stringify(populated).includes(id)), false);
  check('repeated execution is stable and read-only', await report(), populated);
  check('source data remains intact', Number((await db.query('SELECT count(*) FROM kq_runs')).rows[0].count), 11);

  await db.exec('TRUNCATE kq_runs,kq_market_sale_receipts,kq_online_sales,kq_card_burn_receipts');
  await run(randomUUID(), '2026-10-18T22:30:00Z');
  const paris = await report();
  check('weekly cohort boundary follows Paris rather than UTC', paris.weeklyCohorts[0].cohortWeek, '2026-10-19');
  await db.exec('BEGIN READ ONLY');
  await assert.rejects(db.exec("INSERT INTO kq_online_sales VALUES (gen_random_uuid(),now())"), /read-only/);
  await db.exec('ROLLBACK');
  checks++;
  console.log(`Player progression report: ${checks} PostgreSQL checks passed (no network or remote writes).`);
} finally {
  await db.close();
}
