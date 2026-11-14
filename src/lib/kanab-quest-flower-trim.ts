/** A confirmed prerequisite, separate from curing and from staff shift activity. */
export type KqFlowerTrim = {
  status: "unknown" | "required" | "in-progress" | "ready";
  totalGrams: number | null;
  completedGrams: number | null;
};

const unknownTrim = (): KqFlowerTrim => ({ status: "unknown", totalGrams: null, completedGrams: null });
const record = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" && !Array.isArray(value)
  ? value as Record<string, unknown> : null;
const mass = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const date = (value: unknown) => typeof value === "string" ? Date.parse(value) : NaN;

/** Old or malformed responses must never grant jury eligibility. */
export function normalizeKqFlowerTrim(value: unknown): KqFlowerTrim {
  const trim = record(value);
  if (!trim || typeof trim.status !== "string" || !["required", "in-progress", "ready"].includes(trim.status)) return unknownTrim();
  const { totalGrams, completedGrams } = trim;
  if (totalGrams === null && completedGrams === null) {
    return { status: trim.status as KqFlowerTrim["status"], totalGrams, completedGrams };
  }
  if (!mass(totalGrams) || !mass(completedGrams) || completedGrams > totalGrams
    || trim.status === "required" && (completedGrams !== 0 || totalGrams === 0)
    || trim.status === "in-progress" && (completedGrams === 0 || completedGrams === totalGrams)
    || trim.status === "ready" && completedGrams !== totalGrams) return unknownTrim();
  return { status: trim.status as KqFlowerTrim["status"], totalGrams, completedGrams };
}

/**
 * Staff snapshots include EVERY pending trim lot, plus the latest 30 completed
 * lots. Absence proves no remaining work, not that a harvest was never trimmed.
 * Read once per snapshot, without querying private tables or extrapolating work.
 */
export function createKqFlowerTrimReader(value: unknown): (flowerId: string, createdAt: unknown) => KqFlowerTrim {
  const raw = record(value), context = record(raw?.context);
  const serverNow = date(raw?.serverNow);
  if (!Number.isFinite(serverNow) || !Array.isArray(context?.trimLots)) return () => unknownTrim();
  const byFlower = new Map<string, KqFlowerTrim>();
  for (const value of context.trimLots) {
    const lot = record(value);
    if (!lot || typeof lot.flowerId !== "string" || !lot.flowerId || byFlower.has(lot.flowerId)
      || !mass(lot.requiredWork) || lot.requiredWork === 0 || !mass(lot.completedWork)
      || lot.completedWork > lot.requiredWork || lot.completedAt !== null && !Number.isFinite(date(lot.completedAt))) return () => unknownTrim();
    const completed = lot.completedAt !== null;
    if (completed !== (lot.completedWork === lot.requiredWork)) return () => unknownTrim();
    const hasMass = lot.totalGrams !== undefined || lot.completedGrams !== undefined;
    const trim = normalizeKqFlowerTrim({
      status: completed ? "ready" : lot.completedWork > 0 || mass(lot.completedGrams) && lot.completedGrams > 0 ? "in-progress" : "required",
      totalGrams: hasMass ? lot.totalGrams : null,
      completedGrams: hasMass ? lot.completedGrams : null,
    });
    if (trim.status === "unknown") return () => unknownTrim();
    byFlower.set(lot.flowerId, trim);
  }
  return (flowerId, createdAt) => {
    const known = byFlower.get(flowerId);
    if (known) return { ...known };
    // A harvest created during the subsequent reads may not be in this ledger.
    // Strict ordering also protects sub-millisecond database timestamps.
    return date(createdAt) < serverNow ? { status: "ready", totalGrams: null, completedGrams: null } : unknownTrim();
  };
}
