import {
  Banknote, BookOpenCheck, Boxes, Dice5, FlaskConical, Gift, Layers3,
  PackageCheck, ShoppingBag, SlidersHorizontal, Sparkles, Sprout, Swords,
  Trophy, UserRound, type LucideIcon,
} from "lucide-react";
import { calculateKqMarketReputation, getKqMarketReputationRule } from "@/lib/kanab-quest-market";
import { KQ_PLACARD_REPUTATION_BONUS_CAP, KQ_PLACARD_SEASON_BONUS_CAP } from "@/lib/kanab-quest-reputation";

type TutorialFeature = { title: string; description: string; Icon: LucideIcon };
export type ArenaTutorialStep = {
  id: string; number: string; label: string; eyebrow: string; title: string;
  lead: string; href: string; action: string; Icon: LucideIcon;
  features: TutorialFeature[];
  tip: string;
  details?: { title: string; paragraphs: string[] };
};

const formatScore = (value: number) => value.toLocaleString("fr-FR");
export const ARENA_TUTORIAL_REPUTATION_ROWS = [
  { label: "Fleur brute · hash tamisé · eau-glace", route: "dry-sift" },
  { label: "Rosin · Static Sift · Hash Signature", route: "rosin-selection" },
].map(({ label, route }) => {
  const rule = getKqMarketReputationRule(route as "dry-sift" | "rosin-selection");
  return {
    label,
    loss: `< ${formatScore(rule.neutralFrom)}`,
    neutral: `${formatScore(rule.neutralFrom)} à ${formatScore(rule.gainFrom - 0.1)}`,
    gain: `≥ ${formatScore(rule.gainFrom)}`,
  };
});

