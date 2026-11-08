import { getFarmGuideAdvice, type FarmGuideChapter, type FarmGuideChapterId, type FarmGuideFacts } from "./kanab-quest-farm-guide";

export type FarmStoryScene = { image: string; alt: string; speaker: string; line: string };
/** Existing story artwork; dialogue remains HTML and never represents the player's actual stock. */
export const FARM_STORY_SCENES: Record<FarmGuideChapterId, FarmStoryScene> = {
  staff: { image: "/placard/bureau-management-v1.webp", alt: "Sylvain organise le travail de l’équipe devant le tableau de la ferme de chanvre.", speaker: "Sylvain", line: "Une seule réserve d’heures pour tous les métiers. Préparons les récoltes et le planning avant de signer un nouveau contrat." },
  arrival: { image: "/contest/releve/arrival-sylvain-v1.webp", alt: "Sylvain t’attend devant la ferme, les clés à la main. Le registre et la lettre de grand-père sont posés près de lui.", speaker: "Sylvain", line: "Ton grand-père t’a laissé les clés. Viens, donnons une nouvelle vie à sa ferme !" },
  warehouse: { image: "/contest/releve/renovation-sylvain-v1.webp", alt: "Dans la grange rénovée, Sylvain déplie le plan et son mètre.", speaker: "Sylvain", line: "Ici les cultures, là le séchage… Touche une zone : on regarde son matériel et son devis ensemble." },
  collection: { image: "/app/lottery/sylvain-booster-presentation-v3.webp", alt: "Sylvain présente le pack Buddies illustré d’un champ au coucher du soleil.", speaker: "Sylvain", line: "Quelles variétés feras-tu pousser ? Ouvre tes albums : les Buddies et les cartes ont chacun leur rôle." },
  packs: { image: "/placard/card-shop-sylvain-v1.webp", alt: "Sylvain accueille le joueur au comptoir des packs de cartes.", speaker: "Sylvain", line: "Regardons tes packs disponibles avant d’en acheter. La ferme peut grandir à ton rythme." },
  culture: { image: "/contest/releve/culture-sylvain-v1.webp", alt: "Sylvain observe des plantes sous les lampes de la ferme.", speaker: "Sylvain", line: "À toi de faire vivre la ferme. Choisis la culture à reprendre, ou prépare tes Buddies dans une zone." },
  storage: { image: "/contest/releve/packing-sylvain-v1.webp", alt: "Sylvain prépare des bocaux et des sachets sur la table de conditionnement.", speaker: "Sylvain", line: "Un contenant pour chaque lot, puis du temps pour l’affinage. Le jury attendra que les fleurs soient prêtes." },
  jury: { image: "/contest/map/arena-desk-sylvain-v6.webp", alt: "Sylvain ouvre le carnet des fleurs près du tableau des duels.", speaker: "Sylvain", line: "Prêt pour le jury ? Le duel consomme ta Fleur d’Arène, pas ton stock. Lis bien la confirmation." },
  sale: { image: "/placard/market-workshop-sylvain-v2.webp", alt: "Sylvain présente les produits à préparer dans l’atelier du marché.", speaker: "Sylvain", line: "Trouvons un acheteur pour ta récolte. Choisis un lot ; on comparera ce qui te reste après les frais." },
  listings: { image: "/placard/commerce-office-sylvain-v3.webp", alt: "Sylvain suit la boutique et ses commandes devant son ordinateur.", speaker: "Sylvain", line: "Une annonce n’est pas encore une vente. Ici, on suit les produits proposés et les commandes." },
  accounts: { image: "/placard/bureau-accounting-sylvain-v2.webp", alt: "Sylvain vérifie le registre, les pièces et les factures de la ferme.", speaker: "Sylvain", line: "Ouvrons le registre de grand-père : ce qui entre, ce qui sort… et les factures à régler." },
  bank: { image: "/placard/bureau-bank-sylvain-v2.webp", alt: "Le banquier reçoit le joueur devant son coffre et lui présente un contrat.", speaker: "Le banquier", line: "Pour agrandir la ferme, comparons le coût et les échéances. Rien ne t’oblige à emprunter." },
  business: { image: "/placard/market-brand-studio-sylvain-v3.webp", alt: "Sylvain prépare des emballages et des photos au Studio.", speaker: "Sylvain", line: "Cette ferme devient la tienne. Un site, des photos, des produits : construisons son identité, à ton rythme." },
  networks: { image: "/app/kanab-quest/social/scenes/producer-journal-v3.webp", alt: "Sylvain tient le journal de la ferme et prépare ses nouvelles pour le Quartier.", speaker: "Sylvain", line: "Les voisins ont des histoires à partager. Découvre l’aventure, puis les engagements proposés par les marques." },
  missions: { image: "/placard/market-social-missions-sylvain-v3.webp", alt: "Sylvain présente les missions et les occasions du Quartier.", speaker: "Sylvain", line: "Le registre a encore des pages blanches. Choisis ta prochaine mission : à toi d’écrire la suite." },
};

