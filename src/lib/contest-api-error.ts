const INTERNAL_ERROR_PATTERNS = [
  /^\[supabase:/i,
  /\b(postgres|postgrest|relation|column|constraint|rpc_)\b/i,
  /\b(22P02|23[0-9A-Z]{3}|42[0-9A-Z]{3}|PGRST[0-9]+)\b/i,
];

export function getPublicContestError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message.trim() : "";
  if (!message || INTERNAL_ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
    return fallback;
  }
  return message.slice(0, 240);
}
