/** Game illustrations drawn from retailer photographs of real product packaging. */
const productArtwork: Record<string, { src: string; alt: string; referenceLabel?: string; referenceUrl?: string }> = {
  "CARE-COMPOST-TEA": { src: "/app/kanab-quest/care/compost-tea-v1.webp", alt: "Dessin du pack d’ingrédients Terralba pour thé de compost", referenceLabel: "Pack TCO Terralba · Alchimia", referenceUrl: "https://www.alchimiaweb.com/fr/pack-croissance-tco-terralba-product-11311.php" },
  "CARE-VERMICOMPOST": { src: "/app/kanab-quest/care/vermicompost-v1.webp", alt: "Dessin du sac vert de lombricompost Worm·Humus BioBizz", referenceLabel: "Worm·Humus BioBizz · Alchimia", referenceUrl: "https://www.alchimiaweb.com/fr/biobizz-worm-humus-40-l-product-18550.php" },
  "CARE-ORGANIC-FEED": { src: "/app/kanab-quest/care/organic-feed-v1.webp", alt: "Dessin des flacons Bio·Grow et Bio·Bloom de BioBizz", referenceLabel: "Bio·Grow / Bio·Bloom · Alchimia", referenceUrl: "https://www.alchimiaweb.com/fr/bio-bizz-bio-grow-1-l-product-241.php" },
  "CARE-SEAWEED": { src: "/app/kanab-quest/care/seaweed-v1.webp", alt: "Dessin du flacon vert Alg·A·Mic BioBizz à bouchon blanc", referenceLabel: "Alg·A·Mic BioBizz · Alchimia", referenceUrl: "https://www.alchimiaweb.com/fr/bio-bizz-algamic-1-l-product-243.php" },
  "CARE-APHIDIUS": { src: "/app/kanab-quest/care/aphidius-v1.webp", alt: "Dessin du flacon Aphipar contenant Aphidius colemani", referenceLabel: "Aphipar · Saltón Verde", referenceUrl: "https://saltonverde.com/fr/produit/aphipar-aphidius-colemani-koppert/" },
  "CARE-PHYTOSEIULUS": { src: "/app/kanab-quest/care/phytoseiulus-v1.webp", alt: "Dessin du flacon Spidex Vital contenant Phytoseiulus persimilis", referenceLabel: "Spidex Vital · Koppert Retail", referenceUrl: "https://retail.koppert.ca/fr/products/spidex-vital" },
  "CARE-SWIRSKII": { src: "/app/kanab-quest/care/swirskii-v1.webp", alt: "Dessin du sachet suspendu Swirski-Mite Plus", referenceLabel: "Swirski-Mite Plus · Koppert Retail", referenceUrl: "https://retail.koppert.ca/collections/amblyseius-swirskii/products/swirskimite-plus" },
  "CARE-ORIUS": { src: "/app/kanab-quest/care/orius-v1.webp", alt: "Dessin du flacon Thripor-L contenant Orius laevigatus", referenceLabel: "Thripor-L · Saltón Verde", referenceUrl: "https://www.saltonverde.com/fr/produit/thripor-l-orius-laevigatus-koppert/" },
  "CARE-CHRYSOPERLA": { src: "/app/kanab-quest/care/chrysoperla-v1.webp", alt: "Dessin du flacon Chrysopa contenant des larves de chrysope", referenceLabel: "Chrysopa · Koppert Retail", referenceUrl: "https://retail.koppert.ca/products/chrysopa" },
  "CARE-COCCINELLA": { src: "/app/kanab-quest/care/coccinella-v1.webp", alt: "Dessin du pot Plantura de coccinelles à sept points", referenceLabel: "Coccinelles à sept points · Plantura", referenceUrl: "https://shop.plantura.garden/products/marienkaefer" },
};

export const KQ_CARE_HEALTH_ARTWORK = {
  src: "/app/kanab-quest/care/plant-health-v1.webp",
  alt: "Illustration botanique d’un plant de chanvre dans un pot en terre cuite",
};

export function getKqCareProductArtwork(code: string) {
  return productArtwork[code];
}
