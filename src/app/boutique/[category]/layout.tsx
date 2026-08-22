import type { Metadata } from "next";
import { BreadcrumbJsonLd } from "@/components/JsonLd";

const BASE_URL = "https://www.leschanvriersbretons.com";

const categoryMeta: Record<
  string,
  { title: string; description: string; label: string }
> = {
  "fleurs-cbd": {
    title: "Fleurs CBD | Origine, culture et analyses disponibles",
    description:
      "Découvrez nos fleurs CBD : producteur ou marque, origine, mode de culture, formats et analyses disponibles indiqués sur chaque fiche.",
    label: "Fleurs CBD",
  },
  "resines-cbd": {
    title: "Résines CBD | Composition, origine et analyses",
    description:
      "Découvrez nos résines CBD avec leur producteur ou marque, leur composition, leurs formats et les analyses disponibles par référence.",
    label: "Résines CBD",
  },
  "huiles-cbd": {
    title: "Huiles CBD | Composition et dosages indiqués",
    description:
      "Comparez les huiles CBD selon leur composition, leur dosage, leur marque ou producteur et les informations disponibles sur chaque fiche.",
    label: "Huiles CBD",
  },
  "e-liquide-cbd": {
    title: "E-liquides CBD | Composition et dosage",
    description:
      "Consultez nos e-liquides CBD avec leur composition, leur dosage, leur marque et leurs précautions d'utilisation.",
    label: "E-liquides CBD",
  },
  "cosmetiques-cbd": {
    title: "Cosmétiques CBD | Composition et utilisation",
    description:
      "Découvrez les cosmétiques au CBD et au chanvre. Composition, marque, format et conseils d'utilisation sont détaillés par produit.",
    label: "Cosmétiques CBD",
  },
  "tisane-cbd": {
    title: "Tisanes CBD et infusions au chanvre | Composition",
    description:
      "Tisanes CBD et infusions au chanvre : origine des ingrédients, composition, producteur ou marque et formats indiqués par référence.",
    label: "Tisane CBD",
  },
  "miam-cbd": {
    title: "Produits gourmands au CBD et au chanvre",
    description:
      "Découvrez les produits gourmands au CBD et au chanvre avec leur composition, leur origine et leur marque indiquées sur chaque fiche.",
    label: "Miam CBD",
  },
  "alimentaire-cbd": {
    title: "Produits alimentaires au CBD et au chanvre",
    description:
      "Produits alimentaires au CBD et au chanvre : composition, origine, allergènes et marque à vérifier sur chaque référence.",
    label: "Alimentaire CBD",
  },
  "accessoires-cbd": {
    title: "Accessoires CBD | Grinders, conservation et découverte",
    description:
      "Accessoires pour préparer ou conserver les produits CBD : grinders, contenants, plateaux et kits disponibles dans la boutique.",
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
