import "server-only";

import { NextResponse } from "next/server";

const DEFAULT_MAX_BYTES = 64 * 1024; // 64 KB

/** Early rejection only. Always use readRequestBody before parsing the body. */
export function rejectOversizedBody(
  request: Request,
  maxBytes: number = DEFAULT_MAX_BYTES,
): NextResponse | null {
  const contentLength = request.headers.get("content-length");
  if (contentLength === null) {
    return null;
  }
  const length = Number(contentLength);
  if (!Number.isFinite(length)) {
    return null;
  }
  if (length > maxBytes) {
    return NextResponse.json(
      { error: "Payload trop volumineux." },
      { status: 413 },
    );
  }
  return null;
}

type BoundedRequestBody =
  | { ok: true; body: Response }
  | { ok: false; response: NextResponse };

/**
 * Consume the incoming stream once, stopping before buffering more than the
 * limit. Content-Length is only an early hint: absent or inaccurate headers
 * cannot bypass the byte count. Parse the returned body, never the request.
 */
export async function readRequestBody(
  request: Request,
  maxBytes: number = DEFAULT_MAX_BYTES,
): Promise<BoundedRequestBody> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new RangeError("Request body limit must be a positive integer.");
  }
  const rejected = rejectOversizedBody(request, maxBytes);
  if (rejected) {
    void request.body?.cancel().catch(() => {});
    return { ok: false, response: rejected };
  }

  const reader = request.body?.getReader();
  let bytes = new Uint8Array(Math.min(maxBytes, 8192));
  let size = 0;
  try {
    if (reader) {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        const nextSize = size + part.value.byteLength;
        if (nextSize > maxBytes) {
          // A client must not delay the 413 by keeping cancellation pending.
          void reader.cancel().catch(() => {});
          return {
            ok: false,
            response: NextResponse.json({ error: "Payload trop volumineux." }, { status: 413 }),
          };
        }
        if (nextSize > bytes.byteLength) {
          const grown = new Uint8Array(Math.min(maxBytes, Math.max(nextSize, bytes.byteLength * 2)));
          grown.set(bytes.subarray(0, size));
          bytes = grown;
        }
        bytes.set(part.value, size);
        size = nextSize;
      }
    }
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Corps de requête illisible." }, { status: 400 }),
    };
  } finally {
    reader?.releaseLock();
  }

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  return { ok: true, body: new Response(bytes.subarray(0, size), { headers }) };
}
