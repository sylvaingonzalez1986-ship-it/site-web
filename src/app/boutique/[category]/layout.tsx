import type { Metadata } from "next";
import { BreadcrumbJsonLd } from "@/components/JsonLd";

const BASE_URL = "https://leschanvriersbretons.com";

const categoryMeta: Record<
  string,
  { title: string; description: string; label: string }
> = {
  "fleurs-cbd": {
    title: "Fleurs CBD Bio Bretagne Pas Cher | Qualité Premium",
    description:
      "Achetez des fleurs CBD bio pas cher en Bretagne. Qualité premium, arômes naturels, analysées en laboratoire. Shop CBD breton, livraison rapide en France.",
    label: "Fleurs CBD",
  },
  "resines-cbd": {
    title: "Résines CBD Bio Bretagne | Qualité Premium Pas Cher",
    description:
      "Résines CBD bio de qualité premium. Texture et arômes maîtrisés, analyses en laboratoire. Shop CBD breton, livraison rapide en France.",
    label: "Résines CBD",
  },
  "huiles-cbd": {
    title: "Huiles CBD Bio | Full Spectrum et Broad Spectrum Bretagne",
    description:
      "Huiles CBD bio full spectrum et broad spectrum à petit prix. Shop CBD breton, producteurs de qualité, livraison rapide en France.",
    label: "Huiles CBD",
  },
  "e-liquide-cbd": {
    title: "E-liquides CBD | Vape CBD Bretagne",
    description:
      "E-liquides CBD au profil aromatique maîtrisé et dosage transparent. Shop CBD breton, livraison rapide en France.",
    label: "E-liquides CBD",
  },
  "cosmetiques-cbd": {
    title: "Cosmétiques CBD Bio | Baumes, Crèmes et Soins au Chanvre Breton",
    description:
      "Cosmétiques CBD bio : baumes réparateurs, crèmes hydratantes et huiles de massage au chanvre. Soins naturels bretons.",
    label: "Cosmétiques CBD",
  },
  "tisane-cbd": {
    title: "Tisane CBD Bio | Infusions au Chanvre Breton",
    description:
      "Tisanes et infusions CBD bio au chanvre breton. Relaxation et plaisir au quotidien. Livraison rapide en France.",
    label: "Tisane CBD",
  },
  "miam-cbd": {
    title: "Miam CBD | Produits Gourmands au Chanvre Breton",
    description:
      "Produits alimentaires et gourmandises CBD bio au chanvre breton. Plaisir gustatif et bien-être au quotidien. Livraison rapide en France.",
    label: "Miam CBD",
  },
  "alimentaire-cbd": {
    title: "Alimentaire CBD Bio | Produits au Chanvre Breton",
    description:
      "Produits alimentaires CBD bio au chanvre breton. Bien-être et plaisir gustatif au quotidien. Livraison rapide en France.",
    label: "Alimentaire CBD",
  },
  "accessoires-cbd": {
    title: "Accessoires CBD | Grinders, Pochons et Kits Découverte",
    description:
      "Accessoires CBD de qualité : grinders, pochons hermétiques, plateaux et kits découverte. Shop CBD breton.",
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
