import type { TerpeneAromaFamily, TerpeneFamily, TerpeneIdentification, TerpeneBiology } from "./kanab-quest-school-terpenes-types";
export const TERPENE_FAMILY_LABELS: Record<TerpeneFamily, string> = {
  "monoterpene-hydrocarbon": "Monoterpène · hydrocarbure", "oxygenated-monoterpene": "Monoterpénoïde · oxygéné",
  "sesquiterpene-hydrocarbon": "Sesquiterpène · hydrocarbure", "oxygenated-sesquiterpene": "Sesquiterpénoïde · oxygéné", other: "Autre famille chimique",
};
export const TERPENE_IDENTIFICATION_LABELS: Record<TerpeneIdentification["level"], string> = {
  "reference-standard": "Comparaison à un standard", "ri-ms-supported": "Spectre et indice de rétention", tentative: "Attribution provisoire", "not-established": "Identification non établie",
};
export const TERPENE_MODEL_LABELS: Record<TerpeneBiology["model"], string> = {
  "plant-enzyme": "Enzyme végétale", "plant-ecology": "Écologie végétale", cell: "Cellules", animal: "Animaux", human: "Humains", analytical: "Analyse chimique",
};
export const TERPENE_AROMA_FAMILIES: readonly Readonly<{ id: TerpeneAromaFamily; label: string; examples: string; color: string; flavor: string }>[] = [
  { id: "citrus", label: "Agrumes", examples: "Zeste, citron, orange : des ressemblances à préciser, sans déduire une molécule unique.", color: "#e8b646", flavor: "agrumes" },
  { id: "floral", label: "Floral", examples: "Une impression de fleurs ; le mot ne décrit ni une famille chimique ni un effet relaxant.", color: "#c7a2b5", flavor: "floral" },
  { id: "fruity", label: "Fruité", examples: "Pomme, baies ou fruits tropicaux : plusieurs familles chimiques peuvent participer au mélange.", color: "#dd9562", flavor: "fruite" },
  { id: "herbal", label: "Végétal", examples: "Herbe, feuille, résine : préciser le terme facilite la comparaison des descriptions.", color: "#99b68b", flavor: "pin" },
  { id: "woody", label: "Boisé", examples: "Bois ou pin : une analogie sensorielle, pas la preuve de la présence d’un pinène.", color: "#c7ac77", flavor: "bois" },
  { id: "spicy", label: "Épicé", examples: "Poivre, épices : l’odeur et une sensation piquante ne sont pas exactement la même information.", color: "#da9d83", flavor: "poivre" },
  { id: "earthy", label: "Terreux", examples: "Terre ou sous-bois : un vocabulaire descriptif dont le contexte doit être précisé.", color: "#a8b4a4", flavor: "terre" },
  { id: "sulfurous", label: "Soufré", examples: "Certains composés soufrés évoquent l’ail ou des notes animales ; tous n’ont pas la même odeur.", color: "#d8ce88", flavor: "oignon" },
  { id: "other", label: "Autres / incertain", examples: "Conserver une description incertaine est préférable à imposer une catégorie. Une fiche peut avoir plusieurs notes.", color: "#d5dcd8", flavor: "musque" },
];
