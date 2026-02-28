import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import { readStoreByBackend } from "@/lib/data-backend";
import { getCustomerByIdByBackend } from "@/lib/customer-backend";
import {
  buildMondialRelayCsv,
  type MondialRelayExportConfig,
} from "@/lib/mondial-relay-export";

export const runtime = "nodejs";

type ExportPayload = {
  orderIds?: string[];
  collectionType?: "R" | "D";
};

export async function POST(request: Request) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  const payload = (await request.json().catch(() => null)) as ExportPayload | null;
  const orderIds = Array.isArray(payload?.orderIds)
    ? payload?.orderIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : [];

  if (orderIds.length === 0) {
    return NextResponse.json(
      { error: "Aucune commande a exporter." },
      { status: 400 },
    );
  }

  const store = await readStoreByBackend();
  const orders = store.orders.filter((order) => orderIds.includes(order.id));

  if (orders.length === 0) {
    return NextResponse.json(
      { error: "Aucune commande correspondante." },
      { status: 404 },
    );
  }

  const customerIds = Array.from(
    new Set(
      orders
        .map((order) => order.customerId)
        .filter((id): id is string => typeof id === "string" && id.trim().length > 0),
    ),
  );

  const customers = await Promise.all(
    customerIds.map(async (id) => [id, await getCustomerByIdByBackend(id)] as const),
  );
  const customersById = new Map(customers);

  const envCollectionType = process.env.MONDIAL_RELAY_COLLECTION_TYPE;
  const fallbackCollectionType =
    envCollectionType === "D" || envCollectionType === "R" ? envCollectionType : "R";
  const fallbackRelayId = process.env.MONDIAL_RELAY_COLLECTION_RELAY_ID ?? "";
  const fallbackCountry = process.env.MONDIAL_RELAY_COLLECTION_COUNTRY ?? "FR";

  const config: MondialRelayExportConfig = {
    collectionType:
      payload?.collectionType === "D" || payload?.collectionType === "R"
        ? payload.collectionType
        : store.content.logistics.mondialRelay.collectionType || fallbackCollectionType,
    collectionRelayId:
      store.content.logistics.mondialRelay.collectionRelayId || fallbackRelayId,
    collectionCountry:
      store.content.logistics.mondialRelay.collectionCountry || fallbackCountry,
  };

  const productsById = new Map(store.products.map((product) => [product.id, product]));
  const result = buildMondialRelayCsv({
    orders,
    productsById,
    customersById,
    config,
  });

  if (result.errors.length > 0) {
    return NextResponse.json(
      { error: "Certaines commandes sont invalides.", details: result.errors },
      { status: 400 },
    );
  }

  return new NextResponse(result.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=mondial-relay-${new Date().toISOString().slice(0, 10)}.csv`,
    },
  });
}
