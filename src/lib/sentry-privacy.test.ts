import { afterEach, describe, expect, it, vi } from "vitest";
import type { ErrorEvent, EventHint } from "@sentry/nextjs";
import { beforeSendSentryEvent, sanitizeAuditLogFailureEvent, sentryDataCollection } from "@/lib/sentry-privacy";

type Envelope = Parameters<ReturnType<typeof import("@sentry/nextjs").createTransport>["send"]>[0];

const { init } = vi.hoisted(() => ({ init: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ init }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.resetModules();
});

describe("Sentry runtime privacy after the v11 upgrade", () => {
  for (const runtime of ["server", "edge", "client"] as const) {
    it(`${runtime} disables automatic sensitive collection with a configured DSN`, async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("SENTRY_DSN", "https://synthetic@example.invalid/1");
      vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://synthetic@example.invalid/1");
      vi.stubEnv("VERCEL_ENV", "production");
      vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "production");
      if (runtime === "server") await import("../../sentry.server.config");
      if (runtime === "edge") await import("../../sentry.edge.config");
      if (runtime === "client") await import("../../sentry.client.config");

      expect(init).toHaveBeenCalledTimes(1);
      const options = init.mock.calls[0][0];
      expect(options.enabled).toBe(true);
      expect(options.environment).toBe("vercel-production");
      expect(options.tracesSampleRate).toBe(0);
      expect(options.beforeSend).toBeTypeOf("function");
      // An omitted field would enable Sentry 11's permissive defaults.
      for (const field of ["userInfo", "cookies", "httpHeaders", "urlQueryParams",
        "databaseQueryData", "stackFrameVariables", "queues"]) {
        expect(options.dataCollection[field], field).toBe(false);
      }
      expect(options.dataCollection.httpBodies).toEqual([]);
      expect(options.dataCollection.frameContextLines).toBe(0);
      expect(options.dataCollection.genAI).toEqual({ inputs: false, outputs: false });
      expect(options.dataCollection.mcp).toEqual({ inputs: false, outputs: false });
      expect(options.dataCollection.graphQL).toEqual({ document: false, variables: false });
      if (runtime === "client") {
        expect(options.replaysSessionSampleRate).toBe(0);
        expect(options.replaysOnErrorSampleRate).toBe(0);
      }
    });
  }

  it("removes inherited private data from the final real SDK envelope, including reintroduced propagation metadata", async () => {
    // Import through the application SDK so this cannot accidentally exercise
    // an older @sentry/core installed for a transitive build dependency.
    const { NodeClient, Scope, SDK_VERSION } = await vi.importActual<typeof import("@sentry/nextjs")>("@sentry/nextjs");
    expect(SDK_VERSION).toMatch(/^11\./);
    const privateValue = "synthetic-private-fixture@example.test";
    async function capture(finalFilter: boolean) {
      const envelopes: Envelope[] = [];
      const client = new NodeClient({
        dsn: "https://synthetic@example.test/1", integrations: [], stackParser: () => [],
        environment: "privacy-fixture", release: "fixture-release", dataCollection: sentryDataCollection,
        beforeSend: finalFilter ? beforeSendSentryEvent : undefined,
        transport: () => ({
          send: async envelope => { envelopes.push(envelope); return { statusCode: 200 }; },
          flush: async () => true,
        }),
      });
      const scope = new Scope();
      scope.setClient(client);
      scope.setUser({ email: privateValue });
      scope.setExtra("private", privateValue);
      scope.setTag("private", privateValue);
      scope.setContext("private", { value: privateValue });
      scope.addBreadcrumb({ message: privateValue });
      scope.addAttachment({ filename: "private.txt", data: privateValue });
      scope.setPropagationContext({
        traceId: "a".repeat(32), sampleRand: 0.5,
        dsc: { trace_id: "a".repeat(32), public_key: "synthetic", transaction: privateValue },
      });
      // This is the exact initial processor used by logAuditEvent. The SDK
      // subsequently restores the propagation data before running beforeSend.
      scope.addEventProcessor(sanitizeAuditLogFailureEvent);
      scope.captureEvent({
        message: "Audit log persistence failed", level: "error",
        request: { url: `https://example.test/?private=${privateValue}`, data: privateValue, headers: { authorization: privateValue } },
        exception: { values: [{ value: privateValue }] },
      });
      await client.flush(1_000);
      await client.close(1_000);
      expect(envelopes).toHaveLength(1);
      return envelopes[0];
    }

    // Prove the previous local processor alone cannot protect envelope headers.
    const previous = await capture(false);
    expect(JSON.stringify(previous)).toContain(privateValue);
    const envelope = await capture(true);
    expect(JSON.stringify(envelope)).not.toContain(privateValue);
    expect(envelope[0]).not.toHaveProperty("trace");
    expect(envelope[1].map(([header]) => header.type)).toEqual(["event"]);
    const event = envelope[1][0][1] as ErrorEvent;
    expect(event).toMatchObject({ logger: "audit-log", message: "Audit log persistence failed", tags: { component: "audit-log" } });
    for (const key of ["request", "user", "extra", "contexts", "breadcrumbs", "exception", "sdkProcessingMetadata"]) {
      expect(event).not.toHaveProperty(key);
    }
  });

  it("leaves other explicitly captured application events and their attachments unchanged", () => {
    const event: ErrorEvent = { type: undefined, message: "Other application error", exception: { values: [{ value: "explicit synthetic private data" }] } };
    const hint: EventHint = { attachments: [{ filename: "fixture.txt", data: "explicit synthetic data" }] };
    const attachments = hint.attachments;
    expect(beforeSendSentryEvent(event, hint)).toBe(event);
    expect(hint.attachments).toBe(attachments);
  });
});
