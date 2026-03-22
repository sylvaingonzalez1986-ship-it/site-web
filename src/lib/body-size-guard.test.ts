import { describe, expect, it } from "vitest";
import { rejectOversizedBody } from "@/lib/body-size-guard";

describe("body-size-guard", () => {
  it("allows requests without a content-length header", () => {
    const request = new Request("https://example.test", { method: "POST" });

    expect(rejectOversizedBody(request)).toBeNull();
  });

  it("allows requests smaller than the limit", () => {
    const request = new Request("https://example.test", {
      method: "POST",
      headers: { "content-length": "128" },
    });

    expect(rejectOversizedBody(request, 256)).toBeNull();
  });

  it("rejects requests that exceed the configured limit", async () => {
    const request = new Request("https://example.test", {
      method: "POST",
      headers: { "content-length": "2048" },
    });

    const response = rejectOversizedBody(request, 1024);
    expect(response?.status).toBe(413);
    await expect(response?.json()).resolves.toEqual({ error: "Payload trop volumineux." });
  });

  it("ignores non-numeric content-length values", () => {
    const request = new Request("https://example.test", {
      method: "POST",
      headers: { "content-length": "NaN" },
    });

    expect(rejectOversizedBody(request)).toBeNull();
  });
});