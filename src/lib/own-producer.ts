import type { Product } from "@/data/products";
import type { Producer } from "@/types/store";

export const OWN_PRODUCER_ID = "les-chanvriers-bretons";

const OWN_PRODUCER: Producer = {
  id: OWN_PRODUCER_ID,
  name: "Les Chanvriers Bretons",
  description:
    "La selection maison signee Les Chanvriers Bretons, pensee en Bretagne avec une ligne claire: local, lisible et sans blabla.",
  image: "/sylvain.png",
  location: "Bretagne",
  department: "",
  region: "Bretagne",
  website: "https://leschanvriersbretons.com",
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

export function getOwnProducer(): Producer {
  return OWN_PRODUCER;
}

export function resolveProductProducer(
  product: Product,
  producerById: ReadonlyMap<string, Producer>,
): Producer | undefined {
  if (!product.producerId) {
    return OWN_PRODUCER;
  }

  return producerById.get(product.producerId);
}
