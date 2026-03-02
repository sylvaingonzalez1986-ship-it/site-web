import { NextResponse } from "next/server";

const AGE_GATE_COOKIE_NAME = "age_verified";
const AGE_GATE_MAX_AGE_SECONDS = 60 * 60 * 24;

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as { confirmed?: boolean } | null;
  if (!payload?.confirmed) {
    return NextResponse.json({ error: "Confirmation requise." }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: AGE_GATE_COOKIE_NAME,
    value: "true",
    httpOnly: true,
    maxAge: AGE_GATE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
