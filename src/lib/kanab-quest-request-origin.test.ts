import { afterEach, describe, expect, it, vi } from "vitest";
import { isKqSameOriginRequest } from "./kanab-quest-request-origin";

const request = (headers: Record<string, string>, url = "http://0.0.0.0:3000/api/arena/placard/social") =>
  new Request(url, { method: "POST", headers });
afterEach(() => vi.unstubAllEnvs());

describe("player mutation origin", () => {
  it.each(["192.168.1.24:3000", "10.0.0.5:3000", "[fd12::24]:3000", "localhost:3000", "atelier.local:3000"])("accepts the exact browser host in development: %s", host => {
    vi.stubEnv("NODE_ENV", "development");
    // HTTP LAN browsers may omit Sec-Fetch-Site; Origin and Host still agree.
    expect(isKqSameOriginRequest(request({ origin: `http://${host}`, host }))).toBe(true);
  });

  const invalidHeaders: Record<string, string>[] = [
    { origin: "http://192.168.1.25:3000" },
    { origin: "http://192.168.1.24:3001" },
    { origin: "https://192.168.1.24:3000" },
    { origin: "https://attacker.test" },
    { origin: "null" },
    { origin: "not a URL" },
    { origin: "http://192.168.1.24:3000/" },
    { origin: "http://user@192.168.1.24:3000" },
    { host: "192.168.1.24:3000, attacker.test" },
    { host: "192.168.1.24:3000/path" },
    { "sec-fetch-site": "cross-site" },
    { host: "localhost:3000", "x-forwarded-host": "192.168.1.24:3000", "x-forwarded-proto": "http" },
  ];
  it.each(invalidHeaders)("rejects mismatched or invalid local origin/host: %j", extra => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isKqSameOriginRequest(request({ origin: "http://192.168.1.24:3000", host: "192.168.1.24:3000", ...extra }))).toBe(false);
  });

  it("does not accept an origin without the matching Host in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isKqSameOriginRequest(request({ origin: "http://192.168.1.24:3000" }))).toBe(false);
  });

  it.each(["production", "test"])("keeps the strict URL-origin check in %s", environment => {
    vi.stubEnv("NODE_ENV", environment);
    expect(isKqSameOriginRequest(request({ origin: "http://192.168.1.24:3000", host: "192.168.1.24:3000" }))).toBe(false);
    const url = "https://shop.example.test/api/arena/placard/social";
    expect(isKqSameOriginRequest(request({ origin: "https://shop.example.test" }, url))).toBe(true);
    expect(isKqSameOriginRequest(request({ origin: "https://shop.example.test", "sec-fetch-site": "cross-site" }, url))).toBe(false);
    expect(isKqSameOriginRequest(request({ origin: "https://attacker.test", host: "attacker.test" }, url))).toBe(false);
  });

  it("preserves origin-less clients but still rejects explicit cross-site requests", () => {
    expect(isKqSameOriginRequest(request({}))).toBe(true);
    expect(isKqSameOriginRequest(request({ "sec-fetch-site": "cross-site" }))).toBe(false);
  });
});
