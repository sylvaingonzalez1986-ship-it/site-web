import type { Product } from "@/data/products";
import type { Producer, SiteContent } from "@/types/store";

export const OWN_PRODUCER_ID = "les-chanvriers-bretons";

export const DEFAULT_OWN_PRODUCER: Producer = {
  id: OWN_PRODUCER_ID,
  name: "Les Chanvriers Bretons",
  description:
    "La selection maison signee Les Chanvriers Bretons, pensee en Bretagne avec une ligne claire: local, lisible et sans blabla.",
  image: "/sylvain.png",
  location: "Bretagne",
  department: "",
  region: "Bretagne",
  website: "https://www.leschanvriersbretons.com",
  socialLinks: {
    instagram: "https://www.instagram.com/leschanvriersbretons",
    facebook: "https://www.facebook.com/leschanvriersbretons",
    tiktok: "https://www.tiktok.com/@leschanvriersbretons",
  },
  cultureType: ["greenhouse", "outdoor"],
  climate: "oceanique",
  soil: "sol-limono-sableux",
  altitude: "Niveau de la mer",
  certifications: ["Selection maison", "Analyses labo"],
  speciality: "CBD bio breton",
  philosophy:
    "Des produits que nous signerions nous-memes: traces, coherents, et assez bons pour porter le nom de la maison.",
  experience: "Selection maison",
  founded: "2024",
};

export function mergeOwnProducer(value: unknown): Producer {
  const candidate =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<Producer>)
      : {};
  const socialLinks =
    candidate.socialLinks && typeof candidate.socialLinks === "object"
      ? candidate.socialLinks
      : {};

  return {
    ...DEFAULT_OWN_PRODUCER,
    ...candidate,
    id:
      typeof candidate.id === "string" && candidate.id.trim().length > 0
        ? candidate.id.trim()
        : OWN_PRODUCER_ID,
    socialLinks: {
      ...DEFAULT_OWN_PRODUCER.socialLinks,
      ...socialLinks,
    },
  };
}

export function getOwnProducer(
  boutique?: Pick<SiteContent["boutique"], "ownProducer"> | null,
): Producer {
  return mergeOwnProducer(boutique?.ownProducer);
}

export function resolveProductProducer(
  product: Product,
  producerById: ReadonlyMap<string, Producer>,
  ownProducer = DEFAULT_OWN_PRODUCER,
): Producer | undefined {
  if (!product.producerId) {
    return ownProducer;
  }

  return producerById.get(product.producerId);
}

export function isOwnProduct(product: Product): boolean {
  return !product.producerId || product.producerId === OWN_PRODUCER_ID;
}

export function sortOwnProductsFirst(products: Product[]): Product[] {
  const ownProducts: Product[] = [];
  const partnerProducts: Product[] = [];

  for (const product of products) {
    if (isOwnProduct(product)) {
      ownProducts.push(product);
      continue;
    }

    partnerProducts.push(product);
  }

  return [...ownProducts, ...partnerProducts];
}
