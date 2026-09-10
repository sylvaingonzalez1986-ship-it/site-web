import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzePlacardLaunchEvidence } from "../../scripts/lib/placard-launch-evidence.mjs";

const generatedAt = "2026-09-05T12:00:00.000Z";
const loadPaths = [
  "/arene/placard",
  "/api/arena/placard/bootstrap",
  "/api/arena/placard/rankings",
  "/api/arena/placard/flowers",
  "/api/arena/placard/battles",
  "/api/arena/placard/equipment",
  "/api/arena/placard/market",
];

function entry(source: string, report: Record<string, unknown>): {
  source: string;
  report: Record<string, unknown> & { generatedAt: string };
} {
  return { source, report: { generatedAt, ...report } };
}

function retroPair(kind: "notebook" | "heritage" | "producer") {
  const fingerprint = `${kind}:0:proof`;
  const shared = {
    schema: "kanab-quest-retro-evidence-v1",
    kind,
    cursor: 0,
    nextCursor: null,
    previewFingerprint: fingerprint,
    gates: { live: true, writeAllowed: true },
  };
  const counts = kind === "notebook"
    ? { processed: 4, pending: 3, alreadyGranted: 1 }
    : kind === "heritage"
      ? { processedItems: 4, eligibleUnits: 4, pendingUnits: 3, alreadyAwarded: 1 }
      : { processed: 4, pendingFlowerBoosters: 2, pendingHeritages: 1 };
  const executionCounts = kind === "notebook"
    ? { granted: 3, alreadyGranted: 1 }
    : kind === "heritage"
      ? { awarded: 3, alreadyAwarded: 1 }
      : { flowerBoostersGranted: 2, heritagesGranted: 1 };
  return [
    entry(`${kind}-preview.json`, { ...shared, mode: "preview", counts, pending: 3, readyToExecute: true }),
    entry(`${kind}-execute.json`, { ...shared, mode: "execute", counts: executionCounts, pending: 0 }),
  ];
}

function completeReports() {
  const artworkGroups = [
    ["support", 36],
    ["heritage", 3],
    ["situation", 31],
    ["equipment", 22],
  ] as const;
  const approvedAssets = artworkGroups.flatMap(([group, count]) => (
    Array.from({ length: count }, (_, index) => ({
      code: `${group}-${index + 1}`,
      group,
      src: `/${group}-${index + 1}.webp`,
      status: "approved",
    }))
  ));
  const manualMobileChecks = [
    "physical-device",
    "hud-readability",
    "touch-navigation",
    "equipment-catalog",
    "cart-controls",
    "market-controls",
    "virtual-keyboard",
    "safe-areas",
    "orientation",
    "outdoor-contrast",
  ];
  return [
    entry("artwork.json", {
      schema: "kanab-quest-artwork-review-v3",
      manifestId: "artwork-92-testproof",
      inventory: { total: 92, heritage: 3 },
      summary: { approved: 92, pending: 0, rework: 0, readyForLaunch: true },
      assets: approvedAssets,
    }),
    entry("mobile.json", {
      schema: "kanab-quest-mobile-audit-v2",
      passed: true,
      accounts: 2,
      auditedViews: ["hud", "equipment-catalog", "market"],
      globalChecks: { viewCoverage: true },
    }),
    entry("mobile-manual.json", {
      schema: "kanab-quest-mobile-manual-review-v3",
      manifestId: "placard-mobile-manual-2x10-v3",
      exportedAt: generatedAt,
      summary: {
        total: 20,
        passed: 20,
        failed: 0,
        pending: 0,
        approvedProfiles: 2,
        readyForLaunch: true,
      },
      profiles: ["ios-safari", "android-chrome"].map((code) => ({
        code,
        checks: manualMobileChecks.map((checkCode) => ({
          code: checkCode,
          protocolId: checkCode === "market-controls"
            ? "mobile-market-sale-v2"
            : checkCode === "cart-controls"
              ? "mobile-equipment-purchase-v1"
              : null,
          status: "passed",
          reviewedAt: generatedAt,
        })),
      })),
    }),
    entry("load.json", {
      schema: "kanab-quest-load-test-v2",
      mode: "read-only",
      passed: true,
      authenticatedAccounts: 2,
      failedPaths: [],
      byPath: Object.fromEntries(loadPaths.map((path) => [path, { requests: 100, withinBudget: true }])),
    }),
    ...["card", "verdict", "bot-challenge", "equipment", "market"].map((action) => entry(`smoke-${action}.json`, {
      schema: "kanab-quest-transaction-smoke-v2",
      action,
      databaseHost: "127.0.0.1:54321",
      succeeded: true,
      checks: action === "bot-challenge"
        ? {
            receiptMatchesTarget: true,
            challengePoints: 15,
            experienceAwarded: 4,
            seasonPointsConfirmed: true,
            experienceConfirmed: true,
            burnedFlowersConfirmed: true,
            flowerBurnConfirmed: true,
            challengeClaimsSynced: true,
            replayRejected: true,
            noDoubleCreditConfirmed: true,
          }
        : action === "market"
        ? { replayConfirmed: true, masteryMatchedPlan: true, receiptMatchesTarget: true }
        : action === "equipment"
          ? {
              replayConfirmed: true,
              receiptMatchesTarget: true,
              cashDeltaConfirmed: true,
              inventoryConfirmed: true,
              installationConfirmed: true,
              finalCashConfirmed: true,
            }
          : {},
    })),
    ...retroPair("notebook"),
    ...retroPair("heritage"),
    ...retroPair("producer"),
  ];
}

