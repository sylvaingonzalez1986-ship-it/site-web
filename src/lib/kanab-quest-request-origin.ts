/** Keep player mutations same-origin, including Next's local network dev server. */
export function isKqSameOriginRequest(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  // Preserve support for non-browser clients without an Origin header.
  if (!origin) return true;
  const target = new URL(request.url);
  if (origin === target.origin) return true;
  if (process.env.NODE_ENV !== "development") return false;

  // Next can build Request.url with its bind address (0.0.0.0/localhost)
  // instead of the LAN address used by the browser. Match the actual Host,
  // including its port, only in dev. Never trust forwarded headers here.
  try {
    const browser = new URL(origin);
    return (browser.protocol === "http:" || browser.protocol === "https:")
      && browser.origin === origin
      && browser.protocol === target.protocol
      && browser.host === request.headers.get("host");
  } catch {
    return false;
  }
}
