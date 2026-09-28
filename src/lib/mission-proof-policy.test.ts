import { describe, expect, it } from "vitest";
import { isSupportedMissionProofMimeType, normalizeMissionProofUrl, isSameOriginMissionRequest } from "@/lib/mission-proof-policy";

describe("mission-proof-policy", () => {
  it("accepts the supported mission proof mime types", () => {
    expect(isSupportedMissionProofMimeType("image/jpeg")).toBe(true);
    expect(isSupportedMissionProofMimeType("image/png")).toBe(true);
    expect(isSupportedMissionProofMimeType("image/webp")).toBe(true);
  });

  it("rejects unsupported mime types", () => {
    expect(isSupportedMissionProofMimeType("image/gif")).toBe(false);
    expect(isSupportedMissionProofMimeType("application/pdf")).toBe(false);
  });
});
describe("mission proof links and request origin", () => {
  it.each(["", undefined, null])("keeps an optional missing link empty: %s", value => {
    expect(normalizeMissionProofUrl(value)).toBe("");
  });
  it.each(["http://example.com/post", "javascript:alert(1)", "https://user:pass@example.com", "https://localhost/post", "https://127.0.0.1/post", "https://intranet.internal/post"])("rejects unsafe proof links: %s", value => {
    expect(() => normalizeMissionProofUrl(value)).toThrow();
  });
  it("normalizes an optional public HTTPS permalink without fetching it", () => {
    expect(normalizeMissionProofUrl(" https://EXAMPLE.com/post/1?q=2 ")).toBe("https://example.com/post/1?q=2");
  });
  it("requires exact origin including scheme and port, and rejects cross-site metadata", () => {
    const req = (origin?: string, site?: string) => new Request("https://example.test/path", { headers: { ...(origin ? { origin } : {}), ...(site ? { "sec-fetch-site": site } : {}) } });
    expect(isSameOriginMissionRequest(req("https://example.test"))).toBe(true);
    expect(isSameOriginMissionRequest(req("http://example.test"))).toBe(false);
    expect(isSameOriginMissionRequest(req("https://example.test:444"))).toBe(false);
    expect(isSameOriginMissionRequest(req())).toBe(false);
    expect(isSameOriginMissionRequest(req("https://example.test", "cross-site"))).toBe(false);
  });
});
