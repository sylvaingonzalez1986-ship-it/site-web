/** Optimistic progression audit: all equipment already at level 10, no funding delay. */
import { createServer } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const vite = await createServer({ configFile: false, envDir: false, resolve: { alias: { "@": resolve("src") } }, server: { middlewareMode: true, watch: null } });
try {
  const { quoteKqMarketRoutes, getKqRouteExpertiseBonusReputation, previewKqMarketReputation } = await vite.ssrLoadModule('/src/lib/kanab-quest-market.ts');
  const { KQ_EQUIPMENT_CATALOG } = await vite.ssrLoadModule('/src/lib/kanab-quest-equipment.ts');
  const { KQ_REPUTATION_TIERS } = await vite.ssrLoadModule('/src/lib/kanab-quest-reputation.ts');
  const equipmentCodes = KQ_EQUIPMENT_CATALOG.map(e => e.code);
  const equipmentLevels = Object.fromEntries(equipmentCodes.map(code => [code, 10]));
  const scenarios = [];
  for (const score of [8, 8.5, 9, 10]) {
    let reputation = 0;
    const routeSales = {}, reached = {}, previousReached = {};
    for (let sale = 1; sale <= 1000; sale++) {
      const options = quoteKqMarketRoutes({ juryScore: score, harvestGrams: 120, equipmentCodes, equipmentLevels, marketContext: { reputation, routeSales, recentSales: {}, marketVolumes: {}, window: sale % 6 } });
      // Clearance is always available; a player can prioritize reputation over profit.
      const choice = options.filter(q => q.market.offers[0].accepted).map(q => ({ q, bonus: getKqRouteExpertiseBonusReputation(q.route, (routeSales[q.route] ?? 0) + 1, q.reputationGain) })).sort((a,b) => (b.q.reputationGain+b.bonus)-(a.q.reputationGain+a.bonus))[0];
      reputation = previewKqMarketReputation(reputation, choice.q.reputationGain, choice.bonus).reputationAfter;
      routeSales[choice.q.route] = (routeSales[choice.q.route] ?? 0) + 1;
      for (const tier of KQ_REPUTATION_TIERS.slice(1)) if (!reached[tier.minimum] && reputation >= tier.minimum) reached[tier.minimum] = sale;
      for (const threshold of [20,60,150,300,600]) if (!previousReached[threshold] && reputation >= threshold) previousReached[threshold] = sale;
      if (reputation >= KQ_REPUTATION_TIERS.at(-1).minimum) break;
    }
    scenarios.push({ score, salesToTier: reached, previousSalesToTier: previousReached });
  }
  const report = { assumptions: "Constant jury score, best immediate reputation gain, all machines level 10 from start, no booster or cash constraint. Sales, not days; optimistic scenarios, not measured player pacing.", scenarios };
  await mkdir(resolve('output/placard-living-market'), { recursive: true });
  await writeFile(resolve('output/placard-living-market/reputation-pacing.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await vite.close(); }
