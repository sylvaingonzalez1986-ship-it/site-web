export type ProductCategory =
  | "fleurs"
  | "resines"
  | "huiles"
  | "e-liquide"
  | "cosmetiques"
  | "alimentaire"
  | "miam"
  | "accessoires";

export const VAT_RATE_OPTIONS = [5.5, 20] as const;
export type VatRate = (typeof VAT_RATE_OPTIONS)[number];

export const PRODUCT_CULTURE_TYPES = [
  "indoor",
  "greenhouse",
  "outdoor",
] as const;

export type ProductCultureType = (typeof PRODUCT_CULTURE_TYPES)[number];

export const PRODUCT_CULTURE_LABELS: Record<ProductCultureType, string> = {
  indoor: "Indoor",
  greenhouse: "Greenhouse",
  outdoor: "Outdoor",
};

const CULTURE_MODE_ELIGIBLE_CATEGORIES = new Set<ProductCategory>(["fleurs", "resines"]);

export function isProductCultureModeEligible(category: ProductCategory): boolean {
  return CULTURE_MODE_ELIGIBLE_CATEGORIES.has(category);
}

export type Product = {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  name: string;
  category: ProductCategory;
  cultureMode?: ProductCultureType;
  price: number;
  vatRate?: VatRate;
  originalPrice?: number;
  promoPercent?: number;
  isPack?: boolean;
  packProductIds?: string[];
  weightGrams?: number;
  videoUrl?: string;
  image: string;
  images?: string[];
  producerId?: string;
  analysisPdf?: string;
  description: string;
  badge?: string;
  featuredInPopup?: boolean;
  bonusPoints?: number;
  trackStock?: boolean;
  stockQuantity?: number;
  variantLabel?: string;
  variantOptions?: Array<{
    id: string;
    label: string;
    price: number;
    inStock?: boolean;
    enabled?: boolean;
    stockQuantity?: number;
  }>;
};

export const categoryLabels: Record<ProductCategory, string> = {
  fleurs: "Fleurs",
  resines: "Resines",
  huiles: "Huiles",
  "e-liquide": "E-liquides",
  cosmetiques: "Cosmetiques",
  alimentaire: "Tisane",
  miam: "Miam",
  accessoires: "Accessoires",
};

const productImages = {
  flower: "/product_flower.jpg",
  resin: "/product_resin.jpg",
  tea: "/product_tea.jpg",
};

export const products: Product[] = [
  {
    id: "fleur-etoile-2g",
    name: "Fleur Etoile 2g",
    category: "fleurs",
    cultureMode: "indoor",
    price: 14.9,
    vatRate: 20,
    image: productImages.flower,
    description: "Aromes doux et notes herbacees pour un rituel detente.",
    badge: "Best seller",
  },
  {
    id: "resine-armor-5g",
    name: "Resine Armor 5g",
    category: "resines",
    cultureMode: "greenhouse",
    price: 24.9,
    vatRate: 20,
    image: productImages.resin,
    description: "Texture souple et profil boise pour plus de caractere.",
  },
  {
    id: "fleur-korrigan-10g",
    name: "Fleur Korrigan 10g",
    category: "fleurs",
    cultureMode: "outdoor",
    price: 49.9,
    vatRate: 20,
    image: productImages.flower,
    description: "Format généreux pour un usage régulier.",
  },
  {
    id: "huile-10-full",
    name: "Huile CBD 10% Full Spectrum",
    category: "huiles",
    price: 39.9,
    vatRate: 20,
    image: productImages.tea,
    description: "Huile sublinguale saveur naturelle, facile a doser.",
  },
  {
    id: "huile-20-menthe",
    name: "Huile CBD 20% Menthe",
    category: "huiles",
    price: 59.9,
    vatRate: 20,
    image: productImages.tea,
    description: "Version concentree avec une note fraiche.",
    badge: "Nouveau",
  },
  {
    id: "huile-massage",
    name: "Huile Massage Relax",
    category: "cosmetiques",
    price: 29.9,
    vatRate: 20,
    image: productImages.tea,
    description: "Soin corporel au chanvre pour routine bien-etre.",
  },
  {
    id: "baume-reparateur",
    name: "Baume Reparateur Chanvre",
    category: "cosmetiques",
    price: 18.9,
    vatRate: 20,
    image: productImages.tea,
    description: "Baume riche pour zones seches et mains sollicitees.",
  },
  {
    id: "creme-jour-cbd",
    name: "Creme Jour CBD",
    category: "cosmetiques",
    price: 21.5,
    vatRate: 20,
    image: productImages.tea,
    description: "Texture legere pour routine visage simple.",
  },
  {
    id: "eliquide-menthe-10ml",
    name: "E-liquide Menthe 10ml",
    category: "e-liquide",
    price: 14.9,
    vatRate: 20,
    image: productImages.tea,
    description: "E-liquide CBD gout menthe pour vapotage.",
  },
  {
    id: "infusion-soir",
    name: "Infusion Douce Nuit",
    category: "alimentaire",
    price: 12.5,
    vatRate: 5.5,
    image: productImages.tea,
    description: "Melange plantes et chanvre a savourer le soir.",
  },
  {
    id: "gummies-fruits",
    name: "Gummies Fruits Rouges",
    category: "alimentaire",
    price: 19.9,
    vatRate: 5.5,
    image: productImages.tea,
    description: "Format gourmand avec dosage maitrise.",
    badge: "Fun pack",
  },
  {
    id: "miel-chanvre",
    name: "Miel au Chanvre",
    category: "alimentaire",
    price: 15.9,
    vatRate: 5.5,
    image: productImages.tea,
    description: "Twist breton pour tartines et boissons chaudes.",
  },
  {
    id: "grinder-smile",
    name: "Grinder Smile",
    category: "accessoires",
    price: 9.9,
    vatRate: 20,
    image: productImages.resin,
    description: "Accessoire compact pop orange et vert.",
  },
  {
    id: "pochon-herbe",
    name: "Pochon Hermetique",
    category: "accessoires",
    price: 7.5,
    vatRate: 20,
    image: productImages.resin,
    description: "Conservation propre et pratique en deplacement.",
  },
  {
    id: "plateau-cartoon",
    name: "Plateau Cartoon",
    category: "accessoires",
    price: 16.9,
    vatRate: 20,
    image: productImages.flower,
    description: "Plateau illustre edition limitee mascotte.",
  },
  {
    id: "kit-depart",
    name: "Kit Decouverte",
    category: "accessoires",
    price: 34.9,
    vatRate: 20,
    image: productImages.flower,
    description: "Selection pour decouvrir l univers CBD.",
    badge: "Starter",
  },
];
