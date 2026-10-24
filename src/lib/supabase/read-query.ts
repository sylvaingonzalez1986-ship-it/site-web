import "server-only";

type ReadResult = {
  error: { message: string; code?: string; details?: string; hint?: string } | null;
  status: number;
};

const READ_TIMEOUT_MS = 5_000;
const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUSES = new Set([502, 503, 504, 520]);

function isNetworkError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "message" in error
    && typeof error.message === "string"
    && /^(?:TypeError: )?(?:fetch failed|Failed to fetch|Network request failed)$/.test(error.message);
}

/** Only use for reads: the factory must create a fresh query for each attempt. */
export async function readSupabaseQuery<T extends ReadResult>(
  context: string,
  query: (signal: AbortSignal) => PromiseLike<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    // A fresh signal bounds each attempt and opts out of Next fetch memoization,
    // so a retry can reach Supabase instead of reusing a rejected fetch promise.
    const signal = AbortSignal.timeout(READ_TIMEOUT_MS);
    let result: T;
    try {
      result = await query(signal);
    } catch (error) {
      if (!isNetworkError(error) && !signal.aborted) {
        throw error;
      }
      if (attempt === MAX_ATTEMPTS - 1) {
        const message = error instanceof Error ? error.message : "Read request failed";
        throw new Error(`[supabase:${context}] ${message}`, { cause: error });
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
      continue;
    }

    if (!result.error) {
      return result;
    }

    const retryable = RETRYABLE_STATUSES.has(result.status)
      || (result.status === 0 && (isNetworkError(result.error) || signal.aborted));
    if (!retryable || attempt === MAX_ATTEMPTS - 1) {
      // Keep the SDK's transport cause in server diagnostics. Throwing also lets
      // Next preserve a valid cached store instead of caching empty/default data.
      throw new Error(`[supabase:${context}] ${result.error.message}`, { cause: result.error });
    }

    await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
  }
}
