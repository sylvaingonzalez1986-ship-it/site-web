import type {
  ContestEntryCategory,
  ContestLinkedProduct,
  ContestReviewEligibilityReason,
  ContestReviewScore,
} from "@/types/contest";

const PRODUCT_CATEGORY_SLUGS: Record<string, string> = {
  fleurs: "fleurs-cbd",
  resines: "resines-cbd",
  huiles: "huiles-cbd",
  "e-liquide": "e-liquide-cbd",
  cosmetiques: "cosmetiques-cbd",
  alimentaire: "tisane-cbd",
  miam: "miam-cbd",
  accessoires: "accessoires-cbd",
};

export const CONTEST_CATEGORY_THEME: Record<
  ContestEntryCategory,
  {
    chipClass: string;
    panelClass: string;
    accentClass: string;
    borderClass: string;
  }
> = {
  outdoor: {
    chipClass: "bg-[#ffe19b] text-[#7a5400]",
    panelClass: "bg-[linear-gradient(180deg,#fff6df_0%,#f6ead1_100%)]",
    accentClass: "text-[#7a5400]",
    borderClass: "border-[#d29a23]",
  },
  greenhouse: {
    chipClass: "bg-[#bfe8cb] text-[#1f5a2f]",
    panelClass: "bg-[linear-gradient(180deg,#eefaf2_0%,#dff2e5_100%)]",
    accentClass: "text-[#1f5a2f]",
    borderClass: "border-[#5b9c6f]",
  },
  indoor: {
    chipClass: "bg-[#d8c2ef] text-[#3b1d5f]",
    panelClass: "bg-[linear-gradient(180deg,#f7efff_0%,#ebe0fb_100%)]",
    accentClass: "text-[#532d7d]",
    borderClass: "border-[#8d67ba]",
  },
};

export const CONTEST_CATEGORY_DESCRIPTIONS: Record<ContestEntryCategory, string> = {
  outdoor: "Les fleurs qui prouvent qu'une grande outdoor peut jouer au-dessus du prix standard.",
  greenhouse: "Les profils propres, lumineux et réguliers qui montent en gamme sous serre.",
  indoor: "Les lots de précision pour les amateurs de profils techniques et denses.",
};

export function formatContestAverage(value: number): string {
  if (!Number.isFinite(value)) {
    return "0,0";
  }

  return value.toFixed(1).replace(".", ",");
}

export function formatContestDate(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(parsed));
}

export function getContestProductHref(product?: ContestLinkedProduct | null): string | null {
  if (!product?.id || !product.category) {
    return null;
  }

  const categorySlug = PRODUCT_CATEGORY_SLUGS[product.category];
  if (!categorySlug) {
    return null;
  }

  return `/boutique/${categorySlug}/${product.id}`;
}

export function getContestEligibilityMessage(reason: ContestReviewEligibilityReason): string {
  switch (reason) {
    case "not_authenticated":
      return "Connecte-toi pour enregistrer ton pseudo dégustateur et remplir ton carnet.";
    case "missing_profile":
      return "Choisis d'abord ton pseudo dégustateur pour participer à la notation publique.";
    case "already_reviewed":
      return "Ton carnet existe déjà pour ce lot. Tu peux suivre sa modération ci-dessous.";
    case "not_purchased":
      return "Le carnet est réservé aux clients ayant acheté ce lot premium.";
    case "entry_unavailable":
      return "Ce lot n'est plus disponible pour la dégustation.";
    case "ok":
    default:
      return "Tu peux remplir ton carnet de dégustation et publier une critique après modération.";
  }
}

export function getContestReviewAverage(scores: ContestReviewScore[]): number {
  if (scores.length === 0) {
    return 0;
  }

  const total = scores.reduce((sum, score) => sum + score.score, 0);
  return Number((total / scores.length).toFixed(1));
}
