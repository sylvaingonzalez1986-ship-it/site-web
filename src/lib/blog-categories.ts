import type { BlogCategory } from "@/types/store";

export const BLOG_CATEGORY_LABELS: Record<BlogCategory, string> = {
  guide: "Guide",
  actualite: "Actualite",
  "bien-etre": "Bien-etre",
  legislation: "Legislation",
  chronique: "Chronique d'un chanvrier",
  miam: "Miam",
};

export const BLOG_CATEGORY_SHOP_LINKS: Record<BlogCategory, Array<{ href: string; label: string }>> = {
  guide: [
    { href: "/boutique/fleurs-cbd", label: "Decouvrir nos Fleurs CBD" },
    { href: "/boutique/huiles-cbd", label: "Voir nos Huiles CBD" },
    { href: "/boutique/tisane-cbd", label: "Explorer nos Tisanes CBD" },
  ],
  actualite: [
    { href: "/boutique", label: "Voir toute la boutique CBD" },
    { href: "/boutique/fleurs-cbd", label: "Nouveautes Fleurs CBD" },
  ],
  "bien-etre": [
    { href: "/boutique/huiles-cbd", label: "Huiles CBD bien-etre" },
    { href: "/boutique/tisane-cbd", label: "Tisanes chanvre relaxation" },
    { href: "/boutique/cosmetiques-cbd", label: "Cosmetiques CBD" },
  ],
  legislation: [
    { href: "/boutique/fleurs-cbd", label: "Fleurs CBD conformes" },
    { href: "/boutique/resines-cbd", label: "Resines CBD analysees" },
  ],
  chronique: [
    { href: "/boutique", label: "Decouvrir notre boutique" },
    { href: "/boutique/fleurs-cbd", label: "Nos Fleurs CBD" },
  ],
  miam: [
    { href: "/boutique/alimentaire-cbd", label: "Decouvrir nos produits gourmands" },
    { href: "/boutique/tisane-cbd", label: "Voir nos tisanes pour recettes" },
    { href: "/boutique/huiles-cbd", label: "Explorer nos huiles CBD culinaires" },
  ],
};