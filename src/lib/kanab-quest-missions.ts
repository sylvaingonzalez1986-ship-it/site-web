export const KQ_MISSION_TRACKS = ["culture", "quality", "preparation", "online", "shops"] as const;
export type KqMissionTrack = (typeof KQ_MISSION_TRACKS)[number];
export const KQ_MISSION_DIFFICULTIES = {
  1: "Découverte", 2: "Apprenti", 3: "Confirmé", 4: "Expert", 5: "Maître", 6: "Légende",
} as const;
export type KqMissionReward =
  | { kind: "cash"; amountCents: number }
  | { kind: "card"; code: string; name: string; rarity: "gold" }
  | { kind: "pack"; cardCount: number };
export type KqMissionDestination = "game" | "market" | "shop" | "workshop" | "harvests";
type MissionCopy = {
  title: string; description: string; action: string; destination: KqMissionDestination;
  progressLabel: string; difficulty: keyof typeof KQ_MISSION_DIFFICULTIES;
};
const cash = (amountCents: number): KqMissionReward => ({ kind: "cash", amountCents });
const card = (code: string, name: string): KqMissionReward => ({ kind: "card", code, name, rarity: "gold" });
const pack = (cardCount: number): KqMissionReward => ({ kind: "pack", cardCount });
function mission<const Code extends string>(code: Code, track: KqMissionTrack, step: MissionCopy["difficulty"], metric: string, target: number, reward: KqMissionReward, title: string, description: string, action: string, destination: KqMissionDestination, progressLabel: string) {
  return { code, track, step, metric, target, reward, title,
    description: track === "quality" ? `${description} Les fleurs déjà qualifiées continuent de compter.` : description,
    action, destination, progressLabel, difficulty: step };
}

