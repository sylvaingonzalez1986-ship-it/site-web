import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import { listNewsletterSubscribersByBackend } from "@/lib/newsletter-backend";

export const runtime = "nodejs";

export async function GET() {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  try {
    const subscribers = await listNewsletterSubscribersByBackend();
    return NextResponse.json({ subscribers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lecture newsletter impossible.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


