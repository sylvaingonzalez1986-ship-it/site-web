import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "scripts/smoke-test-placard-transactions.mjs"),
  "utf8",
);

describe("Placard transaction smoke-test policy", () => {
  it("only accepts localhost targets without a remote override", () => {
    expect(source).toContain("const isLocal = /^https?:");
    expect(source).toContain("if (!isLocal)");
    expect(source).not.toContain("ALLOW_REMOTE");
  });

  it("requires an explicit confirmation for each destructive action family", () => {
    expect(source).toContain('PLACARD_SMOKE_CONFIRM_BURNS === "LOCAL_BURNS_ONLY"');
    expect(source).toContain('PLACARD_SMOKE_CONFIRM_MARKET === "LOCAL_MARKET_ONLY"');
    expect(source).toContain('PLACARD_SMOKE_CONFIRM_EQUIPMENT === "LOCAL_EQUIPMENT_ONLY"');
    expect(source).toContain('if ((action === "card" || action === "verdict" || action === "bot-challenge") && !burnConfirmation)');
    expect(source).toContain('if (action === "market" && !marketConfirmation)');
    expect(source).toContain('if (action === "equipment" && !equipmentConfirmation)');
    expect(source).toContain("delete process.env.PLACARD_SMOKE_COOKIE");
    expect(source).toContain("delete process.env.PLACARD_SMOKE_RUN_ID");
    expect(source).toContain("delete process.env.PLACARD_SMOKE_FLOWER_ID");
    expect(source).toContain("delete process.env.PLACARD_SMOKE_EQUIPMENT_CODE");
  });

  it("never opens an environment file and only accepts the process environment", () => {
    expect(source).toContain("process.env.NEXT_PUBLIC_SUPABASE_URL");
    expect(source).not.toContain("readEnvValue");
    expect(source).not.toContain("readFileSync");
    expect(source).not.toContain(".env.local");
    expect(source).not.toContain("PLACARD_SMOKE_ENV_FILE");
  });

  it("archives a redacted, versioned proof without overwriting prior runs", () => {
    expect(source).toContain("PLACARD_SMOKE_REPORT_DIR");
    expect(source).toContain('schema: "kanab-quest-transaction-smoke-v2"');
    expect(source).toContain("routeTemplate: result.routeTemplate");
    expect(source).toContain("targetFingerprint:");
    expect(source).toContain("responseDigest: result.responseDigest");
    expect(source).toContain("responseKeys: result.responseKeys");
    expect(source).toContain("reportDirectoryFromRoot.startsWith(`..${sep}`)");
    expect(source).toContain("await mkdir(reportDirectory, { recursive: true })");
    expect(source).toContain('flag: "wx"');

    const summaryStart = source.indexOf("const summary = {");
    const summaryEnd = source.indexOf("await mkdir", summaryStart);
    const summarySource = source.slice(summaryStart, summaryEnd);
    expect(summarySource).not.toContain("cookie");
    expect(summarySource).not.toContain("runId");
    expect(summarySource).not.toContain("battleId");
    expect(summarySource).not.toContain("flowerId");
    expect(summarySource).not.toContain("firstReceipt");
    expect(summarySource).not.toContain("secondReceipt");
  });

  it("also proves that the configured Supabase database is local", () => {
    expect(source).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(source).toContain('PLACARD_SMOKE_CONFIRM_DATABASE === "LOCAL_SUPABASE_ONLY"');
    expect(source).toContain("if (!isLocalDatabase)");
    expect(source).toContain("base Supabase distante ou inconnue");
  });

  it("preflights the authenticated bootstrap before invoking a scenario", () => {
    const bootstrapIndex = source.indexOf('const bootstrapResult = await requestJson("/api/arena/placard/bootstrap")');
    const scenarioIndex = source.indexOf('result = action === "market"');
    expect(bootstrapIndex).toBeGreaterThan(0);
    expect(scenarioIndex).toBeGreaterThan(bootstrapIndex);
    expect(source).toContain("bootstrapResult.response.status !== 200");
  });

  it("covers card, verdict, bot challenges, equipment purchase and the complete local market transaction", () => {
    expect(source).toContain('if (!["card", "verdict", "bot-challenge", "equipment", "market"].includes(action))');
    expect(source).toContain("/cards");
    expect(source).toContain("/verdict");
    expect(source).toContain('async function runMarketScenario()');
    expect(source).toContain('async function runEquipmentScenario()');
    expect(source).toContain('async function runBotChallengeScenario()');
    expect(source).toContain('/api/arena/placard/bot-battles');
    expect(source).toContain("seasonPointsConfirmed");
    expect(source).toContain("challengeClaimsSynced");
    expect(source).toContain("flowerBurnConfirmed");
    expect(source).toContain("noDoubleCreditConfirmed");
    expect(source).toContain('/api/arena/placard/equipment');
    expect(source).toContain('/api/arena/placard/market');
    expect(source).toContain('action: "route-plan"');
    expect(source).toContain("equipmentCodes: [equipmentCode]");
    expect(source).toContain('body: saleBody });');
    expect(source).toContain('secondReceipt?.replayed === true');
    expect(source).toContain('routeMastery?.matchedPlan === true');
    expect(source).toContain("expertiseBonusReputation");
    expect(source).toContain('replayReceipt?.replayed === true');
    expect(source).toContain("cashDeltaConfirmed");
    expect(source).toContain("inventoryConfirmed");
    expect(source).toContain("installationConfirmed");
  });
});
