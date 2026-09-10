import { describe, expect, it } from "vitest";
import {
  getKqCombinedLaunchStatus,
  importKqLaunchEvidenceReport,
  KQ_LAUNCH_EVIDENCE_REQUIREMENTS,
  parseStoredKqLaunchEvidenceReport,
  summarizeKqLaunchEvidenceReport,
} from "@/lib/kanab-quest-launch-evidence-report";

function report(overrides: Record<string, unknown> = {}) {
  return {
    schema: "kanab-quest-launch-evidence-v1",
    generatedAt: "2026-09-05T12:00:00.000Z",
    maxAgeDays: 14,
    requirements: KQ_LAUNCH_EVIDENCE_REQUIREMENTS.map((code) => ({
      code,
      label: `Preuve ${code}`,
      passed: true,
      detail: "Validation complète.",
      sources: [{ source: `private/${code}.json` }],
    })),
    invalidReports: [],
    passed: true,
    ...overrides,
  };
}

describe("Placard consolidated launch evidence report", () => {
  it("imports only the sanitized summary of all twelve requirements", () => {
    const imported = importKqLaunchEvidenceReport(report());

    expect(imported.requirements).toHaveLength(12);
    expect(imported).not.toHaveProperty("invalidReports");
    expect(imported.requirements[0]).not.toHaveProperty("sources");
    expect(imported).toMatchObject({ passed: true, invalidReportCount: 0, maxAgeDays: 14 });
  });

  it("rejects missing, duplicated or globally inconsistent requirements", () => {
    const missing = KQ_LAUNCH_EVIDENCE_REQUIREMENTS.slice(1).map((code) => ({
      code,
      label: code,
      passed: true,
      detail: "OK",
    }));
    expect(() => importKqLaunchEvidenceReport(report({ requirements: missing }))).toThrow("12 preuves");
    expect(() => importKqLaunchEvidenceReport(report({ passed: false }))).toThrow("décision globale");
  });

  it("identifies the first concrete blocker and the equipment smoke action", () => {
    const requirements = KQ_LAUNCH_EVIDENCE_REQUIREMENTS.map((code) => ({
      code,
      label: code,
      passed: code !== "smoke-equipment",
      detail: code === "smoke-equipment" ? "Preuve locale valide absente." : "OK",
    }));
    const imported = importKqLaunchEvidenceReport(report({ requirements, passed: false }));
    const summary = summarizeKqLaunchEvidenceReport(imported, new Date("2026-09-05T13:00:00.000Z"));

    expect(summary).toMatchObject({ passedCount: 11, blockedCount: 1, fresh: true, readyForLaunch: false });
    expect(summary.nextAction).toContain("achat-installation");
  });

  it("expires a formerly complete report and safely ignores broken local storage", () => {
    const imported = importKqLaunchEvidenceReport(report());
    const summary = summarizeKqLaunchEvidenceReport(imported, new Date("2026-10-05T13:00:00.000Z"));

    expect(summary).toMatchObject({ fresh: false, readyForLaunch: false });
    expect(summary.nextAction).toContain("expiré");
    expect(parseStoredKqLaunchEvidenceReport("not-json")).toBeNull();
    expect(parseStoredKqLaunchEvidenceReport(JSON.stringify(imported))).toEqual(imported);
  });

  it("requires both fresh evidence and a ready server preflight", () => {
    const imported = importKqLaunchEvidenceReport(report());
    const common = {
      report: imported,
      serverReadinessAvailable: true,
      serverBlockers: [] as string[],
      now: new Date("2026-09-05T13:00:00.000Z"),
    };

    expect(getKqCombinedLaunchStatus({
      ...common,
      serverReadyForActivation: false,
      serverBlockers: ["Collection La Botte encore inactive"],
    })).toMatchObject({
      code: "server-blocked",
      readyForActivationWindow: false,
      nextAction: expect.stringContaining("Collection La Botte"),
    });
    expect(getKqCombinedLaunchStatus({
      ...common,
      serverReadyForActivation: true,
    })).toMatchObject({ code: "ready", readyForActivationWindow: true });
  });

  it("never allows server readiness to hide missing or expired evidence", () => {
    expect(getKqCombinedLaunchStatus({
      report: null,
      serverReadinessAvailable: true,
      serverReadyForActivation: true,
      serverBlockers: [],
    })).toMatchObject({ code: "missing-evidence", readyForActivationWindow: false });

    const imported = importKqLaunchEvidenceReport(report());
    expect(getKqCombinedLaunchStatus({
      report: imported,
      serverReadinessAvailable: true,
      serverReadyForActivation: true,
      serverBlockers: [],
      now: new Date("2026-10-05T13:00:00.000Z"),
    })).toMatchObject({ code: "evidence-blocked", readyForActivationWindow: false });
  });
});
