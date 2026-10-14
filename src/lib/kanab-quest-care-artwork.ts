/** Fictional product illustrations; commercial references remain separate metadata. */
const productArtwork: Record<string, { src: string; alt: string; referenceLabel?: string; referenceUrl?: string }> = {
  "CARE-COMPOST-TEA": { src: "/placard/equipment-sylvain-v1/care-compost-tea.webp", alt: "Fournitures pour thé de compost illustrées dans le style du Placard", referenceLabel: "Pack TCO Terralba · Alchimia", referenceUrl: "https://www.alchimiaweb.com/fr/pack-croissance-tco-terralba-product-11311.php" },
  "CARE-VERMICOMPOST": { src: "/placard/equipment-sylvain-v1/care-vermicompost.webp", alt: "Lombricompost illustré dans le style du Placard", referenceLabel: "Worm·Humus BioBizz · Alchimia", referenceUrl: "https://www.alchimiaweb.com/fr/biobizz-worm-humus-40-l-product-18550.php" },
  "CARE-ORGANIC-FEED": { src: "/placard/equipment-sylvain-v1/nutrition-2.webp", alt: "Fournitures de nutrition illustrées dans le style du Placard", referenceLabel: "Bio·Grow / Bio·Bloom · Alchimia", referenceUrl: "https://www.alchimiaweb.com/fr/bio-bizz-bio-grow-1-l-product-241.php" },
  "CARE-SEAWEED": { src: "/placard/equipment-sylvain-v1/care-seaweed.webp", alt: "Soutien aux algues illustré dans le style du Placard", referenceLabel: "Alg·A·Mic BioBizz · Alchimia", referenceUrl: "https://www.alchimiaweb.com/fr/bio-bizz-algamic-1-l-product-243.php" },
  "CARE-APHIDIUS": { src: "/placard/equipment-sylvain-v1/care-aphidius.webp", alt: "Auxiliaires Aphidius illustrés dans le style du Placard", referenceLabel: "Aphipar · Saltón Verde", referenceUrl: "https://saltonverde.com/fr/produit/aphipar-aphidius-colemani-koppert/" },
  "CARE-PHYTOSEIULUS": { src: "/placard/equipment-sylvain-v1/care-phytoseiulus.webp", alt: "Auxiliaires Phytoseiulus illustrés dans le style du Placard", referenceLabel: "Spidex Vital · Koppert Retail", referenceUrl: "https://retail.koppert.ca/fr/products/spidex-vital" },
  "CARE-SWIRSKII": { src: "/placard/equipment-sylvain-v1/care-swirskii.webp", alt: "Auxiliaires Swirskii illustrés dans le style du Placard", referenceLabel: "Swirski-Mite Plus · Koppert Retail", referenceUrl: "https://retail.koppert.ca/collections/amblyseius-swirskii/products/swirskimite-plus" },
  "CARE-ORIUS": { src: "/placard/equipment-sylvain-v1/care-orius.webp", alt: "Auxiliaires Orius illustrés dans le style du Placard", referenceLabel: "Thripor-L · Saltón Verde", referenceUrl: "https://www.saltonverde.com/fr/produit/thripor-l-orius-laevigatus-koppert/" },
  "CARE-CHRYSOPERLA": { src: "/placard/equipment-sylvain-v1/care-chrysoperla.webp", alt: "Chrysopes illustrées dans le style du Placard", referenceLabel: "Chrysopa · Koppert Retail", referenceUrl: "https://retail.koppert.ca/products/chrysopa" },
  "CARE-COCCINELLA": { src: "/placard/equipment-sylvain-v1/care-coccinella.webp", alt: "Coccinelles illustrées dans le style du Placard", referenceLabel: "Coccinelles à sept points · Plantura", referenceUrl: "https://shop.plantura.garden/products/marienkaefer" },
};

export const KQ_CARE_HEALTH_ARTWORK = {
  src: "/app/kanab-quest/care/plant-health-v1.webp",
  alt: "Illustration botanique d’un plant de chanvre dans un pot en terre cuite",
};

export function getKqCareProductArtwork(code: string) {
  return productArtwork[code];
}
