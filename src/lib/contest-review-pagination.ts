export type ContestReviewCursor = { publishedAt: string; id: string };

export function parseContestReviewCursor(value?: string | null): ContestReviewCursor | null {
  if (!value) return null;
  if (value.length > 512) throw new Error("Curseur d’avis invalide.");
  try {
    const cursor = JSON.parse(value) as Partial<ContestReviewCursor> | null;
    if (!cursor || typeof cursor.publishedAt !== "string" || !Number.isFinite(Date.parse(cursor.publishedAt)) ||
        typeof cursor.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cursor.id)) throw new Error();
    return { publishedAt: cursor.publishedAt, id: cursor.id };
  } catch {
    throw new Error("Curseur d’avis invalide.");
  }
}

export function createContestReviewCursor(row: { id: string; reviewedAt?: string | null; createdAt: string }): string {
  return JSON.stringify({ publishedAt: row.reviewedAt ?? row.createdAt, id: row.id });
}
