import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Product } from "@/data/products";
import { buildDiscoveryFeed } from "@/lib/discovery-feed";
import type { BlogPost } from "@/types/store";

const product: Product = {
  id: "flower-1",
  name: "Fleur A&B <test>",
  category: "fleurs",
  price: 2.5,
  image: "/flower.webp",
  description: "Origine & analyse consultable.",
  updatedAt: "2026-08-23T10:00:00.000Z",
};

const post: BlogPost = {
  id: "post-1",
  title: "Lire un lot CBD",
  slug: "lire-un-lot-cbd",
  excerpt: "Une méthode vérifiable.",
  content: "Contenu.",
  coverImage: "/post.webp",
  category: "guide",
  published: true,
  createdAt: "2026-08-20T10:00:00.000Z",
  updatedAt: "2026-08-22T10:00:00.000Z",
};

describe("Atom discovery feed", () => {
  it("publishes canonical, dated and WebSub-enabled entries", () => {
    const xml = buildDiscoveryFeed({
      baseUrl: "https://www.leschanvriersbretons.com/",
      products: [product],
      posts: [post],
    });

    expect(xml).toContain('<feed xmlns="http://www.w3.org/2005/Atom">');
    expect(xml).toContain('<link rel="hub" href="https://pubsubhubbub.appspot.com/" />');
    expect(xml).toContain('href="https://www.leschanvriersbretons.com/feed.xml"');
    expect(xml).toContain("https://www.leschanvriersbretons.com/cbd-naturel");
    expect(xml).toContain("https://www.leschanvriersbretons.com/blog/lire-un-lot-cbd");
    expect(xml).toContain("https://www.leschanvriersbretons.com/boutique/fleurs-cbd/flower-1");
    expect(xml).toContain("Fleur A&amp;B &lt;test&gt;");
    expect(xml).toContain("Origine &amp; analyse consultable.");
    expect(xml).not.toContain("Fleur A&B <test>");
  });

  it("omits catalog entries without a real publication date", () => {
    const xml = buildDiscoveryFeed({
      baseUrl: "https://www.leschanvriersbretons.com",
      products: [{ ...product, id: "undated", updatedAt: undefined }],
      posts: [],
    });

    expect(xml).not.toContain("/undated");
  });

  it("is advertised from the root HTML head", () => {
    const layoutSource = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");

    expect(layoutSource).toContain('type="application/atom+xml"');
    expect(layoutSource).toContain('href="/feed.xml"');
  });
});
