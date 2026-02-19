import { NextResponse } from "next/server";
import { cleanupUnusedBlogUploads } from "@/lib/blog-image-storage";
import { readStoreByBackend, writeStoreByBackend } from "@/lib/data-backend";
import { cleanupUnusedProductAnalyses } from "@/lib/product-analysis-storage";
import { cleanupUnusedProductUploads } from "@/lib/product-image-storage";
import { cleanupUnusedProducerUploads } from "@/lib/producer-image-storage";
import type { CmsStore } from "@/types/store";

export const runtime = "nodejs";

export async function GET() {
  const store = await readStoreByBackend();
  return NextResponse.json(store);
}

export async function PUT(request: Request) {
  try {
    const payload = (await request.json()) as CmsStore;
    const current = await readStoreByBackend();
    const saved = await writeStoreByBackend({
      ...payload,
      orders: current.orders,
    });

    try {
      await cleanupUnusedProductUploads(
        saved.products.flatMap((product) => [
          product.image,
          ...(Array.isArray(product.images) ? product.images : []),
        ]),
      );
      await cleanupUnusedBlogUploads(
        saved.blog.map((post) => post.coverImage).filter(Boolean),
      );
      await cleanupUnusedProducerUploads(
        saved.producers.map((producer) => producer.image).filter(Boolean),
      );
      await cleanupUnusedProductAnalyses(
        saved.products
          .map((product) => product.analysisPdf)
          .filter((value): value is string => Boolean(value)),
      );
    } catch (error) {
      console.error("Erreur nettoyage images CMS:", error);
    }

    return NextResponse.json(saved);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payload invalide.";
    console.error("Erreur PUT /api/admin/store:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
