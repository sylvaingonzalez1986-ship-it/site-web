import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KqStorageStatus } from "@/components/placard/KqStorageStatus";
import { createKqOperationsLesson, getKqOperationsStorage } from "./kanab-quest-operations-lesson";
import { getKqOverflowJuryStage, getKqStorageJuryStage } from "./kanab-quest-storage-guidance";
import type { KqStorageSnapshot } from "./kanab-quest-api";

const base = getKqOperationsStorage(createKqOperationsLesson("warehouse")).lots[0];
function lot(flowerStatus: string, overflowUnits = 100): KqStorageSnapshot["lots"][number] {
  return { ...base, flowerStatus, projection: { ...base.projection, stage: "ready", capacity: {
    totalUnits: overflowUnits, allocations: [], overflowUnits, protectedUnits: 0, reservedCapacityUnits: 0,
    overflowDue: false, overflowDeadlineAt: "2026-10-29T18:00:00Z",
  } } };
}
function status(flowerStatus?: string, automaticOverflowSale?: boolean) {
  const projection = lot(flowerStatus ?? "").projection;
  projection.capacity!.automaticOverflowSale = automaticOverflowSale;
  return renderToStaticMarkup(createElement(KqStorageStatus, { storage: projection, flowerStatus, compact: true }));
}

describe("storage guidance follows the jury rather than curing maturity", () => {
  it.each(["available", "queued", "locked"])("does not offer a sale or automatic deadline for a mature %s flower", flowerStatus => {
    expect(getKqStorageJuryStage(flowerStatus)).toBe("before-jury");
    const html = status(flowerStatus, true);
    expect(html).toContain("vente après le jury");
    expect(html).not.toContain("vente automatique");
    expect(html).not.toContain("à ranger ou à vendre");
  });

  it("preserves the announced deadline of a judged historical lot without the newer flag", () => {
    expect(getKqStorageJuryStage("burned")).toBe("after-jury");
    expect(status("burned")).toContain("vente automatique au grossiste");
  });

  it("does not announce an automatic sale disabled for a warehouse lot, even with an old deadline", () => {
    const html = status("burned", false);
    expect(html).toContain("à ranger ou à vendre selon les offres");
    expect(html).not.toContain("vente automatique");
  });

  it.each([undefined, "", "unexpected"])("does not infer a verdict from maturity or a deadline when status is %s", flowerStatus => {
    const html = status(flowerStatus, true);
    expect(html).toContain("passage au jury à vérifier");
    expect(html).not.toContain("vente automatique");
    expect(html).not.toContain("à ranger ou à vendre");
  });

  it("does not use an invalid date as an automatic deadline", () => {
    const current = lot("burned");
    current.projection.capacity!.overflowDeadlineAt = "not-a-date";
    const html = renderToStaticMarkup(createElement(KqStorageStatus, { storage: current.projection, flowerStatus: current.flowerStatus }));
    expect(html).not.toContain("vente automatique");
    expect(html).not.toContain("Invalid Date");
  });
});

describe("inventory surplus guidance covers the reported quantity", () => {
  it("separates before-jury, judged and mixed surplus while ignoring fully protected lots", () => {
    expect(getKqOverflowJuryStage([lot("available"), lot("locked")], 200)).toBe("before-jury");
    expect(getKqOverflowJuryStage([lot("burned"), lot("available", 0)], 100)).toBe("after-jury");
    expect(getKqOverflowJuryStage([lot("burned"), lot("queued")], 200)).toBe("mixed");
  });

  it("keeps unknown or incomplete data neutral instead of recommending sale for the whole quantity", () => {
    expect(getKqOverflowJuryStage([lot("burned"), lot("unknown")], 200)).toBe("unknown");
    expect(getKqOverflowJuryStage([lot("burned")], 200)).toBe("unknown");
    const missing = lot("burned");
    delete missing.projection.capacity;
    expect(getKqOverflowJuryStage([lot("burned"), missing], 100)).toBe("unknown");
    expect(getKqOverflowJuryStage([], 100)).toBe("unknown");
  });

  it("supports fractional equivalent-flower volumes without changing the snapshot", () => {
    const lots = [lot("burned", 0.1), lot("burned", 0.2)];
    const before = structuredClone(lots);
    expect(getKqOverflowJuryStage(lots, 0.3)).toBe("after-jury");
    expect(lots).toEqual(before);
  });
});
