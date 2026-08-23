import { getPublishedBlogPostsByBackend, readPublicStoreByBackend } from "@/lib/data-backend";
import { buildDiscoveryFeed } from "@/lib/discovery-feed";
import { getSiteUrl } from "@/lib/site-url";

export const revalidate = 300;

export async function GET() {
  const [posts, store] = await Promise.all([
    getPublishedBlogPostsByBackend(),
    readPublicStoreByBackend(),
  ]);
  const xml = buildDiscoveryFeed({
    baseUrl: getSiteUrl(),
    products: store.products,
    posts,
  });

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