// Short spoken lines follow the existing advice resolver, including its error and failure priority.
const CONTEXT_LINES: Record<string, string> = {
  "Vérifier avant de continuer": "Attends, le jeu a un message pour toi. Lis-le avant de continuer ; on reprendra ensemble.",
  "Comprendre ce qui s’est passé": "Cette culture n’a pas donné de récolte. Regardons le bilan et les possibilités de reprise avant de dépenser.",
  "Retrouver ta récolte": "Voilà ta récolte ! Retrouvons-la au stockage pour la ranger et laisser ses arômes s’affiner.",
  "Préparer avant de lancer": "Choisis tes Buddies et tes cartes. On vérifie les coûts avant de lancer.",
  "Lire la situation": "Que se passe-t-il dans la culture ? Regarde avant de lancer les dés. Une carte jouée sera consommée.",
  "Décider après le lancer": "Les dés ont parlé. Regarde le résultat prévu et tes possibilités avant de valider.",
  "Comprendre le résultat": "Regardons ce que ce choix a changé pour tes plantes. Puis on passera à la suite.",
  "Relire le devis du plan": "Ton plan est encore un brouillon. Vérifions le devis avant d’enregistrer cet aménagement.",
  "Dessiner ta première zone": "Tout commence ici. Dessine une zone de culture ; gardons aussi de la place pour sécher et ranger.",
  "Préparer le séchage": "Après la culture, il faudra sécher. Comparons la capacité et le prix du matériel.",
  "Faire de la place aux récoltes": "Voyons tes stocks et tes contenants libres. Chaque lot doit trouver sa place.",
  "Transformer quand c’est utile": "Voici l’atelier. Vérifie la machine, son état et son rendement avant de transformer une récolte.",
  "Tes variétés disponibles": "Voilà tes Buddies. Consulte leurs profils, puis choisis ta variété depuis une zone de culture.",
  "Le rangement viendra après la récolte": "Pas encore de lot à ranger. Reprenons ta culture ; les contenants serviront après la récolte.",
  "Laisser l’affinage se terminer": "Cette Fleur s’affine encore. La date du lot te dira quand retrouver le jury.",
  "Choisir le produit": "Fleur ou transformation ? Regardons la quantité obtenue, le matériel et les frais avant de choisir.",
  "Comparer les débouchés": "Chaque débouché a ses conditions. Comparons les offres avant de choisir notre acheteur.",
  "Lire le montant net": "C’est ce montant qui compte. Lis les frais et la confirmation ; rien n’est encore vendu.",
  "Vérifier le reçu": "La vente a son reçu. Vérifions le montant versé avant de prévoir la prochaine dépense.",
  "Tenir tes engagements": "Une marque te propose de travailler ensemble. Lis les honoraires et ce qu’elle attend avant de signer.",
  "Les histoires du Quartier": "Approche, les voisins ont quelque chose à raconter. Chaque choix a ses conséquences.",
  "Créer des produits dérivés": "Imaginons les produits de ta ferme. Regardons le coût et le stock à engager avant de produire.",
  "Entrer au Studio": "Bienvenue au Studio ! Donnons un visage à ta ferme avec ses photos et son identité.",
  "Ouvrir et entretenir ton site": "Voici la vitrine de ta ferme. Regardons le niveau du site, son abonnement et sa prochaine échéance.",
  "Faire venir des clients": "Faisons connaître la ferme. Vérifie ton stock et le budget : des visiteurs ne garantissent pas des commandes.",
  "Le livret du Trésorier": "Ce livret dépend de ta spécialité. Vérifions ses conditions avant d’y déplacer la monnaie du jeu.",
  "Le guichet Crypto": "Ici, les cours peuvent monter ou baisser. Regarde les frais et garde de quoi faire vivre ta ferme.",
  "Le guichet Bourse": "Un placement peut aussi perdre de sa valeur. Comparons les titres sans toucher à ton budget de fonctionnement.",
};

export function getFarmStoryScene(chapter: FarmGuideChapter, facts: FarmGuideFacts): FarmStoryScene {
  const advice = getFarmGuideAdvice(chapter, facts);
  const base = FARM_STORY_SCENES[chapter.id];
  const line = CONTEXT_LINES[advice.title] ?? base.line;
  // A failed culture must not be illustrated by the celebratory harvest scene.
  if (chapter.id === "culture" && facts.cultureDead) return { ...FARM_STORY_SCENES.warehouse, line };
  if (chapter.id === "culture" && facts.harvested && !facts.error) return { ...FARM_STORY_SCENES.storage, line };
  if (chapter.id === "warehouse" && facts.room === "storage") return { ...FARM_STORY_SCENES.storage, line };
  if (chapter.id === "warehouse" && facts.room === "processing") return { ...FARM_STORY_SCENES.sale, line };
  if (chapter.id === "jury" && facts.curing && !facts.error) return { ...FARM_STORY_SCENES.storage, line };
  return { ...base, line };
}
