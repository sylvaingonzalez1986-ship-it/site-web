import type { ErrorEvent, Event, EventHint } from "@sentry/nextjs";

/** Explicit opt-out: Sentry 11 collects these categories by default. */
export const sentryDataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [] as [],
  urlQueryParams: false,
  databaseQueryData: false,
  stackFrameVariables: false,
  frameContextLines: 0,
  genAI: { inputs: false, outputs: false },
  mcp: { inputs: false, outputs: false },
  graphQL: { document: false, variables: false },
  queues: false,
};

const AUDIT_FAILURE_MESSAGE = "Audit log persistence failed";

/** Used both by the local audit scope and the final SDK beforeSend hook. */
export function sanitizeAuditLogFailureEvent(event: Event, hint: EventHint): ErrorEvent {
  hint.attachments = [];
  return {
    type: undefined,
    event_id: event.event_id, timestamp: event.timestamp,
    environment: event.environment, release: event.release,
    level: "error", logger: "audit-log", message: AUDIT_FAILURE_MESSAGE,
    fingerprint: ["audit-log", "write-failed"], tags: { component: "audit-log" },
  };
}

export function beforeSendSentryEvent(event: ErrorEvent, hint: EventHint): ErrorEvent {
  if (event.logger !== "audit-log" || event.message !== AUDIT_FAILURE_MESSAGE || event.tags?.component !== "audit-log") {
    return event;
  }
  // Sentry 11 adds propagation context and dynamic sampling metadata *after*
  // scope processors. Rebuild at this final hook so they cannot reach the
  // event or envelope headers. Other application events retain their behavior.
  return sanitizeAuditLogFailureEvent(event, hint);
}
