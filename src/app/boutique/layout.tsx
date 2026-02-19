import type { Metadata } from "next";
import { BreadcrumbJsonLd, ProductListJsonLd } from "@/components/JsonLd";
import { readStoreByBackend } from "@/lib/data-backend";

export const metadata: Metadata = {
  title: "Boutique CBD Pas Cher | Fleurs, Huiles, Résines CBD Bio",
  description:
    "Achetez du CBD bio pas cher : fleurs, huiles, résines, cosmétiques et infusions CBD de qualité. Prix discount, livraison rapide en France. Shop CBD breton.",
  alternates: {
    canonical: "https://leschanvriersbretons.com/boutique",
  },
  openGraph: {
    title: "Boutique CBD Pas Cher — Les Chanvriers Bretons",
    description:
      "Tous nos produits CBD bio au meilleur prix. Fleurs, huiles, résines, cosmétiques et alimentaire CBD.",
    url: "https://leschanvriersbretons.com/boutique",
  },
};

export default async function BoutiqueLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const store = await readStoreByBackend();

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", url: "https://leschanvriersbretons.com" },
          {
            name: "Boutique CBD",
            url: "https://leschanvriersbretons.com/boutique",
          },
        ]}
      />
      <ProductListJsonLd products={store.products} producers={store.producers} />
      {children}
    </>
  );
}
