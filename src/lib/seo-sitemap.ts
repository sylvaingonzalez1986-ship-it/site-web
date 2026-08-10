export function parseSeoDate(value: string | Date | null | undefined): Date | undefined {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : undefined;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : undefined;
}

export function mostRecentSeoDate(
  values: Array<string | Date | null | undefined>,
): Date | undefined {
  let latest: Date | undefined;

  for (const value of values) {
    const candidate = parseSeoDate(value);
    if (!candidate || (latest && candidate.getTime() <= latest.getTime())) {
      continue;
    }
    latest = candidate;
  }

  return latest;
}
