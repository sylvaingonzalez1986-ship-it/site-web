import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readSupabaseQuery } from "./read-query";

type QueryError = { message: string; code?: string; details?: string; hint?: string };
type QueryResult = { error: QueryError | null; status: number; data: unknown };

const context = "read public page_sections";
const successfulResult: QueryResult = { error: null, status: 200, data: { id: 1 } };
const failedResult = (error: QueryError, status = 0): QueryResult => ({
  error,
  status,
  data: null,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("public Supabase read recovery", () => {
  it("returns the original successful response after one bounded request", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const query = vi.fn().mockResolvedValue(successfulResult);

    expect(await readSupabaseQuery(context, query)).toBe(successfulResult);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
    expect(timeout).toHaveBeenCalledExactlyOnceWith(5_000);
  });

  it.each([
    "TypeError: fetch failed",
    "TypeError: Failed to fetch",
    "TypeError: Network request failed",
  ])("recovers a status-zero %s failure after 500 ms", async (message) => {
    const query = vi.fn()
      .mockResolvedValueOnce(failedResult({ message }))
      .mockResolvedValue(successfulResult);
    const pending = readSupabaseQuery(context, query);

    await vi.advanceTimersByTimeAsync(499);
    expect(query).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);

    expect(await pending).toBe(successfulResult);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it.each([502, 503, 504, 520])("recovers a transient HTTP %s response", async (status) => {
    const query = vi.fn()
      .mockResolvedValueOnce(failedResult({ message: "Service temporarily unavailable" }, status))
      .mockResolvedValue(successfulResult);
    const pending = readSupabaseQuery(context, query);

    await vi.advanceTimersByTimeAsync(500);

    expect(await pending).toBe(successfulResult);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("waits 500, 1,000 then 2,000 ms and preserves the final error after four failed reads", async () => {
    const firstError = { message: "TypeError: fetch failed", details: "first transport failure" };
    const lastError = {
      message: "TypeError: fetch failed",
      code: "",
      details: "Caused by ECONNRESET; diagnostic-private-token",
      hint: "",
    };
    const query = vi.fn()
      .mockResolvedValueOnce(failedResult(firstError))
      .mockResolvedValue(failedResult(lastError));
    const pending = readSupabaseQuery(context, query).catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(499);
    expect(query).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(query).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(999);
    expect(query).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(query).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1_999);
    expect(query).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1);

    const error = await pending;
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      message: `[supabase:${context}] TypeError: fetch failed`, attempts: 4, elapsedMs: 3_500,
    });
    expect((error as Error).cause).toBe(lastError);
    expect((error as Error).message).not.toContain("diagnostic-private-token");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(query).toHaveBeenCalledTimes(4);
  });

  it("recovers when an outage outlasts the former 750 ms retry window", async () => {
    const recoversAt = Date.now() + 3_000;
    const query = vi.fn(async () => Date.now() < recoversAt
      ? failedResult({ message: "TypeError: fetch failed" }) : successfulResult);
    const pending = readSupabaseQuery(context, query);

    await vi.advanceTimersByTimeAsync(3_500);

    expect(await pending).toBe(successfulResult);
    expect(query).toHaveBeenCalledTimes(4);
  });

  it("jitters retries so concurrent readers do not always restart together", async () => {
    vi.mocked(Math.random).mockReturnValue(0.999);
    const query = vi.fn().mockResolvedValueOnce(failedResult({ message: "TypeError: fetch failed" }))
      .mockResolvedValue(successfulResult);
    const pending = readSupabaseQuery(context, query);

    await vi.advanceTimersByTimeAsync(749);
    expect(query).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toBe(successfulResult);
  });

  it("recovers a socket closed while reading a response body", async () => {
    const query = vi.fn().mockResolvedValueOnce(failedResult({
      message: "TypeError: terminated",
      details: "TypeError: terminated\n\nCaused by: SocketError: other side closed (UND_ERR_SOCKET)",
    })).mockResolvedValue(successfulResult);
    const pending = readSupabaseQuery(context, query);

    await vi.advanceTimersByTimeAsync(500);

    expect(await pending).toBe(successfulResult);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("recovers a rejected connection error identified by its cause", async () => {
    const query = vi.fn().mockRejectedValueOnce(new TypeError("terminated", {
      cause: Object.assign(new Error("other side closed"), { code: "UND_ERR_SOCKET" }),
    })).mockResolvedValue(successfulResult);
    const pending = readSupabaseQuery(context, query);

    await vi.advanceTimersByTimeAsync(500);

    expect(await pending).toBe(successfulResult);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it.each([
    { status: 401, code: "PGRST301", message: "Invalid JWT" },
    { status: 403, code: "42501", message: "permission denied for table page_sections" },
    { status: 400, code: "42703", message: "column updated_at does not exist" },
    { status: 404, code: "PGRST205", message: "Could not find the table" },
  ])("does not retry a permanent HTTP $status / $code failure", async ({ status, ...originalError }) => {
    const query = vi.fn().mockResolvedValue(failedResult(originalError, status));

    await expect(readSupabaseQuery(context, query)).rejects.toMatchObject({
      message: `[supabase:${context}] ${originalError.message}`,
      cause: originalError,
    });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("does not retry a status-zero response that describes invalid data", async () => {
    const originalError = { message: "SyntaxError: Unexpected token in JSON" };
    const query = vi.fn().mockResolvedValue(failedResult(originalError));

    await expect(readSupabaseQuery(context, query)).rejects.toMatchObject({
      message: `[supabase:${context}] ${originalError.message}`,
      cause: originalError,
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("retries a rejected fetch promise", async () => {
    const query = vi.fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValue(successfulResult);
    const pending = readSupabaseQuery(context, query);

    await vi.advanceTimersByTimeAsync(500);

    expect(await pending).toBe(successfulResult);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it.each([
    new TypeError("Cannot read properties of undefined"),
    new Error("Invalid query configuration"),
    new DOMException("Manually cancelled", "AbortError"),
  ])("does not retry the unrelated exception $name: $message", async (originalError) => {
    const query = vi.fn().mockRejectedValue(originalError);

    await expect(readSupabaseQuery(context, query)).rejects.toBe(originalError);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("bounds all requests and backoff to 16 seconds if every attempt times out", async () => {
    const startedAt = Date.now();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockImplementation((milliseconds) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException("Timed out", "TimeoutError")), milliseconds);
      return controller.signal;
    });
    const originalError = { message: "TimeoutError: The operation was aborted due to timeout" };
    const signals: AbortSignal[] = [];
    const query = vi.fn((signal: AbortSignal) => {
      signals.push(signal);
      expect(signal.aborted).toBe(false);
      return new Promise<QueryResult>((resolve) => {
        signal.addEventListener("abort", () => resolve(failedResult(originalError)), { once: true });
      });
    });
    const pending = readSupabaseQuery(context, query).catch((error: unknown) => ({ error, endedAt: Date.now() }));

    await vi.advanceTimersByTimeAsync(16_000);

    expect(await pending).toMatchObject({
      endedAt: startedAt + 16_000,
      error: { message: `[supabase:${context}] ${originalError.message}`, cause: originalError, attempts: 3, elapsedMs: 16_000 },
    });
    expect(query).toHaveBeenCalledTimes(3);
    expect(timeout.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([5_000, 5_000, 4_500]);
    expect(new Set(signals).size).toBe(3);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });
});
