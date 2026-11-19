export function normalizeAnalysisUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    if (trimmed.startsWith("/")) {
      const origin = "https://analysis.invalid";
      return new URL(trimmed, origin).origin === origin ? trimmed : null;
    }
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return null;
}
