// Pure arithmetic only: no network, secrets, database, dependencies or load generation.
// Usage from repository root: node docs/bete-de-concours/audit-technique-2026-11-09/modele.mjs [parameters.json]
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const p = JSON.parse(await readFile(process.argv[2] ?? new URL('./parametres.json', import.meta.url), 'utf8'));
const price = p.pricing, base = p.illustrativeBaseline, session = p.sessions, bytes = p.payloads;
const round = x => Number(x.toFixed(3));
const excess = (usage, quota, rate) => Math.max(0, usage - quota) * rate;
function cdnCost(requests, gb) {
  if (!price.cdnFlatEnabled) return requests / 1e6 * price.cdnOnDemandUsdPerMillion + gb * price.cdnTransferUsdPerGb;
  const tier = price.cdnTiers.find(t => requests <= t.requests && gb <= t.gb);
  return tier ? tier.usd : null; // Beyond documented tier: no invented bill.
}
const fixed = price.supabasePlanUsd + Math.max(0, price.computeHours * price.computeUsdPerHour - price.computeCreditUsd) + price.vercelPlanUsd + base.otherFixedUsd;
function bill({ usage = 0, cdnRequests = 0, cdnGb = 0, egressGb = 0, diskGb = 0, mau = 0 } = {}) {
  const cdn = cdnCost(base.cdnRequests + cdnRequests, base.cdnGb + cdnGb);
  const supabase = excess(base.supabaseEgressGb + egressGb, price.egressIncludedGb, price.egressUsdPerGb)
    + excess(base.supabaseCachedEgressGb, price.cachedEgressIncludedGb, price.cachedEgressUsdPerGb)
    + excess(base.databaseGb + diskGb, price.diskIncludedGb, price.diskUsdPerGb)
    + excess(base.storageGb, price.storageIncludedGb, price.storageUsdPerGb)
    + excess(base.mau + mau, price.mauIncluded, price.mauUsd);
  const vercel = Math.max(0, base.vercelMeteredUsd + usage - price.vercelCreditUsd);
  return { fixedUsd: round(fixed), cdnUsd: cdn, supabaseOverageUsd: round(supabase), vercelOverageUsd: round(vercel), totalUsd: cdn === null ? null : round(fixed + cdn + supabase + vercel) };
}
const capacity = p.tiers.map(active => ({ active, connectedWith20PercentHidden: Math.ceil(active / .8), status: 'non teste; trafic estime, capacite inconnue',
  profiles: Object.fromEntries(Object.entries(p.profiles).map(([name, f]) => {
    const rps = active * (f.actionsPerMinute * f.httpPerAction + f.automaticPerMinute) / 60;
    return [name, { apiRps: round(rps), authRpsAtLeast: round(rps), realtimeConnections: 0, realtimeMessagesPerSecond: 0,
      sqlReadStatementsPerSecond: p.resources.sqlReadsPerApi === null ? null : round(rps * p.resources.sqlReadsPerApi),
      sqlWriteStatementsPerSecond: p.resources.sqlWritesPerApi === null ? null : round(rps * p.resources.sqlWritesPerApi),
      // Lower bounds only, if every counted action is a successful state-changing cultivation command.
      cultivationSqlReadFloorPerSecond: round(active * f.actionsPerMinute / 60),
      cultivationSqlWriteFloorPerSecond: round(2 * active * f.actionsPerMinute / 60) }];
  })) }));
const normal = p.profiles.normal;
const monthly = session.dau.map(dau => {
  const sessions = dau * session.days * session.perDay;
  const activeMinutes = sessions * session.activeMinutes;
  const invocations = activeMinutes * (normal.actionsPerMinute * normal.httpPerAction + normal.automaticPerMinute) + sessions * session.entryHttp;
  const apiGb = invocations * bytes.apiBytes / 1e9;
  const egressGb = invocations * bytes.supabaseBytesPerApi / 1e9;
  const assetGb = sessions * bytes.assetBytesPerSession / 1e9;
  const cdnRequests = invocations + sessions * bytes.assetRequestsPerSession;
  const appendedGb = activeMinutes * normal.actionsPerMinute * bytes.appendBytesPerAction / 1e9;
  const mau = dau / session.dauMauRatio;
  const estimates = [0, 1].map(i => {
    const cpuHours = invocations * p.resources.cpuMsPerApi[i] / 3.6e6;
    const memoryGbHours = invocations * p.resources.effectiveGbSecondsPerApi[i] / 3600;
    const usage = cpuHours * price.cpuUsdPerHour + memoryGbHours * price.memoryUsdPerGbHour + invocations / 1e6 * price.invocationUsdPerMillion + apiGb * price.originUsdPerGb;
    const total = bill({ usage, cdnRequests, cdnGb: apiGb + assetGb, egressGb, diskGb: appendedGb / 2, mau });
    return { cpuHours: round(cpuHours), memoryGbHours: round(memoryGbHours), meteredVercelBeforeCreditUsd: round(usage), ...total,
      incrementalVersusIllustrativeBaselineUsd: total.totalUsd === null ? null : round(total.totalUsd - bill().totalUsd) };
  });
  return { dau, mau, sessions, activeMinutes, avgActive: round(dau * session.perDay * session.activeMinutes / 1440), assumedPeakActive: round(dau * session.perDay * session.activeMinutes / 1440 * session.peakFactor), invocations, cdnRequests, apiGb: round(apiGb), assetGb: round(assetGb), supabaseEgressGb: round(egressGb), appendedGb: round(appendedGb), estimates };
});
const result = { auditDate: p.auditDate, notice: p.notice, observed: p.observed, baseline: bill(), capacity, monthly,
  budgets: p.budgetExamplesEur.map(budget => ({ budgetEur: budget, fixedEurAtIllustrativeFx: round(fixed * p.currency.eurPerUsd), fixedWithIllustrativeTaxEur: round(fixed * p.currency.eurPerUsd * (1 + p.currency.taxSensitivity)), beforeUsageAndOtherSiteCostsEur: round(budget - fixed * p.currency.eurPerUsd) })),
  exclusions: ['production capacity not measured', 'actual existing site usage unknown', 'actual compute upgrade need unknown', 'images/cache/builds/observability/storage deployment/mail options unmeasured', 'physical prizes and payment fees excluded', 'MAU sum assumes disjoint cohorts; use union when known', 'CDN tier is steady-state next-cycle estimate, not automatic immediate overage'] };
await writeFile(new URL('./calculs.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ file: fileURLToPath(new URL('./calculs.json', import.meta.url)), baseline: result.baseline, monthly: monthly.map(r => ({dau:r.dau, peak:r.assumedPeakActive, calls:r.invocations, usd:r.estimates.map(e=>e.totalUsd)})) }, null, 2));
