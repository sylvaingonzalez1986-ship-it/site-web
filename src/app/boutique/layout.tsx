import type { Metadata } from "next";
import { BreadcrumbJsonLd, ProductListJsonLd } from "@/components/JsonLd";
import { readStoreByBackend } from "@/lib/data-backend";

export const metadata: Metadata = {
  title: "Boutique CBD Pas Cher | Fleurs, Resines, Huiles et E-liquides CBD",
  description:
    "Achetez du CBD bio pas cher : fleurs, resines, huiles, e-liquides, cosmetiques et tisanes CBD de qualite. Prix discount, livraison rapide en France. Shop CBD breton.",
  alternates: {
    canonical: "https://leschanvriersbretons.com/boutique",
  },
  openGraph: {
    title: "Boutique CBD Pas Cher — Les Chanvriers Bretons",
    description:
      "Tous nos produits CBD bio au meilleur prix. Fleurs, resines, huiles, e-liquides, cosmetiques et tisane CBD.",
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
