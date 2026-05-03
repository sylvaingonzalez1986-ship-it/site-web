const MOJIBAKE_CHARS_REGEX = /[ÃƒÃ‚Ã¢ï¿½]/g;

export function repairLikelyMojibake(value: string): string {
  const originalNoise = (value.match(MOJIBAKE_CHARS_REGEX) ?? []).length;
  if (originalNoise === 0) {
    return value;
  }

  try {
    const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0) & 0xff);
    const repaired = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const repairedNoise = (repaired.match(MOJIBAKE_CHARS_REGEX) ?? []).length;
    return repairedNoise < originalNoise ? repaired : value;
  } catch {
    return value;
  }
}

export function sanitizeDisplayText(value: unknown, fallback = ""): string {
  const text = typeof value === "string" ? value : fallback;
  return repairLikelyMojibake(text);
}

export function sanitizeNestedText<T>(value: T): T {
  if (typeof value === "string") {
    return repairLikelyMojibake(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeNestedText(item)) as T;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      sanitizeNestedText(item),
    ]);
    return Object.fromEntries(entries) as T;
  }

  return value;
}

export function countReplacementCharacters(value: unknown): number {
  if (typeof value === "string") {
    return (value.match(/\uFFFD/g) ?? []).length;
  }

  if (Array.isArray(value)) {
    return value.reduce((count, item) => count + countReplacementCharacters(item), 0);
  }

  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).reduce<number>(
      (count, item) => count + countReplacementCharacters(item),
      0,
    );
  }

  return 0;
}
