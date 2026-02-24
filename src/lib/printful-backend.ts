import "server-only";

import {
  getPrintfulAdminSnapshotFromSupabase,
  publishPrintfulProductToStoreInSupabase,
  publishPrintfulVariantToStoreInSupabase,
  syncPrintfulCatalogInSupabase,
  unpublishPrintfulProductFromStoreInSupabase,
  unpublishPrintfulVariantFromStoreInSupabase,
} from "@/lib/supabase/printful-backend";
import type { PrintfulAdminSnapshot, PrintfulSyncSummary } from "@/types/printful";

export async function getPrintfulAdminSnapshotByBackend(): Promise<PrintfulAdminSnapshot> {
  return getPrintfulAdminSnapshotFromSupabase();
}

export async function syncPrintfulCatalogByBackend(input: {
  triggeredBy: string;
}): Promise<PrintfulSyncSummary> {
  return syncPrintfulCatalogInSupabase(input);
}

export async function publishPrintfulVariantToStoreByBackend(input: {
  syncVariantId: number;
}): Promise<{ productId: string }> {
  return publishPrintfulVariantToStoreInSupabase(input);
}

export async function unpublishPrintfulVariantFromStoreByBackend(input: {
  syncVariantId: number;
}): Promise<boolean> {
  return unpublishPrintfulVariantFromStoreInSupabase(input);
}

export async function publishPrintfulProductToStoreByBackend(input: {
  syncProductId: number;
}): Promise<{ productId: string }> {
  return publishPrintfulProductToStoreInSupabase(input);
}

export async function unpublishPrintfulProductFromStoreByBackend(input: {
  syncProductId: number;
}): Promise<boolean> {
  return unpublishPrintfulProductFromStoreInSupabase(input);
}


