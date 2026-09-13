export const KQ_MISSION_TRACKS = ["culture", "online", "shops"] as const;
export type KqMissionTrack = (typeof KQ_MISSION_TRACKS)[number];
export const KQ_MISSION_COPY = {
  "first-harvest": { title: "Ta première récolte", description: "Termine une culture et récolte ta première fleur.", action: "Lancer une culture", destination: "game" },
  "three-varieties": { title: "Le goût de la variété", description: "Récolte trois variétés différentes dans le Placard.", action: "Choisir une variété", destination: "game" },
  "contest-flower": { title: "Une fleur de concours", description: "Récolte une fleur de niveau Qualité concours ou Fleur légendaire.", action: "Soigner ma culture", destination: "game" },
  "online-two": { title: "Tes premiers fidèles", description: "Atteins deux clients fidèles grâce à tes ventes en ligne.", action: "Vendre en ligne", destination: "market" },
  "online-five": { title: "Le bouche-à-oreille", description: "Fidélise cinq clients en ligne avec des lots de qualité.", action: "Développer ma clientèle", destination: "market" },
  "online-ten": { title: "Une adresse reconnue", description: "Fais grandir ta clientèle jusqu’à dix fidèles en ligne.", action: "Retrouver mes clients", destination: "market" },
  "shop-one": { title: "Ta première boutique", description: "Convaincs un CBD shop de devenir partenaire grâce à une bonne livraison.", action: "Livrer une boutique", destination: "market" },
  "shop-three": { title: "Un réseau local", description: "Développe ton réseau jusqu’à trois boutiques partenaires.", action: "Développer mon réseau", destination: "market" },
  "shop-six": { title: "La tournée du chanvrier", description: "Fournis régulièrement des lots de qualité pour atteindre six partenaires.", action: "Retrouver mes boutiques", destination: "market" },
} as const;
export type KqMissionCode = keyof typeof KQ_MISSION_COPY;
export type KqMission = {
  code: KqMissionCode; track: KqMissionTrack; step: number; target: number; progress: number;
  cardCount: number; claimed: boolean; unlocked: boolean; claimable: boolean;
  entitlementId: string | null; packAvailable: boolean | null;
};
export type KqMissionSnapshot = { collectionActive: boolean; missions: KqMission[] };
export type KqMissionClaim = { entitlementId: string; cardCount: number; replayed: boolean };
export function isKqMissionCode(value: unknown): value is KqMissionCode {
  return typeof value === "string" && Object.hasOwn(KQ_MISSION_COPY, value);
}
