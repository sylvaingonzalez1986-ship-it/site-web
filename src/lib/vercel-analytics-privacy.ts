import type { BeforeSend } from "@vercel/analytics/next";

export const protectVercelAnalyticsUrls: BeforeSend = (event) => {
  try {
    const url = new URL(event.url);
    if (url.pathname === "/newsletter" || url.pathname.startsWith("/newsletter/")) return null;
    if (!url.searchParams.has("resume")) return event;

    url.searchParams.delete("resume");
    return { ...event, url: url.href };
  } catch {
    return null;
  }
};
