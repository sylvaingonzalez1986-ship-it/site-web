import { describe, expect, it, vi } from "vitest";
import { readRequestBody, rejectOversizedBody } from "@/lib/body-size-guard";

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

function streamedRequest(chunks: Uint8Array[], headers: Record<string, string> = {}) {
  const cancel = vi.fn();
  let index = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) controller.enqueue(chunks[index++]);
      else controller.close();
    },
    cancel,
  }, { highWaterMark: 0 });
  const request = new Request("https://example.test/body", {
    method: "POST", headers, body: stream, duplex: "half",
  } as RequestInit & { duplex: "half" });
  return { request, cancel, reads: () => index };
}

describe("readRequestBody", () => {
  it.each([undefined, "1", "NaN", "-10"])("limits actual chunks with Content-Length=%s", async (length) => {
    const input = streamedRequest([new Uint8Array(8), new Uint8Array(9), new Uint8Array(100)],
      length === undefined ? {} : { "content-length": length });
    const result = await readRequestBody(input.request, 16);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(413);
    expect(input.cancel).toHaveBeenCalledOnce();
    expect(input.reads()).toBe(2);
  });

  it("rejects an advertised oversized body without pulling it", async () => {
    const input = streamedRequest([new Uint8Array(5)], { "content-length": "1000" });
    const result = await readRequestBody(input.request, 16);
    expect(result.ok).toBe(false);
    expect(input.reads()).toBe(0);
    expect(input.cancel).toHaveBeenCalledOnce();
  });

  it("preserves exact UTF-8 bytes across chunk boundaries at the inclusive limit", async () => {
    const raw = '{ "text": "été 🌿" }\r\n';
    const bytes = new TextEncoder().encode(raw);
    const input = streamedRequest(Array.from(bytes, value => new Uint8Array([value])));
    const result = await readRequestBody(input.request, bytes.byteLength);
    expect(result.ok).toBe(true);
    if (result.ok) expect(await result.body.text()).toBe(raw);
    expect(input.request.bodyUsed).toBe(true);
    expect(input.cancel).not.toHaveBeenCalled();
    expect(input.reads()).toBe(bytes.byteLength);
  });

  it("measures bytes rather than decoded characters", async () => {
    const input = streamedRequest([new TextEncoder().encode('"🌿🌿"')]);
    const result = await readRequestBody(input.request, 8);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(413);
  });

  it("retains normal JSON parsing and malformed JSON errors", async () => {
    const valid = await readRequestBody(streamedRequest([new TextEncoder().encode('{"ok":true}')]).request);
    if (!valid.ok) throw new Error("Expected bounded JSON");
    await expect(valid.body.json()).resolves.toEqual({ ok: true });
    const invalid = await readRequestBody(streamedRequest([new TextEncoder().encode('{bad')]).request);
    if (!invalid.ok) throw new Error("Expected parsing to remain the caller's responsibility");
    await expect(invalid.body.json()).rejects.toThrow(SyntaxError);
  });

  it("bounds the whole multipart envelope and preserves file bytes", async () => {
    const raw = '--fixture\r\nContent-Disposition: form-data; name="file"; filename="tiny.txt"\r\nContent-Type: text/plain\r\n\r\nété\r\n--fixture--\r\n';
    const bytes = new TextEncoder().encode(raw);
    const headers = { "content-type": "multipart/form-data; boundary=fixture" };
    const result = await readRequestBody(streamedRequest([bytes.subarray(0, 20), bytes.subarray(20)], headers).request, bytes.length);
    if (!result.ok) throw new Error("Expected bounded multipart body");
    const form = await result.body.formData();
    expect(await (form.get("file") as File).text()).toBe("été");
    const oversized = await readRequestBody(streamedRequest([bytes], headers).request, bytes.length - 1);
    expect(oversized.ok).toBe(false);
    if (!oversized.ok) expect(oversized.response.status).toBe(413);
  });

  it("returns 400 on an interrupted stream without exposing the error", async () => {
    const stream = new ReadableStream({ start(controller) { controller.error(new Error("private transport detail")); } });
    const request = new Request("https://example.test", { method: "POST", body: stream, duplex: "half" } as RequestInit & { duplex: "half" });
    const result = await readRequestBody(request);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      expect(await result.response.text()).not.toContain("private transport detail");
    }
  });

  it("does not await a cancellation promise controlled by the sender", async () => {
    const cancel = vi.fn(() => new Promise<void>(() => {}));
    const stream = new ReadableStream<Uint8Array>({ pull(controller) { controller.enqueue(new Uint8Array(17)); }, cancel }, { highWaterMark: 0 });
    const request = new Request("https://example.test", { method: "POST", body: stream, duplex: "half" } as RequestInit & { duplex: "half" });
    const result = await readRequestBody(request, 16);
    expect(result.ok).toBe(false);
    expect(cancel).toHaveBeenCalledOnce();
  });
});
