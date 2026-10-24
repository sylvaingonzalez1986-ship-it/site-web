import "server-only";

type ReadResult = {
  error: { message: string; code?: string; details?: string; hint?: string } | null;
  status: number;
};

const READ_TIMEOUT_MS = 5_000;
const READ_BUDGET_MS = 16_000;
const MAX_ATTEMPTS = 4;
const RETRYABLE_STATUSES = new Set([502, 503, 504, 520]);
const CONNECTION_ERROR = /\b(?:UND_ERR_SOCKET|ECONNRESET|EPIPE)\b/;

function isNetworkError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("message" in error && typeof error.message === "string"
    && /^(?:TypeError: )?(?:fetch failed|Failed to fetch|Network request failed)$/.test(error.message)) return true;
  if ("code" in error && typeof error.code === "string" && CONNECTION_ERROR.test(error.code)) return true;
  if ("cause" in error && typeof error.cause === "object" && error.cause !== null
    && "code" in error.cause && typeof error.cause.code === "string"
    && CONNECTION_ERROR.test(error.cause.code)) return true;
  // PostgREST serializes a fetch cause into details, including body-read errors
  // whose message is "TypeError: terminated" rather than "fetch failed".
  return "details" in error && typeof error.details === "string" && CONNECTION_ERROR.test(error.details);
}

/** Only use for reads: the factory must create a fresh query for each attempt. */
export async function readSupabaseQuery<T extends ReadResult>(
  context: string,
  query: (signal: AbortSignal) => PromiseLike<T>,
): Promise<T> {
  const startedAt = Date.now();
  let attempts = 0;
  let failure: unknown;

  while (attempts < MAX_ATTEMPTS) {
    const remaining = READ_BUDGET_MS - (Date.now() - startedAt);
    if (remaining <= 0) break;
    // A fresh signal bounds each attempt and opts out of Next fetch memoization,
    // so a retry can reach Supabase instead of reusing a rejected fetch promise.
    const signal = AbortSignal.timeout(Math.min(READ_TIMEOUT_MS, remaining));
    attempts += 1;
    let retryable: boolean;
    try {
      const result = await query(signal);
      if (!result.error) return result;
      failure = result.error;
      retryable = RETRYABLE_STATUSES.has(result.status)
        || (result.status === 0 && (isNetworkError(result.error) || signal.aborted));
    } catch (error) {
      if (!isNetworkError(error) && !signal.aborted) {
        throw error;
      }
      failure = error;
      retryable = true;
    }

    if (!retryable || attempts === MAX_ATTEMPTS) break;

    // Allow a brief outage to clear without synchronizing concurrent readers.
    // Backoff and requests share a budget so slow attempts cannot stack forever.
    const delay = 500 * 2 ** (attempts - 1) + Math.floor(Math.random() * 251);
    if (Date.now() - startedAt + delay >= READ_BUDGET_MS) break;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  const message = typeof failure === "object" && failure !== null && "message" in failure
    && typeof failure.message === "string" ? failure.message : "Read request failed";
  // Keep the SDK's transport cause in server diagnostics. Throwing also lets
  // Next preserve a valid cached store instead of caching empty/default data.
  throw Object.assign(new Error(`[supabase:${context}] ${message}`, { cause: failure }), {
    attempts,
    elapsedMs: Date.now() - startedAt,
  });
}
