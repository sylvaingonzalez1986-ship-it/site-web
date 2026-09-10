import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildKqRetroEvidence } from "@/lib/kanab-quest-retro-evidence";

describe("Kanab Quest retro-attribution evidence", () => {
  it("keeps only the notebook counters needed for a launch proof", () => {
    const evidence = buildKqRetroEvidence("notebook", {
      mode: "preview",
      cursor: 20,
      nextCursor: 40,
      previewFingerprint: "notebook:20:20:3:17:40",
      writeAllowed: true,
      live: true,
      processed: 20,
      pending: 3,
      alreadyGranted: 17,
      email: "secret@example.test",
      customerId: "private-id",
    }, "2026-09-05T10:00:00.000Z");

    expect(evidence).toMatchObject({
      schema: "kanab-quest-retro-evidence-v1",
      kind: "notebook",
      mode: "preview",
      cursor: 20,
      nextCursor: 40,
      gates: { live: true, writeAllowed: true },
      counts: { processed: 20, pending: 3, alreadyGranted: 17, granted: 0 },
      pending: 3,
      readyToExecute: true,
    });
    expect(JSON.stringify(evidence)).not.toContain("secret@example.test");
    expect(JSON.stringify(evidence)).not.toContain("private-id");
  });

  it("separates producer pending rewards and execution results", () => {
    const preview = buildKqRetroEvidence("producer", {
      mode: "preview",
      cursor: 0,
      nextCursor: null,
      previewFingerprint: "producer:0:8:4:2:1:1:end",
      writeAllowed: true,
      live: true,
      processed: 8,
      eligibleReviews: 4,
      pendingFlowerBoosters: 2,
      pendingHeritages: 1,
      alreadyComplete: 1,
    });
    const execution = buildKqRetroEvidence("producer", {
      mode: "execute",
      cursor: 0,
      nextCursor: null,
      previewFingerprint: "producer:0:8:4:2:1:1:end",
      writeAllowed: true,
      live: true,
      flowerBoostersGranted: 2,
      heritagesGranted: 1,
    });

    expect(preview).toMatchObject({ pending: 3, batchComplete: true, readyToExecute: true });
    expect(execution).toMatchObject({
      mode: "execute",
      counts: { flowerBoostersGranted: 2, heritagesGranted: 1 },
      readyToExecute: false,
    });
  });

  it("never treats a locked or empty heritage preview as executable", () => {
    expect(buildKqRetroEvidence("heritage", {
      mode: "preview",
      cursor: 0,
      nextCursor: 25,
      previewFingerprint: "heritage:0:25:0:0:25:25",
      writeAllowed: false,
      pendingUnits: 0,
    })).toMatchObject({ pending: 0, readyToExecute: false });
  });

  it("keeps proof downloads available for all three admin retro tools", () => {
    const operations = readFileSync(
      join(process.cwd(), "src/components/admin/AdminPlacardOperationsPanel.tsx"),
      "utf8",
    );
    const producers = readFileSync(
      join(process.cwd(), "src/components/admin/AdminProducerRewardCampaigns.tsx"),
      "utf8",
    );
    expect(operations).toContain('buildKqRetroEvidence("notebook", payload)');
    expect(operations).toContain('buildKqRetroEvidence("heritage", payload)');
    expect(operations).toContain("downloadKqRetroEvidence(notebookRetroEvidence)");
    expect(operations).toContain("downloadKqRetroEvidence(heritageRetroEvidence)");
    expect(producers).toContain('buildKqRetroEvidence("producer", payload)');
    expect(producers).toContain("downloadKqRetroEvidence(retroEvidence)");
  });
});