describe("Placard launch evidence verifier", () => {
  it("requires one coherent, fresh proof for every launch rehearsal", () => {
    const result = analyzePlacardLaunchEvidence({
      reports: completeReports(),
      now: new Date("2026-09-05T13:00:00.000Z"),
      maxAgeDays: 14,
    });
    expect(result.passed).toBe(true);
    expect(result.requirements).toHaveLength(12);
    expect(result.requirements.every((requirement) => requirement.passed)).toBe(true);
  });

  it("rejects a claimed mobile approval when one physical check failed", () => {
    const reports = completeReports().map((item) => {
      if (item.source !== "mobile-manual.json") return item;
      const profiles = structuredClone(item.report.profiles) as Array<{
        code: string;
        checks: Array<{ code: string; status: string; reviewedAt: string }>;
      }>;
      profiles[1].checks[0].status = "failed";
      return entry(item.source, { ...item.report, profiles });
    });
    const result = analyzePlacardLaunchEvidence({
      reports,
      now: new Date("2026-09-05T13:00:00.000Z"),
    });
    expect(result.passed).toBe(false);
    expect(result.requirements.find((check) => check.code === "manual-mobile-review")?.passed).toBe(false);
  });

  it("rejects a mobile market check that does not prove the complete sale protocol", () => {
    const reports = completeReports().map((item) => {
      if (item.source !== "mobile-manual.json") return item;
      const profiles = structuredClone(item.report.profiles) as Array<{
        code: string;
        checks: Array<{ code: string; protocolId: string | null; status: string; reviewedAt: string }>;
      }>;
      const marketCheck = profiles[0].checks.find((check) => check.code === "market-controls");
      if (marketCheck) marketCheck.protocolId = null;
      return entry(item.source, { ...item.report, profiles });
    });
    const result = analyzePlacardLaunchEvidence({
      reports,
      now: new Date("2026-09-05T13:00:00.000Z"),
    });
    expect(result.passed).toBe(false);
    const manualReview = result.requirements.find((check) => check.code === "manual-mobile-review");
    expect(manualReview?.passed).toBe(false);
    expect(manualReview?.detail).toContain("Protocole de vente mobile v2 absent pour ios-safari");
  });

  it("rejects a mobile cart check that does not prove a complete equipment purchase", () => {
    const reports = completeReports().map((item) => {
      if (item.source !== "mobile-manual.json") return item;
      const profiles = structuredClone(item.report.profiles) as Array<{
        code: string;
        checks: Array<{ code: string; protocolId: string | null; status: string; reviewedAt: string }>;
      }>;
      const cartCheck = profiles[0].checks.find((check) => check.code === "cart-controls");
      if (cartCheck) cartCheck.protocolId = null;
      return entry(item.source, { ...item.report, profiles });
    });
    const result = analyzePlacardLaunchEvidence({
      reports,
      now: new Date("2026-09-05T13:00:00.000Z"),
    });
    expect(result.passed).toBe(false);
    const manualReview = result.requirements.find((check) => check.code === "manual-mobile-review");
    expect(manualReview?.passed).toBe(false);
    expect(manualReview?.detail).toContain("Protocole d’achat matériel mobile v1 absent pour ios-safari");
  });

  it("explains that a fresh v2 mobile proof is obsolete", () => {
    const reports = completeReports().map((item) => item.source === "mobile-manual.json"
      ? entry(item.source, {
          ...item.report,
          schema: "kanab-quest-mobile-manual-review-v2",
          manifestId: "placard-mobile-manual-2x10-v2",
        })
      : item);
    const result = analyzePlacardLaunchEvidence({
      reports,
      now: new Date("2026-09-05T13:00:00.000Z"),
    });
    const manualReview = result.requirements.find((check) => check.code === "manual-mobile-review");
    expect(manualReview?.passed).toBe(false);
    expect(manualReview?.detail).toContain("Preuve mobile obsolète");
  });

  it("rejects stale physical decisions hidden inside a freshly exported report", () => {
    const reports = completeReports().map((item) => {
      if (item.source !== "mobile-manual.json") return item;
      const profiles = structuredClone(item.report.profiles) as Array<{
        code: string;
        checks: Array<{ code: string; status: string; reviewedAt: string }>;
      }>;
      profiles.forEach((profile) => profile.checks.forEach((check) => {
        check.reviewedAt = "2026-07-01T12:00:00.000Z";
      }));
      return entry(item.source, { ...item.report, profiles });
    });
    const result = analyzePlacardLaunchEvidence({
      reports,
      now: new Date("2026-09-05T13:00:00.000Z"),
      maxAgeDays: 14,
    });
    expect(result.passed).toBe(false);
    const manualReview = result.requirements.find((check) => check.code === "manual-mobile-review");
    expect(manualReview?.passed).toBe(false);
    expect(manualReview?.detail).toContain("expiré");
  });

  it("rejects an incomplete market replay and a mismatched retro execution", () => {
    const reports = completeReports().map((item) => {
      if (item.source === "smoke-market.json") {
        return entry(item.source, {
          ...item.report,
          checks: { replayConfirmed: false, masteryMatchedPlan: true, receiptMatchesTarget: true },
        });
      }
      if (item.source === "producer-execute.json") {
        return entry(item.source, {
          ...item.report,
          counts: { flowerBoostersGranted: 1, heritagesGranted: 1 },
        });
      }
      return item;
    });
    const result = analyzePlacardLaunchEvidence({
      reports,
      now: new Date("2026-09-05T13:00:00.000Z"),
    });
    expect(result.passed).toBe(false);
    expect(result.requirements.find((check) => check.code === "smoke-market")?.passed).toBe(false);
    expect(result.requirements.find((check) => check.code === "retro-producer")?.passed).toBe(false);
  });

  it("rejects an equipment proof without an idempotent purchase and final inventory", () => {
    const reports = completeReports().map((item) => item.source === "smoke-equipment.json"
      ? entry(item.source, {
          ...item.report,
          checks: {
            replayConfirmed: false,
            receiptMatchesTarget: true,
            cashDeltaConfirmed: true,
            inventoryConfirmed: false,
            installationConfirmed: true,
            finalCashConfirmed: true,
          },
        })
      : item);
    const result = analyzePlacardLaunchEvidence({
      reports,
      now: new Date("2026-09-05T13:00:00.000Z"),
    });
    expect(result.passed).toBe(false);
    expect(result.requirements.find((check) => check.code === "smoke-equipment")?.passed).toBe(false);
  });

  it("rejects a bot challenge proof without a synchronized claim and replay protection", () => {
    const reports = completeReports().map((item) => item.source === "smoke-bot-challenge.json"
      ? entry(item.source, {
          ...item.report,
          checks: {
            ...item.report.checks as Record<string, unknown>,
            challengeClaimsSynced: false,
            noDoubleCreditConfirmed: false,
          },
        })
      : item);
    const result = analyzePlacardLaunchEvidence({
      reports,
      now: new Date("2026-09-05T13:00:00.000Z"),
    });
    expect(result.passed).toBe(false);
    expect(result.requirements.find((check) => check.code === "smoke-bot-challenge")?.passed).toBe(false);
  });

  it("rejects a load proof that omits the equipment or market API", () => {
    const reports = completeReports().map((item) => {
      if (item.source !== "load.json") return item;
      const byPath = structuredClone(item.report.byPath) as Record<string, unknown>;
      delete byPath["/api/arena/placard/equipment"];
      return entry(item.source, { ...item.report, byPath });
    });
    const result = analyzePlacardLaunchEvidence({
      reports,
      now: new Date("2026-09-05T13:00:00.000Z"),
    });
    expect(result.passed).toBe(false);
    const loadCheck = result.requirements.find((check) => check.code === "load-test");
    expect(loadCheck?.passed).toBe(false);
    expect(loadCheck?.detail).toContain("/api/arena/placard/equipment");
  });

  it("explains that a fresh v1 load proof is obsolete", () => {
    const reports = completeReports().map((item) => item.source === "load.json"
      ? entry(item.source, { ...item.report, schema: "kanab-quest-load-test-v1" })
      : item);
    const result = analyzePlacardLaunchEvidence({
      reports,
      now: new Date("2026-09-05T13:00:00.000Z"),
    });
    const loadCheck = result.requirements.find((check) => check.code === "load-test");
    expect(loadCheck?.passed).toBe(false);
    expect(loadCheck?.detail).toContain("Preuve de charge obsolète");
  });

  it("does not accept stale reports", () => {
    const result = analyzePlacardLaunchEvidence({
      reports: completeReports(),
      now: new Date("2026-10-05T13:00:00.000Z"),
      maxAgeDays: 14,
    });
    expect(result.passed).toBe(false);
    expect(result.freshReportCount).toBe(0);
  });

  it("keeps the CLI local, workspace-scoped and non-overwriting", () => {
    const source = readFileSync(
      join(process.cwd(), "scripts/verify-placard-launch-evidence.mjs"),
      "utf8",
    );
    expect(source).toContain("PLACARD_LAUNCH_EVIDENCE_ROOT");
    expect(source).toContain("evidenceRootFromWorkspace.startsWith(`..${sep}`)");
    expect(source).toContain('flag: "wx"');
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("readEnvValue");
    expect(source).not.toContain(".env.local");
  });
});
