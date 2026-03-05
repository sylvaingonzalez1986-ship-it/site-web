export function computeReadingTimeMinutes(content: string, wordsPerMinute = 200): number {
  const safe = typeof content === "string" ? content.trim() : "";
  if (!safe) {
    return 1;
  }
  const words = safe.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / Math.max(120, wordsPerMinute)));
}
