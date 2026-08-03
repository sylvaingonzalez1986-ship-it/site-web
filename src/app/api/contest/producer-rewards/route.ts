import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { findKqProducerRewardForEntry } from "@/lib/kanab-quest-producer-rewards";
import {
  claimKqProducerHeritageForCustomer,
  getKqProducerRewardProgressForCustomer,
} from "@/lib/supabase/kanab-quest-producer-rewards-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try {
    return NextResponse.json({
      campaigns: await getKqProducerRewardProgressForCustomer(session.customerId),
    }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch {
    return NextResponse.json({ campaigns: [], unavailable: true }, {
      status: 503,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  }
}

export async function POST(request: Request) {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try {
    const value = await request.json() as Record<string, unknown>;
    const campaignId = typeof value.campaignId === "string" ? value.campaignId : "";
    const entryId = typeof value.entryId === "string" ? value.entryId : "";
    const receipt = await claimKqProducerHeritageForCustomer({
      customerId: session.customerId,
      campaignId,
      entryId,
    });
    const campaigns = await getKqProducerRewardProgressForCustomer(session.customerId);
    const campaign = findKqProducerRewardForEntry(campaigns, entryId);
    return NextResponse.json({ receipt, campaign }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Déblocage impossible.",
    }, { status: 409, headers: { "Cache-Control": "private, no-store, max-age=0" } });
  }
}
