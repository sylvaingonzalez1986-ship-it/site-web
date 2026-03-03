import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import { logAuditEvent } from "@/lib/audit-log";
import { cleanupUnusedBlogUploads } from "@/lib/blog-image-storage";
import {
  invalidateBlogPostsCache,
  invalidatePublicStoreCache,
  readStoreByBackend,
  writeStoreByBackend,
} from "@/lib/data-backend";
import { cleanupUnusedProductAnalyses } from "@/lib/product-analysis-storage";
import { cleanupUnusedProductUploads } from "@/lib/product-image-storage";
import { cleanupUnusedProductVideoUploads } from "@/lib/product-video-storage";
import { cleanupUnusedProducerUploads } from "@/lib/producer-image-storage";
import type { CmsStore } from "@/types/store";

export const runtime = "nodejs";

function isPrintfulProduct(product: { id?: string; source?: unknown } | null | undefined): boolean {
  if (!product) {
    return false;
  }

  const id = typeof product.id === "string" ? product.id : "";
  if (id.startsWith("printful-p-")) {
    return true;
  }

  const source = typeof product.source === "string" ? product.source.trim().toLowerCase() : "";
  return source === "printful";
}

export async function GET() {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  const store = await readStoreByBackend();
  return NextResponse.json(store);
}

export async function PUT(request: Request) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  try {
    const payload = (await request.json()) as CmsStore;
    const current = await readStoreByBackend();
    const incomingProducts = Array.isArray(payload.products) ? payload.products : [];
    const editableProducts = incomingProducts.filter(
      (product) =>
        !isPrintfulProduct(product as unknown as { id?: string; source?: unknown }),
    );
    const preservedPrintfulProducts = current.products.filter((product) =>
      isPrintfulProduct(product as unknown as { id?: string; source?: unknown }),
    );
    const saved = await writeStoreByBackend({
      ...payload,
      orders: current.orders,
      products: [...editableProducts, ...preservedPrintfulProducts],
    });

    logAuditEvent({ eventType: "update_store", metadata: { productsCount: saved.products.length, producersCount: saved.producers.length, blogCount: saved.blog.length } });

    try {
      const blogStorageReferences = Array.from(
        new Set(
          [
            ...saved.blog.map((post) => post.coverImage),
            ...(Array.isArray(saved.content.home.seasonGalleryImages)
              ? saved.content.home.seasonGalleryImages
              : []),
          ].filter((value): value is string => typeof value === "string" && value.trim().length > 0),
        ),
      );

      await cleanupUnusedProductUploads(
        saved.products.flatMap((product) => [
          product.image,
          ...(Array.isArray(product.images) ? product.images : []),
        ]),
      );
      await cleanupUnusedProductVideoUploads(
        saved.products
          .map((product) => product.videoUrl)
          .filter((value): value is string => Boolean(value)),
      );
      await cleanupUnusedBlogUploads(blogStorageReferences);
      await cleanupUnusedProducerUploads(
        [
          saved.content.boutique.ownProducer.image,
          ...saved.producers.map((producer) => producer.image),
        ].filter(Boolean),
      );
      await cleanupUnusedProductAnalyses(
        saved.products
          .map((product) => product.analysisPdf)
          .filter((value): value is string => Boolean(value)),
      );
    } catch (error) {
      console.error("Erreur nettoyage images CMS:", error);
    }

    invalidatePublicStoreCache();
    invalidateBlogPostsCache();

    return NextResponse.json(saved);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payload invalide.";
    console.error("Erreur PUT /api/admin/store:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