/** Display/tutorial catalogue. The server independently verifies all progress and rewards. */
export const KQ_MISSION_DEFINITIONS = [
  mission("first-harvest", "culture", 1, "harvests", 1, cash(5000), "Ta première récolte",
    "Mène une culture jusqu’à la récolte. Chaque Buddie récolté ouvre la voie à de nouveaux défis.", "Lancer une culture", "game", "Cultures récoltées"),
  mission("three-varieties", "culture", 2, "varieties", 3, cash(15000), "Le goût de la variété",
    "Cultive et récolte 3 Buddies différents. Refaire la même variété ne compte qu’une fois.", "Choisir un Buddie", "game", "Buddies différents récoltés"),
  mission("five-varieties", "culture", 3, "varieties", 5, card("BOTTE-006", "Deuxième chance"), "Un jardin de caractères",
    "Récolte 5 Buddies différents et découvre leurs profils de culture.", "Varier mes cultures", "game", "Buddies différents récoltés"),
  mission("ten-varieties", "culture", 4, "varieties", 10, card("BOTTE-032", "Loupe à trichomes"), "Dix façons de cultiver",
    "Va jusqu’au bout d’une culture avec 10 Buddies différents.", "Découvrir un autre Buddie", "game", "Buddies différents récoltés"),
  mission("fifteen-varieties", "culture", 5, "varieties", 15, pack(3), "Le jardin des connaisseurs",
    "Enrichis ton expérience avec 15 Buddies différents récoltés.", "Élargir mon jardin", "game", "Buddies différents récoltés"),
  mission("twenty-varieties", "culture", 6, "varieties", 20, pack(10), "L’encyclopédie vivante",
    "Récolte 20 Buddies différents : une collection de cultures menée à son terme.", "Compléter mes cultures", "game", "Buddies différents récoltés"),
  mission("beautiful-flower", "quality", 1, "beautiful_flowers", 1, cash(7500), "Une belle pousse",
    "Récolte une fleur avec au moins 8 points de Qualité, le niveau Belle pousse.", "Soigner ma culture", "game", "Récoltes Belle pousse ou mieux"),
  mission("contest-flower", "quality", 2, "contest_flowers", 1, cash(20000), "Une fleur de concours",
    "Récolte une fleur avec au moins 14 points de Qualité, le niveau Qualité concours.", "Viser la qualité concours", "game", "Récoltes Qualité concours ou mieux"),
  mission("three-contest-flowers", "quality", 3, "contest_flowers", 3, card("BOTTE-021", "Diagnostic croisé"), "Le talent se confirme",
    "Réussis 3 récoltes de Qualité concours ou mieux : au moins 14 points de Qualité chacune.", "Améliorer mes cultures", "game", "Récoltes Qualité concours ou mieux"),
  mission("five-contest-varieties", "quality", 4, "contest_varieties", 5, card("BOTTE-030", "Sonde d’humidité"), "La qualité sous toutes ses formes",
    "Récolte 5 Buddies différents avec au moins 14 points de Qualité chacun.", "Cultiver un autre profil", "game", "Buddies différents Qualité concours ou mieux"),
  mission("legendary-flower", "quality", 5, "legendary_flowers", 1, pack(3), "La première légendaire",
    "Atteins le niveau Fleur légendaire : au moins 26 points de Qualité et 4 étapes réussies, dont 2 critiques.", "Viser une fleur légendaire", "game", "Fleurs légendaires"),
  mission("three-legendary-varieties", "quality", 6, "legendary_varieties", 3, pack(10), "Une signature légendaire",
    "Récolte 3 Buddies différents au niveau Fleur légendaire : au moins 26 points de Qualité et 4 étapes réussies, dont 2 critiques, pour chaque culture.", "Perfectionner mes cultures", "game", "Buddies différents légendaires"),
  mission("first-prepared", "preparation", 1, "prepared_batches", 1, cash(5000), "De la récolte au lot",
    "Prépare une première récolte pour le commerce, en fleur ou en produit transformé.", "Préparer mes récoltes", "market", "Récoltes préparées"),
  mission("first-curing", "preparation", 2, "cured_lots", 1, cash(15000), "La patience du chanvrier",
    "Laisse un premier lot terminer son affinage dans le stockage.", "Suivre mon stockage", "workshop", "Lots ayant terminé leur affinage"),
  mission("first-transformation", "preparation", 3, "transformed_batches", 1, cash(25000), "Le premier atelier",
    "Transforme une récolte dans un atelier. L’opération doit être terminée pour compter.", "Ouvrir mes ateliers", "workshop", "Récoltes transformées"),
  mission("five-curings", "preparation", 4, "cured_lots", 5, card("BOTTE-016", "Séchage patient"), "Le temps fait son œuvre",
    "Accompagne 5 lots différents jusqu’à la fin de leur affinage.", "Gérer mon stockage", "workshop", "Lots ayant terminé leur affinage"),
  mission("three-transformations", "preparation", 5, "transformed_routes", 3, card("BOTTE-027", "Papiers en règle"), "Les trois savoir-faire",
    "Termine au moins une transformation dans chacune des 3 familles : tamisage, lavage et pressage.", "Explorer mes ateliers", "workshop", "Familles de transformation pratiquées"),
  mission("ten-quality-curings", "preparation", 6, "quality_cured_lots", 10, pack(10), "La réserve d’exception",
    "Termine l’affinage de 10 lots avec une note de référence d’au moins 8/10. La mission retient la note du lot commercial, sinon celle du jury, sinon l’estimation à la récolte.", "Prendre soin de mes lots", "workshop", "Lots affinés avec une note de référence d’au moins 8/10"),
  mission("first-online-sale", "online", 1, "online_sales", 1, cash(5000), "Ta première commande",
    "Réalise une première vente depuis ta boutique en ligne. Une annonce seule ne suffit pas : un sachet doit être vendu.", "Ouvrir mon commerce", "market", "Sachets vendus en ligne"),
  mission("online-two", "online", 2, "clients", 2, cash(10000), "Tes premiers fidèles",
    "Atteins 2 clients fidèles en ligne et conserve-les jusqu’à la récupération de ta récompense.", "Vendre en ligne", "market", "Clients fidèles actuels"),
  mission("online-aroma-duo", "online", 3, "online_dual_aroma_sales", 1, card("BOTTE-006", "Deuxième chance"), "Le duo aromatique du moment",
    "Vends en ligne un sachet de fleurs réunissant les 2 arômes demandés au moment de la vente, avec la qualité et le quota requis pour la demande.", "Consulter les arômes du moment", "market", "Ventes de fleurs avec les 2 arômes demandés"),
  mission("online-five", "online", 4, "clients", 5, cash(30000), "Le bouche-à-oreille",
    "Fidélise 5 clients en ligne. Garde cette clientèle jusqu’à la récupération de la récompense.", "Développer ma clientèle", "market", "Clients fidèles actuels"),
  mission("online-ten", "online", 5, "clients", 10, pack(3), "Une adresse reconnue",
    "Fais grandir ta clientèle jusqu’à 10 fidèles en ligne et conserve leur confiance.", "Retrouver mes clients", "market", "Clients fidèles actuels"),
  mission("online-aroma-seasons", "online", 6, "online_satisfied_dual_aroma_periods", 3, pack(10), "Toujours dans l’air du temps",
    "Sur 3 périodes de demande différentes, réalise au moins une vente en ligne de fleurs avec les 2 arômes demandés et un client satisfait. Plusieurs ventes sur une même période ne comptent qu’une fois.", "Préparer la prochaine demande", "market", "Périodes avec un duo aromatique et un client satisfait"),
  mission("shop-one", "shops", 1, "partners", 1, cash(10000), "Ta première boutique",
    "Convaincs un CBD shop de devenir partenaire et conserve ce partenariat jusqu’à la récompense.", "Livrer une boutique", "market", "Boutiques partenaires actuelles"),
  mission("shop-three-varieties", "shops", 2, "shop_varieties", 3, cash(20000), "Une carte qui donne envie",
    "Vends aux CBD shops des fleurs de 3 Buddies différents. Fractionner un lot ne crée pas de nouvelle variété.", "Diversifier mes livraisons", "market", "Buddies différents vendus en fleur aux boutiques"),
  mission("shop-three", "shops", 3, "partners", 3, cash(35000), "Un réseau local",
    "Développe ton réseau jusqu’à 3 boutiques partenaires et maintiens ces relations.", "Développer mon réseau", "market", "Boutiques partenaires actuelles"),
  mission("shop-quality-100", "shops", 4, "shop_quality_grams", 100, card("BOTTE-034", "Gros molosse"), "Le fournisseur de confiance",
    "Livre au total 100 g de fleurs aux CBD shops, avec une qualité d’au moins 8/10 au moment de chaque vente.", "Livrer mes meilleurs lots", "market", "Grammes de fleurs de qualité livrés"),
  mission("shop-six", "shops", 5, "partners", 6, pack(3), "La tournée du chanvrier",
    "Fournis régulièrement les boutiques pour atteindre 6 partenaires actifs.", "Retrouver mes boutiques", "market", "Boutiques partenaires actuelles"),
  mission("shop-quality-500", "shops", 6, "shop_quality_grams", 500, pack(10), "La référence des boutiques",
    "Livre au total 500 g de fleurs aux CBD shops, avec une qualité d’au moins 8/10 au moment de chaque vente.", "Poursuivre mes livraisons", "market", "Grammes de fleurs de qualité livrés"),
] as const;
export type KqMissionDefinition = (typeof KQ_MISSION_DEFINITIONS)[number];
export type KqMissionCode = KqMissionDefinition["code"];
export const KQ_MISSION_COPY = Object.fromEntries<MissionCopy>(KQ_MISSION_DEFINITIONS.map(definition => [definition.code, definition])) as Record<KqMissionCode, MissionCopy>;

