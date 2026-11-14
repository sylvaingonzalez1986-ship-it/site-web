import { describe, expect, it } from "vitest";
import { createKqFlowerTrimReader, normalizeKqFlowerTrim } from "./kanab-quest-flower-trim";

const harvestedAt = "2026-11-10T10:00:00.000Z", serverNow = "2026-11-11T10:00:00.000Z";
const pending = (flowerId = "flower") => ({ flowerId, requiredWork: 6, completedWork: 0, completedAt: null,
  totalGrams: 120, completedGrams: 0 });
const reader = (trimLots: unknown[]) => createKqFlowerTrimReader({ serverNow, context: { trimLots } });
const unknown = { status: "unknown", totalGrams: null, completedGrams: null };

describe("confirmed flower trim prerequisite", () => {
  it("preserves individual pending lots beyond the completed-history limit", () => {
    const read = reader(Array.from({ length: 45 }, (_, index) => pending(String(index))));
    expect(read("44", harvestedAt)).toEqual({ status: "required", totalGrams: 120, completedGrams: 0 });
  });
  it("reports confirmed partial work without claiming a shared shift targets this lot", () => {
    const read = reader([{ ...pending(), completedGrams: 25, completedWork: 1.25 }]);
    expect(read("flower", harvestedAt)).toEqual({ status: "in-progress", totalGrams: 120, completedGrams: 25 });
    const noCredit = createKqFlowerTrimReader({ serverNow, context: { trimLots: [pending()] },
      state: { tasks: [{ kind: "trim", status: "running", trimQueue: true }] } });
    expect(noCredit("flower", harvestedAt).status).toBe("required");
  });
  it("allows completed and genuinely empty harvests only with consistent completion evidence", () => {
    for (const totalGrams of [0, 120]) {
      const read = reader([{ ...pending(), totalGrams, completedGrams: totalGrams, completedWork: 6, completedAt: serverNow }]);
      expect(read("flower", harvestedAt)).toEqual({ status: "ready", totalGrams, completedGrams: totalGrams });
    }
  });
  it("keeps legacy work units distinct from grams", () => {
    const read = reader([{ flowerId: "flower", requiredWork: 6, completedWork: 2, completedAt: null }]);
    expect(read("flower", harvestedAt)).toEqual({ status: "in-progress", totalGrams: null, completedGrams: null });
  });
  it("clears historical and archived completed flowers only when a complete pending ledger was read", () => {
    expect(reader([])("historical", harvestedAt)).toEqual({ status: "ready", totalGrams: null, completedGrams: null });
    const last30 = Array.from({ length: 30 }, (_, index) => ({ ...pending(String(index)), completedWork: 6,
      completedGrams: 120, completedAt: serverNow }));
    expect(reader(last30)("older-completion", harvestedAt).status).toBe("ready");
    for (const raw of [null, undefined, {}, { serverNow, context: {} }, { serverNow, context: { trimLots: null } }]) {
      expect(createKqFlowerTrimReader(raw)("flower", harvestedAt)).toEqual(unknown);
    }
  });
  it("does not exempt new flowers observed after the staff snapshot or at ambiguous database precision", () => {
    const read = reader([]);
    for (const createdAt of [serverNow, "2026-11-11T10:00:00.000001Z", "2026-11-11T10:01:00Z", undefined, "invalid"]) {
      expect(read("new-flower", createdAt)).toEqual(unknown);
    }
  });
  it.each([
    [null], [{ ...pending(), completedAt: undefined }], [{ ...pending(), completedGrams: -1 }],
    [{ ...pending(), completedAt: serverNow }], [{ ...pending(), requiredWork: 0 }],
    [{ ...pending(), totalGrams: "120" }], [pending(), pending()],
    [{ ...pending(), completedGrams: 120 }], [{ ...pending(), completedWork: 6 }],
  ])("does not turn an incomplete or inconsistent ledger into an exemption: %j", (...lots) => {
    const read = reader(lots);
    expect(read("flower", harvestedAt)).toEqual(unknown);
    expect(read("absent", harvestedAt)).toEqual(unknown);
  });
  it.each([undefined, null, {}, { status: "ready" }, { status: ["ready"], totalGrams: null, completedGrams: null }, { status: "running", totalGrams: 20, completedGrams: 1 },
    { status: "ready", totalGrams: 20, completedGrams: 1 }, { status: "in-progress", totalGrams: 20, completedGrams: 20 },
    { status: "required", totalGrams: 20, completedGrams: 1 }, { status: "ready", totalGrams: Infinity, completedGrams: Infinity },
  ])("normalizes missing and malformed client evidence to unknown: %j", value => {
    expect(normalizeKqFlowerTrim(value)).toEqual(unknown);
  });
});
