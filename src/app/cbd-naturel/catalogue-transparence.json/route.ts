import { NextResponse } from "next/server";
import {
  buildCatalogTransparencyDocument,
  buildCatalogTransparencySnapshot,
} from "@/lib/catalog-transparency";
import { readPublicStoreByBackend } from "@/lib/data-backend";
import { getOwnProducer } from "@/lib/own-producer";
import { getSiteUrl } from "@/lib/site-url";

export const revalidate = 300;

export async function GET() {
  const baseUrl = getSiteUrl();
  const store = await readPublicStoreByBackend();
  const snapshot = buildCatalogTransparencySnapshot(
    store.products,
    store.producers,
    getOwnProducer(store.content.boutique),
  );

  return NextResponse.json(buildCatalogTransparencyDocument(snapshot, baseUrl), {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
