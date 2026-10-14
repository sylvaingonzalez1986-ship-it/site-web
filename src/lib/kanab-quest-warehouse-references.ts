import type { KqWarehouseCommercialReference } from "./kanab-quest-warehouse-references-types";
import { KQ_WAREHOUSE_FACILITY_REFERENCES } from "./kanab-quest-warehouse-references-facility";
import { KQ_WAREHOUSE_GROW_REFERENCES } from "./kanab-quest-warehouse-references-grow";
import { KQ_WAREHOUSE_SUPPLIES_REFERENCES } from "./kanab-quest-warehouse-references-supplies";
export type { KqWarehouseCommercialReference, KqWarehouseReferenceFamily } from "./kanab-quest-warehouse-references-types";
export { KQ_WAREHOUSE_REFERENCE_FAMILIES } from "./kanab-quest-warehouse-references-types";

const reference = (id: string, name: string, category: string, formats: string,
  observedPriceCents: number, priceNote: string, path: string): KqWarehouseCommercialReference => ({
  id, name, category, formats, observedPriceCents, priceNote, brand: "Terralba", currency: "EUR", priceKind: "observed",
  family: category === "Terreaux" || category === "Supports" ? "substrate" : "nutrition",
  features: [`Conditionnements proposés : ${formats}.`, "Référence du catalogue Terralba, distincte des fournitures fictives du jeu."],
  tradeoff: "Conditionnements et prix d’entrée différents selon la référence ; aucune dose réelle ni équivalence de coût par m² n’est déduite.",
  sourceUrl: `https://terralba.eu/shop/${path}`, checkedAt: "2026-10-12",
});

const TERRALBA_REFERENCES: readonly KqWarehouseCommercialReference[] = [
  reference("terre-x4", "Terre X4 composts", "Terreaux", "25 kg / 50 L · 50 kg / 100 L", 1690,
    "Prix d’entrée affiché pour 25 kg / 50 L, hors livraison.", "terreau-x4-composts-982"),
  reference("innt", "Terreau horticole INNT", "Terreaux", "10 kg / 25 L · 20 kg / 50 L · 40 et 80 kg", 1290,
    "Prix d’entrée affiché pour 10 kg / 25 L, hors livraison.", "https-terralba-eu-shop-terreau-horticole-991"),
  reference("vermiculite", "Vermiculite pure", "Supports", "5 · 10 · 25 · 50 · 100 L", 790,
    "Prix affiché sur la fiche ; les promotions du catalogue peuvent différer.", "vermiculite-pure-3-8mm-substart-neutre-aeration-15"),
  reference("perlite-vermiculite", "Perlite et vermiculite", "Supports", "5 · 10 · 25 L", 790,
    "Prix de tête de fiche ; correspondance exacte avec la variante à vérifier.", "perlite-vermiculite-3-8mm-aeration-retention-d-eau-14"),
  reference("lombricompost", "Lombricompost", "Amendements", "1 · 2 · 5 · 10 · 25 kg", 690,
    "Prix d’entrée affiché pour 1 kg, hors livraison.", "lombricompost-bio-2"),
  reference("biochar", "Biochar et matières organiques", "Amendements", "1 · 2 · 5 · 10 · 25 kg", 534,
    "Promotion affichée à la consultation, prix de référence 8,90 €.", "terralba-eu-shop-biochar-charbon-vegetal-7"),
  reference("guanogali", "Guanogali pellets", "Amendements", "100 à 500 g · 1 à 25 kg", 392,
    "Promotion affichée à la consultation, prix de référence 4,90 €.", "guanogali-pellets-engrais-organiques-gallinaces-4"),
  reference("vers-farine", "Guano de vers de farine", "Amendements", "100 à 500 g · 1 à 25 kg", 490,
    "Prix d’entrée affiché ; qualification commerciale du fabricant.", "guano-de-vers-de-farine-croissance-et-floraison-3"),
  reference("basalte", "Basalte volcanique", "Minéraux", "1 · 2 · 5 · 10 · 25 kg", 590,
    "Prix de fiche constaté ; promotion du catalogue distincte.", "basalte-volcanique-0-7-2mm-16"),
  reference("epsom", "Sel d’Epsom", "Minéraux", "100 à 500 g · 1 à 25 kg", 320,
    "Prix de fiche constaté ; promotion du catalogue distincte.", "sel-d-epsom-photosynthese-magnesium-17"),
];

export const KQ_WAREHOUSE_COMMERCIAL_REFERENCES: readonly KqWarehouseCommercialReference[] = [
  ...TERRALBA_REFERENCES,
  ...KQ_WAREHOUSE_GROW_REFERENCES,
  ...KQ_WAREHOUSE_SUPPLIES_REFERENCES,
  ...KQ_WAREHOUSE_FACILITY_REFERENCES,
];
