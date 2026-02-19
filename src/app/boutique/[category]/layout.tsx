import type { Metadata } from "next";
import { BreadcrumbJsonLd } from "@/components/JsonLd";

const BASE_URL = "https://leschanvriersbretons.com";

const categoryMeta: Record<
  string,
  { title: string; description: string; label: string }
> = {
  "fleurs-cbd": {
    title: "Fleurs CBD Bio Pas Cher | Résines CBD Qualité Premium",
    description:
      "Achetez des fleurs et résines CBD bio pas cher. Qualité premium, arômes naturels, analysées en laboratoire. Livraison rapide en France. Shop CBD breton.",
    label: "Fleurs & Résines CBD",
  },
  "huiles-cbd": {
    title: "Huiles CBD Bio | Full Spectrum & Broad Spectrum Pas Cher",
    description:
      "Huiles CBD bio full spectrum et broad spectrum à petit prix. 10%, 20%, menthe ou nature. Shop CBD breton, livraison France.",
    label: "Huiles CBD",
  },
  "cosmetiques-cbd": {
    title: "Cosmétiques CBD Bio | Baumes, Crèmes & Soins au Chanvre",
    description:
      "Cosmétiques CBD bio : baumes réparateurs, crèmes hydratantes et huiles de massage au chanvre. Soins naturels pas cher.",
    label: "Cosmétiques CBD",
  },
  "alimentaire-cbd": {
    title: "Alimentaire CBD Bio | Infusions, Gummies & Miel au Chanvre",
    description:
      "Produits alimentaires CBD bio : infusions relaxantes, gummies fruités et miel au chanvre. Gourmand et pas cher.",
    label: "Alimentaire CBD",
  },
  "accessoires-cbd": {
    title: "Accessoires CBD | Grinders, Pochons & Kits Découverte",
    description:
      "Accessoires CBD de qualité : grinders, pochons hermétiques, plateaux et kits découverte. Tout pour le CBD pas cher.",
    label: "Accessoires CBD",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const meta = categoryMeta[category];

  if (!meta) {
    return { title: "Catégorie introuvable" };
  }

  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: `${BASE_URL}/boutique/${category}`,
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `${BASE_URL}/boutique/${category}`,
    },
  };
}

export default async function CategoryLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const meta = categoryMeta[category];

  return (
    <>
      {meta && (
        <BreadcrumbJsonLd
          items={[
            { name: "Accueil", url: BASE_URL },
            { name: "Boutique CBD", url: `${BASE_URL}/boutique` },
            { name: meta.label, url: `${BASE_URL}/boutique/${category}` },
          ]}
        />
      )}
      {children}
    </>
  );
}
