import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { getCollectionAlbumForCustomerByBackend } from "@/lib/lottery-backend";

export const runtime = "nodejs";

export async function GET() {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  try {
    const album = await getCollectionAlbumForCustomerByBackend(session.customerId);
    return NextResponse.json(album);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lecture album impossible.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
