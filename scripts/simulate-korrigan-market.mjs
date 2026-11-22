import assert from "node:assert/strict";
import { KORRIGAN_ODDS } from "../src/lib/kanab-quest-korrigan.ts";

// Deterministic Monte Carlo only. Live draws use the database RNG.
let seed = 0x51c0ffee;
function unit() {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let word = Math.imul(seed ^ seed >>> 15, 1 | seed);
  word = word + Math.imul(word ^ word >>> 7, 61 | word) ^ word;
  return ((word ^ word >>> 14) >>> 0) / 4294967296;
}
const weights = Object.entries(KORRIGAN_ODDS);
assert.equal(weights.reduce((n, [, w]) => n + w, 0), 10000);
function sample() {
  let bucket = Math.floor(unit() * 10000);
  for (const [kind, weight] of weights) {
    if (bucket < weight) return kind;
    bucket -= weight;
  }
  throw Error("Incomplete probability table");
}
const multipliers = { x5: 5, x10: 10, x50: 50 };
const counts = Object.fromEntries(weights.map(([kind]) => [kind, 0]));
const sessions = 1000000;
let blank = 0, paid = 0, multipleJackpots = 0, maxCashMultiple = 0;
for (let session = 0; session < sessions; session++) {
  const draws = [sample(), sample(), sample()];
  let cash = 0;
  for (const kind of draws) {
    counts[kind]++;
    cash += multipliers[kind] ?? 0;
  }
  if (draws.every(kind => kind === "loss")) blank++;
  if (draws.filter(kind => kind === "x50").length >= 2) multipleJackpots++;
  paid += cash;
  maxCashMultiple = Math.max(maxCashMultiple, cash);
}
// Exhaust the independent triples to cover events that a million sessions can miss.
let expectedCash = 0, jackpotPairChance = 0, tripleChance = 0, absoluteMaximum = 0;
for (const [a, wa] of weights) for (const [b, wb] of weights) for (const [c, wc] of weights) {
  const triple = [a, b, c];
  const amount = triple.reduce((n, kind) => n + (multipliers[kind] ?? 0), 0);
  const probability = wa * wb * wc / 1e12;
  expectedCash += probability * amount;
  const jackpots = triple.filter(kind => kind === "x50").length;
  if (jackpots >= 2) jackpotPairChance += probability;
  if (jackpots === 3) tripleChance += probability;
  absoluteMaximum = Math.max(absoluteMaximum, amount);
}
assert.equal(absoluteMaximum, 150);
console.log(JSON.stringify({ seed: "0x51c0ffee", sessions, counts, observed: { blank, cashPerV: paid / sessions,
  multipleJackpots, maxCashMultiple }, exact: { cashPerV: Number(expectedCash.toFixed(8)), absoluteMaximum,
  atLeastTwoJackpots: jackpotPairChance, threeJackpots: tripleChance } }, null, 2));
