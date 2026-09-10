import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const component = readFileSync(
  join(process.cwd(), "src/components/admin/AdminPlacardLaunchEvidence.tsx"),
  "utf8",
);
const operations = readFileSync(
  join(process.cwd(), "src/components/admin/AdminPlacardOperationsPanel.tsx"),
  "utf8",
);

describe("Placard launch evidence admin panel", () => {
  it("is integrated into operations and imports only local JSON reports", () => {
    expect(operations).toContain('import { AdminPlacardLaunchEvidence }');
    expect(operations).toContain("<AdminPlacardLaunchEvidence");
    expect(operations).toContain("serverReadyForActivation={readiness?.readyForActivation === true}");
    expect(operations).toContain("serverBlockers={readiness?.blockers ?? []}");
    expect(component).toContain('accept="application/json,.json"');
    expect(component).toContain("MAX_REPORT_BYTES");
    expect(component).toContain("importKqLaunchEvidenceReport");
    expect(component).not.toContain("fetch(");
  });

  it("shows freshness, the next action and all requirement details", () => {
    expect(component).toContain("combined.nextAction");
    expect(component).toContain("combined.readyForActivationWindow");
    expect(component).toContain("summary.fresh");
    expect(component).toContain("report.requirements.map");
    expect(component).toContain("requirement.detail");
    expect(component).toContain("12 preuves obligatoires");
  });
});
