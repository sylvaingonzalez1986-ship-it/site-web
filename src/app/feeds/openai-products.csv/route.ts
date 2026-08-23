import { readPublicStoreByBackend } from "@/lib/data-backend";
import { getOwnProducer } from "@/lib/own-producer";
import { buildOpenAiProductFeed } from "@/lib/openai-product-feed";
import { getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = await readPublicStoreByBackend();
  const baseUrl = getSiteUrl();
  const ownProducer = getOwnProducer(store.content.boutique);
  const producerNamesById = new Map(
    [ownProducer, ...store.producers].map((producer) => [producer.id, producer.name]),
  );
  const csv = buildOpenAiProductFeed(store.products, {
    baseUrl,
    producerNamesById,
    defaultBrand: ownProducer.name,
    sellerName: "Les Chanvriers Bretons",
  });

  return new Response(csv, {
    headers: {
      "cache-control": "public, s-maxage=300, stale-while-revalidate=300",
      "content-disposition": 'inline; filename="les-chanvriers-bretons-products.csv"',
      "content-language": "fr-FR",
      "content-type": "text/csv; charset=utf-8",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
