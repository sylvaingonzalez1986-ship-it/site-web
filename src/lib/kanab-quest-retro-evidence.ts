export type KqRetroEvidenceKind = "notebook" | "heritage" | "producer";
export type KqRetroEvidenceMode = "preview" | "execute";

const COUNT_FIELDS: Record<KqRetroEvidenceKind, readonly string[]> = {
  notebook: ["processed", "pending", "alreadyGranted", "granted"],
  heritage: ["processedItems", "eligibleUnits", "pendingUnits", "alreadyAwarded", "awarded"],
  producer: [
    "processed",
    "eligibleReviews",
    "pendingFlowerBoosters",
    "pendingHeritages",
    "alreadyComplete",
    "flowerBoostersGranted",
    "heritagesGranted",
  ],
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function toSafeCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
}

function pendingCount(kind: KqRetroEvidenceKind, source: Record<string, unknown>) {
  if (kind === "notebook") return toSafeCount(source.pending);
  if (kind === "heritage") return toSafeCount(source.pendingUnits);
  return toSafeCount(source.pendingFlowerBoosters) + toSafeCount(source.pendingHeritages);
}

export function buildKqRetroEvidence(
  kind: KqRetroEvidenceKind,
  payload: unknown,
  generatedAt = new Date().toISOString(),
) {
  const source = asRecord(payload);
  const mode: KqRetroEvidenceMode = source.mode === "execute" ? "execute" : "preview";
  const cursor = toSafeCount(source.cursor);
  const parsedNextCursor = Number(source.nextCursor);
  const nextCursor = source.nextCursor === null
    ? null
    : Number.isSafeInteger(parsedNextCursor) && parsedNextCursor >= 0
      ? parsedNextCursor
      : null;
  const previewFingerprint = typeof source.previewFingerprint === "string"
    ? source.previewFingerprint.trim()
    : "";
  const counts = Object.fromEntries(
    COUNT_FIELDS[kind].map((field) => [field, toSafeCount(source[field])]),
  );
  const pending = pendingCount(kind, source);

  return {
    schema: "kanab-quest-retro-evidence-v1" as const,
    generatedAt,
    kind,
    mode,
    cursor,
    nextCursor,
    previewFingerprint,
    gates: {
      live: source.live === true,
      writeAllowed: source.writeAllowed === true,
    },
    counts,
    pending,
    batchComplete: nextCursor === null,
    readyToExecute: mode === "preview"
      && source.live === true
      && source.writeAllowed === true
      && previewFingerprint.length > 0
      && pending > 0,
  };
}

export type KqRetroEvidence = ReturnType<typeof buildKqRetroEvidence>;

export function downloadKqRetroEvidence(evidence: KqRetroEvidence) {
  const url = URL.createObjectURL(new Blob(
    [`${JSON.stringify(evidence, null, 2)}\n`],
    { type: "application/json" },
  ));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `placard-retro-${evidence.kind}-${evidence.mode}-${evidence.generatedAt.replace(/[:.]/g, "-")}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
