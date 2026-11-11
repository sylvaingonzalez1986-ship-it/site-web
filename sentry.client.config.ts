import * as Sentry from "@sentry/nextjs";
import { beforeSendSentryEvent, sentryDataCollection } from "./src/lib/sentry-privacy";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    enabled: process.env.NODE_ENV === "production",
    tracesSampleRate: 0,
    dataCollection: sentryDataCollection,
    beforeSend: beforeSendSentryEvent,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ? `vercel-${process.env.NEXT_PUBLIC_VERCEL_ENV}` : process.env.NODE_ENV,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}
