export const KQ_RETRO_EXECUTION_CONFIRMATION = "EXECUTE_RETRO_BATCH";

export function buildKqRetroPreviewFingerprint(
  kind: "notebook" | "heritage" | "producer",
  cursor: number,
  preview: Record<string, unknown>,
) {
  const values = kind === "notebook"
    ? [preview.processed, preview.pending, preview.alreadyGranted, preview.nextCursor ?? "end"]
    : kind === "heritage"
      ? [preview.processedItems, preview.eligibleUnits, preview.pendingUnits, preview.alreadyAwarded, preview.nextCursor ?? "end"]
      : [
          preview.processed,
          preview.eligibleReviews,
          preview.pendingFlowerBoosters,
          preview.pendingHeritages,
          preview.alreadyComplete,
          preview.nextCursor ?? "end",
        ];
  const completion = kind === "producer" && ("pendingCompletions" in preview || "pendingCashCents" in preview)
    ? ["completion", preview.pendingCompletions ?? 0, preview.pendingCashCents ?? 0]
    : [];
  return [kind, cursor, ...values, ...completion].join(":");
}

export function isKqRetroExecutionAllowed(
  env: Record<string, string | undefined> = process.env,
) {
  return env.KQ_RETRO_ADMIN_WRITES_ALLOWED?.trim().toLowerCase() === "true";
}