export const ARENA_TUTORIAL_STEPS: readonly ArenaTutorialStep[] = [
  {
    id: "carnet", number: "01", label: "Carnet", eyebrow: "Tes dégustations",
    title: "Tout commence avec ta collection.",
    lead: "Le Carnet relie les fleurs achetées sur la plateforme à ta progression dans l’Arène.",
    href: "/arene/carnet/regular", action: "Ouvrir mon Carnet", Icon: BookOpenCheck,
    features: [
      { title: "Note tes fleurs", description: "Retrouve les fleurs éligibles dans ton Carnet et complète leur dégustation.", Icon: Sparkles },
      { title: "Récupère tes récompenses", description: "Un avis validé ou un objectif rempli peut débloquer des packs : consulte tes récompenses disponibles.", Icon: Gift },
      { title: "Découvre les Héritages", description: "Remplis les objectifs des producteurs présents sur la plateforme pour débloquer leurs cartes Héritage.", Icon: Layers3 },
    ],
    tip: "Tu peux commencer par le Carnet ou rejoindre directement le Placard si tu as déjà les cartes nécessaires.",
  },
  {
    id: "placard", number: "02", label: "Cartes", eyebrow: "Ton équipe de départ",
    title: "Prépare ta culture.",
    lead: "Dans le Placard, tes cartes composent ta stratégie. Le matériel complète ton atelier.",
    href: "/arene/placard?view=game", action: "Préparer une partie", Icon: Layers3,
    features: [
      { title: "Choisis ton Buddie", description: "Sélectionne une carte Buddie parmi celles que tu possèdes.", Icon: UserRound },
      { title: "Compose ton deck", description: "Choisis tes cartes de soutien et ton Héritage parmi ceux débloqués. Lis leurs effets avant de partir.", Icon: Layers3 },
      { title: "Choisis ta voie de culture", description: "Terreau, hydroponie, aéroponie ou sol vivant : les cartes correspondantes offrent des effets différents dans le jeu.", Icon: Sprout },
    ],
    tip: "Cartes et équipements sont deux choses différentes : les cartes servent en partie, le matériel reste dans ton inventaire.",
  },
  {
    id: "boutique", number: "03", label: "Boutique", eyebrow: "Investir dans l’atelier",
    title: "Achète le bon matériel.",
    lead: "Dans la Boutique du Placard, ouvre le catalogue de matériel. Pas besoin de tout acheter pour commencer.",
    href: "/arene/placard?view=shop&catalog=equipment", action: "Ouvrir le catalogue", Icon: ShoppingBag,
    features: [
      { title: "Deux budgets distincts", description: "Les points servent aux packs de cartes. La trésorerie du Placard, affichée en $US, sert aux équipements : c’est de la monnaie de jeu.", Icon: Banknote },
      { title: "Compare les machines", description: "Tentes, LED et matériel de transformation : regarde les effets, les prérequis, la capacité et les filières débloquées.", Icon: SlidersHorizontal },
      { title: "Panier, puis validation", description: "Ajoute le matériel au panier, vérifie le total et valide l’achat si ton solde le permet.", Icon: ShoppingBag },
    ],
    tip: "Les ventes de lots financent tes prochains achats. Une machine chère ne garantit pas une bonne réputation.",
  },
  {
    id: "inventaire", number: "04", label: "Matériel", eyebrow: "Possédé ≠ installé",
    title: "Installe ce que tu possèdes.",
    lead: "Depuis le hub du Placard, ouvre Inventaire pour choisir les équipements actifs.",
    href: "/arene/placard", action: "Revenir à mon atelier", Icon: Boxes,
    features: [
      { title: "Choisis tes équipements actifs", description: "Seul le matériel possédé et compatible peut être installé. Un seul équipement est actif par emplacement.", Icon: PackageCheck },
      { title: "Garde tes anciens modèles", description: "Remplacer un équipement ne le détruit pas : il reste dans ton inventaire pour plus tard.", Icon: Boxes },
      { title: "Vérifie ton HUD", description: "Déplie le résumé du hub pour retrouver ta trésorerie, ta réputation et ton atelier.", Icon: SlidersHorizontal },
    ],
    tip: "Prépare ton atelier avant de lancer une culture. Pour une transformation, le marché vérifie aussi les machines installées au moment de vendre.",
  },
  {
    id: "culture", number: "05", label: "Culture", eyebrow: "À toi de jouer",
    title: "Lance les dés. Gère les imprévus.",
    lead: "Traverse les étapes de culture pour produire une Fleur à présenter au jury.",
    href: "/arene/placard?view=game", action: "Lancer ma culture", Icon: Dice5,
    features: [
      { title: "Résous les situations", description: "Lis la situation, lance les dés et observe les réussites demandées. Tout ne se passe pas toujours comme prévu.", Icon: Dice5 },
      { title: "Joue tes soutiens", description: "Utilise une carte compatible quand elle peut aider. Son effet et son moment d’utilisation comptent.", Icon: Layers3 },
      { title: "Vise qualité et quantité", description: "Tes résultats de culture et ton équipement influencent la récolte. Une grosse quantité ne remplace pas une bonne note.", Icon: Sprout },
    ],
    tip: "La Fleur obtenue n’est pas encore un lot vendable : elle doit d’abord passer par un duel et le verdict du jury.",
  },
  {
    id: "duel", number: "06", label: "Duel", eyebrow: "Fleur vs Fleur",
    title: "Engage ta Fleur. Le hasard choisit.",
    lead: "Tu choisis ta Fleur, pas celle de ton adversaire.",
    href: "/arene/placard?view=arena", action: "Ouvrir Fleur vs Fleur", Icon: Swords,
    features: [
      { title: "Rejoins la file aléatoire", description: "Mets une Fleur disponible en jeu. Elle attend une Fleur d’un autre joueur pour déclencher le match.", Icon: Swords },
      { title: "Laisse le jury trancher", description: "Le duel attribue un verdict et une note au lot. Pas d’adversaire disponible ? Ta Fleur reste en attente.", Icon: Trophy },
      { title: "Une Fleur, un duel", description: "Après le duel, la Fleur est brûlée et ne peut plus être engagée. Son lot devient disponible au Marché.", Icon: FlaskConical },
    ],
    tip: "Les défis contre les bots sont une option séparée : ils ne remplacent pas l’adversaire attendu dans la file des joueurs.",
  },
  {
    id: "marche", number: "07", label: "Vente", eyebrow: "Après le verdict",
    title: "Que vaut ton lot ?", lead: "Ouvre le Marché, sélectionne un lot et compare revenu et réputation avant de décider.",
    href: "/arene/placard?view=market", action: "Ouvrir le Marché", Icon: Banknote,
    features: [
      { title: "Brut ou biomasse", description: "Vends la fleur brute si sa note le permet. La biomasse rapporte peu, mais ne fait jamais perdre de réputation.", Icon: Sprout },
      { title: "Hash ou rosin", description: "Tamisage, eau-glace, Static Sift, presses à rosin : les choix disponibles dépendent de la note du jury et des machines installées.", Icon: FlaskConical },
      { title: "Confirme une seule fois", description: "Le devis annonce le prix et la variation de réputation. La vente est définitive ; l’argent rejoint ta trésorerie pour réinvestir.", Icon: PackageCheck },
    ],
    tip: "Transformer peut mieux payer sans améliorer ta réputation. Compare les deux avant de valider.",
    details: { title: "Capacité, rendement et prix", paragraphs: [
      "Une machine ne traite pas forcément tout le lot. Le devis indique le produit fini et la destination du reste : vente brute ou biomasse.",
      "Le prix dépend de la note, de la filière et du matériel. Les seuils de note et les prérequis restent obligatoires : acheter une presse ne débloque pas toutes les qualités de rosin.",
    ] },
  },
  {
    id: "reputation", number: "08", label: "Réputation", eyebrow: "Ton nom se construit sur la qualité",
    title: "La qualité fait ta réputation.", lead: "Un excellent lot te fait progresser. Un lot moyen peut stagner ; un lot trop faible pour sa filière te fait reculer.",
    href: "/arene?vue=classement", action: "Voir les classements", Icon: Trophy,
    features: [
      { title: "Le rosin est plus exigeant", description: `À 7,5/10 : ${calculateKqMarketReputation("dry-sift", 7.5)} point en hash tamisé, mais ${calculateKqMarketReputation("rosin-selection", 7.5)} points en Rosin Sélection.`, Icon: FlaskConical },
      { title: "Pas de prime pour un mauvais lot", description: "Les primes d’expertise aux ventes 3, 6 et 10 exigent un gain de réputation positif sur la vente concernée.", Icon: Sparkles },
      { title: "Une place à défendre", description: "La réputation participe au score Placard avec ta cote de duel et tes points de saison. Une baisse peut donc peser sur ton classement.", Icon: Trophy },
    ],
    tip: "Les pertes sont annoncées avant vente et s’arrêtent à zéro. La biomasse reste neutre, quelle que soit la note.",
    details: { title: "Expertise et calcul du score", paragraphs: [
      "Les ventes comptent pour l’expérience de la filière. Une prime manquée à cause de la qualité n’est pas reportée. Les anciennes ventes ne sont pas recalculées.",
      `Score Placard = cote de duel + bonus saison (25 % des points, arrondi, maximum ${KQ_PLACARD_SEASON_BONUS_CAP}) + bonus réputation (4 × racine carrée de la réputation, arrondi, maximum ${KQ_PLACARD_REPUTATION_BONUS_CAP}).`,
      "Le classement général de l’Arène combine les scores Carnet et Placard avec son propre barème. Il ne faut pas confondre ce classement, la réputation et ton argent disponible.",
    ] },
  },
];