export type KqMission = {
  code: KqMissionCode; track: KqMissionTrack; step: number; target: number; progress: number;
  reward: KqMissionReward; rewardAvailable: boolean;
  cardCount: number; claimed: boolean; unlocked: boolean; claimable: boolean;
  entitlementId: string | null; packAvailable: boolean | null;
};
export type KqMissionSnapshot = { collectionActive: boolean; missions: KqMission[] };
export type KqMissionContinuation =
  | { status: "pending" }
  | { status: "next"; mission: KqMission }
  | { status: "complete"; track: KqMissionTrack };

/** A receipt is not a refreshed mission snapshot. Never infer an unlock or a
 * completed journey from an earlier or incomplete server response. */
export function getKqMissionContinuation(snapshot: KqMissionSnapshot | null, receivedCode: KqMissionCode): KqMissionContinuation {
  const definition = KQ_MISSION_DEFINITIONS.find(mission => mission.code === receivedCode);
  const received = snapshot?.missions.find(mission => mission.code === receivedCode);
  if (!definition || received?.claimed !== true) return { status: "pending" };
  const journey = KQ_MISSION_DEFINITIONS.filter(mission => mission.track === definition.track)
    .map(mission => snapshot!.missions.find(current => current.code === mission.code));
  if (journey.some(mission => !mission)) return { status: "pending" };
  const next = journey.find(mission => mission!.claimed !== true);
  if (!next) return { status: "complete", track: definition.track };
  if (next.unlocked !== true || !Number.isFinite(next.progress) || next.progress < 0
    || !Number.isFinite(next.target) || next.target <= 0) return { status: "pending" };
  return { status: "next", mission: next };
}

export type KqMissionClaim = {
  entitlementId: string | null; cardCount: number; replayed: boolean; reward: KqMissionReward;
  cardInstanceId?: string | null; cashAfterCents?: number | null;
};
export function isKqMissionCode(value: unknown): value is KqMissionCode {
  return typeof value === "string" && Object.hasOwn(KQ_MISSION_COPY, value);
}
export function getKqMissionRewardLabel(reward: KqMissionReward): string {
  if (reward.kind === "cash") return `${(reward.amountCents / 100).toLocaleString("fr-FR")} € de jeu`;
  if (reward.kind === "card") return `${reward.name} · carte rare`;
  return `Pack de ${reward.cardCount} cartes`;
}
