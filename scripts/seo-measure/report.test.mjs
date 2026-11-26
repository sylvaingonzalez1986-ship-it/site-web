import assert from "node:assert/strict";
import test from "node:test";
import { summarize } from "./report.mjs";

const date = "2026-11-26";
const seed = { date: "2026-11-23", country: "FR", device: "mobile", brand: "nonbrand", landing: "/cbd-breton", clicks: 2, impressions: 4, position: 2 };
const fixture = rows => ({ schema: 1, sources: { googleWeb: { from: "2026-08-26", through: "2026-11-23", rows } } });

test("dates finalisées, poids des impressions, mêmes segments", () => {
  const result = summarize(fixture([seed, { ...seed, date: "2026-11-22", clicks: 1, impressions: 6, position: 7 },
    { ...seed, date: "2026-10-26", clicks: 1 }]), date);
  const { last28, previous28, baseline90 } = result.sources.googleWeb.periods;
  assert.deepEqual([last28.start, last28.end, previous28.start, previous28.end, baseline90.start],
    ["2026-10-27","2026-11-23","2026-09-29","2026-10-26","2026-08-26"]);
  assert.equal(last28.ctr, 0.3);
  assert.equal(last28.position, 5);
  assert.equal(result.opportunities[0].clicksDelta, 2);
  assert.equal(result.sources.organicSales, null);
});

test("une ligne absente, une couverture incomplète ou un poids inconnu restent indisponibles", () => {
  assert.equal(summarize(fixture([]), date).sources.googleWeb.periods.last28, null);
  const data = fixture([{ ...seed, position: null }]);
  data.sources.googleWeb.from = "2026-10-27";
  const periods = summarize(data, date).sources.googleWeb.periods;
  assert.equal(periods.last28.position, null);
  assert.equal(periods.previous28, null);
  assert.equal(periods.baseline90, null);
});

test("rejet des doublons, de données personnelles ou de couverture future", () => {
  for (const rows of [[seed, seed], [{ ...seed, email: "fixture" }], [{ ...seed, landing: "/compte" }]]) {
    assert.throws(() => summarize(fixture(rows), date));
  }
  assert.throws(() => summarize(fixture([seed]), seed.date));
});
