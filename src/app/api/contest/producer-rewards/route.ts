import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { findKqProducerRewardForEntry } from "@/lib/kanab-quest-producer-rewards";
import {
  claimKqProducerCompletionForCustomer,
  claimKqProducerHeritageForCustomer,
  claimKqProducerPurchaseBuddieForCustomer,
  getKqProducerRewardProgressForCustomer,
} from "@/lib/supabase/kanab-quest-producer-rewards-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET() {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401, headers: NO_STORE_HEADERS });
  try {
    return NextResponse.json({ campaigns: await getKqProducerRewardProgressForCustomer(session.customerId) }, { headers: NO_STORE_HEADERS });
  } catch {
    return NextResponse.json({ campaigns: [], unavailable: true }, { status: 503, headers: NO_STORE_HEADERS });
  }
}

export async function POST(request: Request) {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401, headers: NO_STORE_HEADERS });
  let value: Record<string, unknown>;
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid_body");
    value = body as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Demande invalide." }, { status: 400, headers: NO_STORE_HEADERS });
  }
  const action = value.action ?? "heritage";
  if (action !== "heritage" && action !== "completion" && action !== "purchase-buddie") {
    return NextResponse.json({ error: "Récompense inconnue." }, { status: 400, headers: NO_STORE_HEADERS });
  }
  try {
    const producerId = typeof value.producerId === "string" ? value.producerId : "";
    const entryId = typeof value.entryId === "string" ? value.entryId : "";
    const receipt = action === "completion"
      ? await claimKqProducerCompletionForCustomer({ customerId: session.customerId, producerId })
      : action === "purchase-buddie"
        ? await claimKqProducerPurchaseBuddieForCustomer({ customerId: session.customerId, producerId })
        : await claimKqProducerHeritageForCustomer({
          customerId: session.customerId,
          campaignId: typeof value.campaignId === "string" ? value.campaignId : "",
          entryId,
        });
    const campaigns = await getKqProducerRewardProgressForCustomer(session.customerId);
    const campaign = action === "heritage"
      ? findKqProducerRewardForEntry(campaigns, entryId)
      : campaigns.find((item) => item.producerId === producerId.trim()) ?? null;
    return NextResponse.json({ receipt, campaign }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Déblocage impossible." }, {
      status: 409, headers: NO_STORE_HEADERS,
    });
  }
}
