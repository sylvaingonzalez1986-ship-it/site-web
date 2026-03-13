import "server-only";

import { NextResponse } from "next/server";

const DEFAULT_MAX_BYTES = 64 * 1024; // 64 KB

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
