import type { Metadata } from "next";
import { BreadcrumbJsonLd } from "@/components/JsonLd";

const BASE_URL = "https://leschanvriersbretons.com";

const categoryMeta: Record<
  string,
  { title: string; description: string; label: string }
> = {
  "fleurs-cbd": {
    title: "Fleurs CBD Bio Pas Cher | Qualite Premium",
    description:
      "Achetez des fleurs CBD bio pas cher. Qualite premium, aromes naturels, analyses en laboratoire. Livraison rapide en France.",
    label: "Fleurs CBD",
  },
  "resines-cbd": {
    title: "Resines CBD Bio | Qualite Premium",
    description:
      "Achetez des resines CBD bio pas cher. Texture et aromes maitrises, analyses en laboratoire. Livraison rapide en France.",
    label: "Resines CBD",
  },
  "huiles-cbd": {
    title: "Huiles CBD Bio | Full Spectrum et Broad Spectrum",
    description:
      "Huiles CBD bio full spectrum et broad spectrum a petit prix. Shop CBD breton, livraison France.",
    label: "Huiles CBD",
  },
  "e-liquide-cbd": {
    title: "E-liquides CBD | Vape CBD",
    description:
      "E-liquides CBD au profil aromatique maitrise et dosage transparent. Livraison rapide en France.",
    label: "E-liquides CBD",
  },
  "cosmetiques-cbd": {
    title: "Cosmetiques CBD Bio | Baumes, Cremes et Soins au Chanvre",
    description:
      "Cosmetiques CBD bio : baumes reparateurs, cremes hydratantes et huiles de massage au chanvre.",
    label: "Cosmetiques CBD",
  },
  "tisane-cbd": {
    title: "Tisane CBD Bio | Infusions au Chanvre",
    description:
      "Tisanes et infusions CBD bio au chanvre. Relaxation et plaisir au quotidien.",
    label: "Tisane CBD",
  },
  "alimentaire-cbd": {
    title: "Tisane CBD Bio | Infusions au Chanvre",
    description:
      "Tisanes et infusions CBD bio au chanvre. Relaxation et plaisir au quotidien.",
    label: "Tisane CBD",
  },
  "accessoires-cbd": {
    title: "Accessoires CBD | Grinders, Pochons et Kits Decouverte",
    description:
      "Accessoires CBD de qualite : grinders, pochons hermetiques, plateaux et kits decouverte.",
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
    return { title: "Categorie introuvable" };
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
