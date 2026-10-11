/** Read-only pacing audit. Eligibility is simulated; cash earnings and purchase dates are not. */
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { createServer } from "vite";

const vite = await createServer({
  configFile: false, envDir: false,
  resolve: { alias: { "@": resolve("src") } },
  server: { middlewareMode: true, watch: null },
});
try {
  const career = await vite.ssrLoadModule("/src/lib/chanvrier-career.ts");
  const { KQ_EQUIPMENT_CATALOG, getKqEquipmentCartTotal } = await vite.ssrLoadModule("/src/lib/kanab-quest-equipment.ts");
  const { buildKqEconomyBalanceReport } = await vite.ssrLoadModule("/src/lib/kanab-quest-economy-balance.ts");
  const equipment = KQ_EQUIPMENT_CATALOG.filter(item => item.purchasable);
  const scenarios = [];
  for (const cashEuros of [0, 5000, 100000]) {
    for (const productionUnits of [1, 8]) {
      let xp = 0;
      const equipmentEligibleAfterSession = {}, levelReachedAfterSession = {};
      const processingPractice = { sifting: 0, washing: 0, pressing: 0 };
      for (let session = 0; session <= 45; session++) {
        const snapshot = career.createChanvrierCareerSnapshot({ xp, completedCultures: session, processingPractice });
        levelReachedAfterSession[snapshot.level] ??= session;
        for (const item of equipment) {
          if (career.getChanvrierEquipmentAccess(snapshot, item.code).allowed) equipmentEligibleAfterSession[item.code] ??= session;
        }
        // At most one transformed lot per culture. This eligibility-only audit
        // assumes the unlocked tool is available; finances are audited separately.
        const practiceTarget = processingPractice.sifting < 10 ? ["SIFT-TRAY", "sifting"]
          : processingPractice.washing < 6 ? ["WASHER-25L", "washing"] : ["PRESS-0600", "pressing"];
        if (career.getChanvrierEquipmentAccess(snapshot, practiceTarget[0]).allowed) processingPractice[practiceTarget[1]]++;
        const run = { status: "completed", completedStages: 6, productionUnits, cashEuros };
        xp += career.getChanvrierCultureXp(run);
      }
      scenarios.push({ cashEuros, productionUnits, levelReachedAfterSession, equipmentEligibleAfterSession });
    }
  }
  for (const scenario of scenarios) {
    assert.deepEqual(scenario.levelReachedAfterSession, scenarios[0].levelReachedAfterSession);
    assert.deepEqual(scenario.equipmentEligibleAfterSession, scenarios[0].equipmentEligibleAfterSession);
  }
  assert.equal(getKqEquipmentCartTotal(["PRESS-0600"], 1), getKqEquipmentCartTotal(["PRESS-0600"], 8));
  const failedSessionXp = [0, 1, 2, 3, 4, 5, 6].map(completedStages =>
    career.getChanvrierCultureXp({ status: "abandoned", cultureDead: true, completedStages }));
  console.log(JSON.stringify({
    assumptions: "Sessions, not elapsed days. Completed culture: 100 career XP independent of cash/tents. Practice counts are optimistic distinct transformed lots after basic techniques unlock. Purchase affordability, income, curing and play frequency are not simulated.",
    checks: "All six cash/tent scenarios have identical career and equipment eligibility milestones; a shared press costs once.",
    failedSessionXp,
    workshopInvestments: buildKqEconomyBalanceReport({ juryScore: 8.8, harvestGrams: 100 }).projections
      .filter(item => item.equipmentCodes.length > 0)
      .map(item => ({ route: item.route, equipmentLevels: item.equipmentLevels,
        investmentEuros: item.acquisitionCostCents / 100, adjustmentsEuros: item.upgradeCostCents / 100,
        optimisticPaybackLots: item.paybackHarvests, status: item.status })),
    scenarios,
  }, null, 2));
} finally {
  await vite.close();
}
