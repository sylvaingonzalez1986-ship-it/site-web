import type { KqFlavorCode } from "./kanab-quest-buddie-flavors";

/** Fictional market profiles for Kanab Quest, not surveys of real Breton shops. */
export type KqProspectingDepartmentCode = "22" | "29" | "35" | "56";
export type KqProspectingProduct = {
  family: "flower" | "hash" | "rosin";
  label: string;
  interest: "high" | "regular" | "niche";
  examples: readonly string[];
};
export type KqProspectingDepartment = {
  code: KqProspectingDepartmentCode; name: string; description: string;
  flavors: readonly KqFlavorCode[]; products: readonly KqProspectingProduct[];
};
export type KqProspectingCity = {
  id: string; name: string; department: KqProspectingDepartmentCode; departmentName: string;
  travelCents: number;
  /** Local activity adds to the prospecting chance; never a finite pool of shops. */
  prospectIntensity: number;
  description: string; flavors: readonly KqFlavorCode[]; products: readonly KqProspectingProduct[];
};
export const KQ_PROSPECTING_INTEREST_LABELS = { high: "Très recherché", regular: "Recherché", niche: "Clientèle ciblée" } as const;
const flower = (interest: KqProspectingProduct["interest"]): KqProspectingProduct => ({ family: "flower", label: "Fleurs", interest, examples: ["Fleurs entières", "Lots affinés"] });
const hash = (interest: KqProspectingProduct["interest"], examples: readonly string[]): KqProspectingProduct => ({ family: "hash", label: "Hash", interest, examples });
const rosin = (interest: KqProspectingProduct["interest"], examples: readonly string[]): KqProspectingProduct => ({ family: "rosin", label: "Rosin", interest, examples });

export const KQ_PROSPECTING_DEPARTMENTS: readonly KqProspectingDepartment[] = [
  { code: "22", name: "Côtes-d’Armor", description: "Un marché de proximité : fleurs expressives et hash aux notes profondes.", flavors: ["terre", "miel"], products: [hash("high", ["Hash tamisé", "Hash eau-glace"]), flower("regular"), rosin("niche", ["Rosin Sélection"])] },
  { code: "29", name: "Finistère", description: "Des boutiques attentives aux résines et aux profils boisés ou frais.", flavors: ["pin", "citron"], products: [hash("high", ["Hash tamisé", "Static Sift"]), flower("regular"), rosin("niche", ["Rosin Sélection"])] },
  { code: "35", name: "Ille-et-Vilaine", description: "Un marché varié : fleurs fruitées et extraits de sélection pour les boutiques spécialisées.", flavors: ["agrumes", "fruits-tropicaux"], products: [flower("high"), rosin("regular", ["Rosin Sélection", "Rosin Premium"]), hash("regular", ["Static Sift", "Hash eau-glace"])] },
  { code: "56", name: "Morbihan", description: "Fleurs florales et gourmandes, avec des débouchés plus spécialisés pour les extraits.", flavors: ["floral", "baies"], products: [flower("high"), hash("regular", ["Hash eau-glace"]), rosin("regular", ["Rosin Premium"])] },
];

/** Stable city IDs preserve existing missions and cumulative recruiting history. */
export const KQ_STAFF_CITIES: readonly KqProspectingCity[] = [
  { id: "rennes", name: "Rennes", department: "35", departmentName: "Ille-et-Vilaine", travelCents: 4500, prospectIntensity: 12,
    description: "Les boutiques de sélection privilégient les extraits expressifs et les fleurs aux profils marqués.", flavors: ["agrumes", "diesel"], products: [rosin("high", ["Rosin Premium", "Rosin Signature"]), flower("high"), hash("regular", ["Static Sift", "Hash Signature"])] },
  { id: "saint-malo", name: "Saint-Malo", department: "35", departmentName: "Ille-et-Vilaine", travelCents: 3500, prospectIntensity: 6,
    description: "Les assortiments de fleurs fraîches et florales dominent ; les extraits complètent la sélection.", flavors: ["citron", "floral"], products: [flower("high"), rosin("regular", ["Rosin Sélection"]), hash("niche", ["Hash eau-glace"])] },
  { id: "brest", name: "Brest", department: "29", departmentName: "Finistère", travelCents: 6000, prospectIntensity: 10,
    description: "Les résines de caractère occupent le premier plan, avec des fleurs fraîches et épicées en complément.", flavors: ["pin", "epices"], products: [hash("high", ["Hash tamisé", "Static Sift"]), flower("regular"), rosin("niche", ["Rosin Sélection"])] },
  { id: "quimper", name: "Quimper", department: "29", departmentName: "Finistère", travelCents: 4500, prospectIntensity: 6,
    description: "Une sélection axée sur les fleurs bien affinées et les arômes doux, boisés ou miellés.", flavors: ["miel", "bois"], products: [flower("high"), hash("regular", ["Hash tamisé"]), rosin("niche", ["Rosin d’essai", "Rosin Sélection"])] },
  { id: "saint-brieuc", name: "Saint-Brieuc", department: "22", departmentName: "Côtes-d’Armor", travelCents: 3500, prospectIntensity: 7,
    description: "Le hash et les profils terreux ou résineux attirent les boutiques de ce secteur.", flavors: ["terre", "encens"], products: [hash("high", ["Hash tamisé", "Hash eau-glace"]), flower("regular"), rosin("niche", ["Rosin Sélection"])] },
  { id: "lannion", name: "Lannion", department: "22", departmentName: "Côtes-d’Armor", travelCents: 3000, prospectIntensity: 4,
    description: "Les fleurs fruitées et fraîches dominent, avec une clientèle curieuse des rosins de sélection.", flavors: ["fruits-des-bois", "menthe"], products: [flower("high"), rosin("regular", ["Rosin Sélection", "Rosin Premium"]), hash("niche", ["Static Sift"])] },
  { id: "vannes", name: "Vannes", department: "56", departmentName: "Morbihan", travelCents: 4000, prospectIntensity: 7,
    description: "Les fleurs soignées et les extraits fins sont recherchés dans des profils floraux et crémeux.", flavors: ["floral", "creme"], products: [flower("high"), rosin("high", ["Rosin Premium", "Rosin Signature"]), hash("niche", ["Hash Signature"])] },
  { id: "lorient", name: "Lorient", department: "56", departmentName: "Morbihan", travelCents: 4500, prospectIntensity: 7,
    description: "Les boutiques cherchent des résines expressives, avec des notes tropicales et épicées.", flavors: ["mangue", "poivre"], products: [hash("high", ["Hash eau-glace", "Static Sift"]), rosin("regular", ["Rosin Sélection"]), flower("regular")] },
];
