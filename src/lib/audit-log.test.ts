import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({
  after: vi.fn(), client: vi.fn(), from: vi.fn(), insert: vi.fn(), abortSignal: vi.fn(),
  sentryClient: vi.fn(), isolation: vi.fn(), scope: vi.fn(), processor: vi.fn(), capture: vi.fn(), flush: vi.fn(),
}));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: mocks.client }));
vi.mock("@sentry/nextjs", () => ({
  getClient: mocks.sentryClient, withIsolationScope: mocks.isolation, withScope: mocks.scope,
  captureMessage: mocks.capture, flush: mocks.flush,
}));
import { logAuditEvent } from "@/lib/audit-log";

const callbacks: Array<() => Promise<void>> = [];
const sensitiveError = new Error("secret-token actor@example.invalid postgres://user:password@example.invalid");

beforeEach(() => {
  vi.resetAllMocks();
  callbacks.length = 0;
  mocks.after.mockImplementation((callback: () => Promise<void>) => callbacks.push(callback));
  mocks.client.mockReturnValue({ from: mocks.from });
  mocks.from.mockReturnValue({ insert: mocks.insert });
  mocks.insert.mockReturnValue({ abortSignal: mocks.abortSignal });
  mocks.abortSignal.mockResolvedValue({ error: null });
  mocks.sentryClient.mockReturnValue({ getOptions: () => ({ enabled: true }) });
  mocks.isolation.mockImplementation(callback => callback());
  mocks.scope.mockImplementation(callback => callback({ addEventProcessor: mocks.processor }));
  mocks.flush.mockResolvedValue(true);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("audit insertion request lifetime", () => {
  it("defers the client and keeps the lifecycle callback pending until the database completes", async () => {
    let finish!: (result: { error: null }) => void;
    mocks.abortSignal.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    expect(logAuditEvent({ eventType: "admin_login" })).toBeUndefined();
    expect(callbacks).toHaveLength(1);
    expect(mocks.client).not.toHaveBeenCalled();
    let completed = false;
    const pending = callbacks[0]().then(() => { completed = true; });
    await Promise.resolve();
    expect(completed).toBe(false);
    expect(mocks.from).toHaveBeenCalledWith("audit_logs");
    expect(mocks.insert).toHaveBeenCalledOnce();
    finish({ error: null });
    await pending;
    expect(completed).toBe(true);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("captures event data before callers mutate it and preserves separate events", async () => {
    const metadata = { reason: "wrong_password", nested: { attempt: 1 } };
    logAuditEvent({ eventType: "admin_login_failed", actorEmail: "fixture@example.invalid", ip: "192.0.2.1", metadata });
    metadata.reason = "modified";
    metadata.nested.attempt = 9;
    logAuditEvent({ eventType: "admin_logout" });
    await Promise.all(callbacks.map(callback => callback()));
    expect(mocks.insert).toHaveBeenNthCalledWith(1, {
      event_type: "admin_login_failed", actor_email: "fixture@example.invalid", ip: "192.0.2.1",
      metadata: { reason: "wrong_password", nested: { attempt: 1 } },
    });
    expect(mocks.insert).toHaveBeenNthCalledWith(2, { event_type: "admin_logout", actor_email: "", ip: "", metadata: {} });
  });

  it.each(["provider", "transport", "client"])("contains %s errors and exposes only a constant failure signal", async failure => {
    if (failure === "provider") mocks.abortSignal.mockResolvedValue({ error: { message: sensitiveError.message, details: sensitiveError.message } });
    if (failure === "transport") mocks.abortSignal.mockRejectedValue(sensitiveError);
    if (failure === "client") mocks.client.mockImplementation(() => { throw sensitiveError; });
    expect(() => logAuditEvent({ eventType: "admin_login", metadata: { private: "secret-metadata" } })).not.toThrow();
    await expect(callbacks[0]()).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledExactlyOnceWith("[audit-log] audit_log_write_failed");
    expect(mocks.insert.mock.calls.length).toBeLessThanOrEqual(1); // No ambiguous-write retry/duplicate.
  });

  it("signals unavailable request scheduling without starting an untracked promise", () => {
    mocks.after.mockImplementation(() => { throw sensitiveError; });
    expect(() => logAuditEvent({ eventType: "admin_login" })).not.toThrow();
    expect(mocks.client).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledExactlyOnceWith("[audit-log] audit_log_schedule_failed");
  });

  it("removes all inherited request data and attachments from the Sentry alert", async () => {
    mocks.abortSignal.mockRejectedValue(sensitiveError);
    logAuditEvent({ eventType: "admin_login_failed", actorEmail: "fixture@example.invalid", metadata: { password: "secret" } });
    await callbacks[0]();
    const hint = { attachments: [{ filename: "private.txt", data: "secret" }] };
    const event = mocks.processor.mock.calls[0][0]({
      event_id: "test-id", timestamp: 123, environment: "vercel-production", release: "fixture-release",
      request: { headers: { authorization: "secret" }, data: { password: "secret" } },
      user: { email: "fixture@example.invalid" }, breadcrumbs: [{ message: sensitiveError.message }],
      exception: { values: [{ value: sensitiveError.message }] }, contexts: { private: "secret" },
      extra: { secret: "secret" }, tags: { private: "secret" },
    }, hint);
    expect(event).toEqual({
      event_id: "test-id", timestamp: 123, environment: "vercel-production", release: "fixture-release",
      level: "error", logger: "audit-log", message: "Audit log persistence failed",
      fingerprint: ["audit-log", "write-failed"], tags: { component: "audit-log" },
    });
    expect(hint.attachments).toEqual([]);
    expect(mocks.capture).toHaveBeenCalledExactlyOnceWith("Audit log persistence failed", "error");
  });

  it("keeps the lifecycle callback pending for the bounded alert flush too", async () => {
    let finish!: (delivered: boolean) => void;
    mocks.flush.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    mocks.abortSignal.mockResolvedValue({ error: { message: sensitiveError.message } });
    logAuditEvent({ eventType: "admin_login" });
    let completed = false;
    const pending = callbacks[0]().then(() => { completed = true; });
    await vi.waitFor(() => expect(mocks.flush).toHaveBeenCalledWith(2_000));
    expect(completed).toBe(false);
    finish(true);
    await pending;
    expect(completed).toBe(true);
  });

  it.each(["timeout", "exception", "capture"])("contains an alert %s without exposing diagnostic contents", async failure => {
    mocks.abortSignal.mockRejectedValue(sensitiveError);
    if (failure === "timeout") mocks.flush.mockResolvedValue(false);
    if (failure === "exception") mocks.flush.mockRejectedValue(sensitiveError);
    if (failure === "capture") mocks.capture.mockImplementation(() => { throw sensitiveError; });
    logAuditEvent({ eventType: "admin_login" });
    await expect(callbacks[0]()).resolves.toBeUndefined();
    expect(console.error).toHaveBeenNthCalledWith(1, "[audit-log] audit_log_write_failed");
    expect(console.error).toHaveBeenNthCalledWith(2, "[audit-log] audit_log_alert_failed");
    expect(console.error).toHaveBeenCalledTimes(2);
  });

  it("signals when monitoring is unconfigured instead of claiming delivery", async () => {
    mocks.sentryClient.mockReturnValue(undefined);
    mocks.abortSignal.mockRejectedValue(sensitiveError);
    logAuditEvent({ eventType: "admin_login" });
    await callbacks[0]();
    expect(console.error).toHaveBeenNthCalledWith(2, "[audit-log] audit_log_alert_unavailable");
    expect(mocks.capture).not.toHaveBeenCalled();
    expect(mocks.flush).not.toHaveBeenCalled();
  });

  it("aborts the actual PostgREST fetch after five seconds before reporting failure, without retrying", async () => {
    const lifecycle: string[] = [];
    let observedSignal: AbortSignal | undefined;
    const transport = vi.fn<typeof fetch>((_url, init) => {
      const signal = init?.signal;
      if (!signal) throw new Error("Audit insertion must forward its abort signal to fetch");
      observedSignal = signal;
      lifecycle.push("request");
      return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          lifecycle.push("cancelled");
          reject(signal.reason);
        }, { once: true });
      });
    });
    // Real PostgREST builders and the real AbortSignal timer. This fetch
    // transport cannot contact a network; neither timers nor abort are faked.
    mocks.client.mockReturnValue(createClient("https://audit-fixture.example.test", "synthetic-service-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: transport },
    }));
    mocks.capture.mockImplementation(() => { lifecycle.push("alert"); });
    logAuditEvent({ eventType: "admin_login" });
    const started = performance.now();
    await callbacks[0]();
    lifecycle.push("completed");
    expect(performance.now() - started).toBeGreaterThanOrEqual(4_900);
    expect(lifecycle).toEqual(["request", "cancelled", "alert", "completed"]);
    expect(transport).toHaveBeenCalledOnce();
    expect(observedSignal?.aborted).toBe(true);
    expect((observedSignal?.reason as DOMException).name).toBe("TimeoutError");
    expect(console.error).toHaveBeenCalledExactlyOnceWith("[audit-log] audit_log_write_failed");
    expect(mocks.flush).toHaveBeenCalledWith(2_000);
  }, 12_000);
});
