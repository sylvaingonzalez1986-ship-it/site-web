import type { ArenaPlayableLessonId } from "./arena-playable-learning";

export type ArenaReleveStage = "arrival" | "plan" | "buddies" | "launch" | "culture" | "jury" | "delivery" | "shop" | "ledger";
export type ArenaReleveChapterId = ArenaReleveStage;
export type ArenaReleveScene = "arrival" | "renovation" | "culture" | "packing";
export type ArenaReleveMeetingId = "expansion" | "workshop" | "business" | "social" | "merch" | "bank" | "community" | "notebook";

export const ARENA_RELEVE_SCENES: Record<ArenaReleveScene, string> = {
  arrival: "/contest/releve/arrival-sylvain-v1.webp",
  renovation: "/contest/releve/renovation-sylvain-v1.webp",
  culture: "/contest/releve/culture-sylvain-v1.webp",
  packing: "/contest/releve/packing-sylvain-v1.webp",
};

export type ArenaReleveChapter = {
  id: ArenaReleveStage;
  stage: ArenaReleveStage;
  act: 1 | 2 | 3;
  title: string;
  description: string;
  coach: string;
  rationale: string;
  hint: string;
  action: string;
  milestone: string;
  scene: ArenaReleveScene;
};

export type ArenaReleveMeeting = {
  id: ArenaReleveMeetingId;
  title: string;
  description: string;
  coach: string;
  rationale: string;
  hint: string;
  action: string;
  milestone: string;
  scene: ArenaReleveScene;
  /** Only current, isolated lessons; the old tent and commerce lessons are retired. */
  lessons: readonly ArenaPlayableLessonId[];
};

export const ARENA_RELEVE_LETTER = [
  "Je te lègue la maison et sa grange. Les bêtes l’ont quittée depuis un moment, mais elle peut encore servir. Tu trouveras mon vieux registre sur place. Il reste beaucoup de pages blanches.",
  "Tout l’intérieur de la grange est à refaire. Transforme-la en ferme indoor : une chambre de culture, de la place pour sécher et de quoi ranger tes récoltes. Si tu as besoin d’un coup de main, Sylvain connaît le chemin.",
  "Prends soin de ce lieu. À toi d’écrire la suite. — Grand-père",
] as const;

export const ARENA_RELEVE_ACTS = [
  { id: 1, title: "Donner une nouvelle vie à la grange" },
  { id: 2, title: "Accompagner la première campagne" },
  { id: 3, title: "Faire vivre la ferme" },
] as const;

export const ARENA_RELEVE_CHAPTERS: readonly ArenaReleveChapter[] = [
  {
    id: "arrival", stage: "arrival", act: 1, title: "Les portes turquoise", scene: "arrival",
    description: "Reçois les clés de la maison léguée par ton grand-père et transforme sa grange en ferme indoor.",
    coach: "Ton grand-père t’a légué sa maison et cette grange. On la vide, puis on refait tout l’intérieur pour ta ferme indoor. Les premières plantes viendront quand la chambre de culture sera prête.",
    rationale: "La rénovation transforme les 100 m² avant toute plante : sol propre, parois et plafond techniques blancs. Elle est prise en charge dans cet essai. Ton budget servira aux équipements et au fonctionnement, sans facture de chantier réelle.",
    hint: "Ouvre la porte, choisis Vider la grange, puis Rénover tout l’intérieur. La lettre peut se lire plus tard dans le registre.",
    action: "Ouvrir la grange", milestone: "Chambre de culture rénovée",
  },
  {
    id: "plan", stage: "plan", act: 1, title: "Le mètre et le registre", scene: "renovation",
    description: "Choisis les surfaces actives et équipe ta première installation.",
    coach: "Le bâtiment est prêt. Choisissons où cultiver, sécher et stocker. Compare le devis et les charges avant de confirmer : toute la pièce est rénovée, mais tu peux l’équiper progressivement.",
    rationale: "Culture, séchage et stockage ont des usages et des capacités différents. Un devis n’est pas un achat ; le matériel est payé à confirmation. Les appareils se comptent entiers et les charges dépendent des surfaces actives.",
    hint: "Commence par une petite zone de culture, puis ajoute séchage et stockage. Compare les éclairages et consulte le solde restant avant de confirmer.",
    action: "Préparer mon installation", milestone: "Première installation enregistrée",
  },
  {
    id: "buddies", stage: "buddies", act: 1, title: "Les premiers Buddies", scene: "renovation",
    description: "Découvre les cartes de variétés et affecte un Buddie à ta zone.",
    coach: "Chaque Buddie représente une variété avec son profil. Découvre tes cartes d’essai, puis choisis lequel cultiver. Si tu prépares deux zones, chacune aura un Buddie différent.",
    rationale: "La collection de démonstration est préparée pour apprendre. Elle ne prédit pas les tirages des vrais packs. Posséder un Buddie ne suffit pas : il doit être disponible et affecté à une zone active.",
    hint: "Ouvre ton album d’essai, lis un profil, puis affecte un Buddie disponible. Une carte en rotation indique pourquoi elle doit attendre.",
    action: "Choisir mon Buddie", milestone: "Buddie affecté",
  },
  {
    id: "launch", stage: "launch", act: 2, title: "Tout le monde démarre ensemble", scene: "renovation",
    description: "Vérifie les participants, les cartes et les charges de ta campagne.",
    coach: "Les zones prêtes partent ensemble. Vérifie les Buddies, les capacités et les charges. Tu peux préparer des soutiens et un Héritage : lire une carte ne la consomme pas.",
    rationale: "Une campagne reprend les zones actives du plan enregistré. Les soutiens sont consommés seulement quand tu les joues ; un Héritage reste permanent. La ferme transmise par ton grand-père ne donne aucune carte Héritage réelle.",
    hint: "Vérifie le récapitulatif des participants et enregistre les changements du plan avant de lancer la campagne fictive.",
    action: "Lancer ma campagne d’essai", milestone: "Première campagne lancée",
  },
  {
    id: "culture", stage: "culture", act: 2, title: "Sylvain laisse la main", scene: "culture",
    description: "Observe les situations, joue tes cartes et accompagne les six étapes.",
    coach: "Regarde ce qui se passe avant d’agir. Consulter le suivi est gratuit. Choisis une réponse si elle t’aide, lance les dés, puis lis le résultat. Je reste là si tu bloques.",
    rationale: "Les effets, coûts et moments d’intervention sont ceux du jeu. Certains soins agissent au bilan suivant. Une aide d’essai ou une reprise est annoncée ; elle ne change jamais discrètement le résultat de tes dés.",
    hint: "Observe la situation, prépare éventuellement une carte, lance les dés, puis valide le résultat. En cas de difficulté, consulte le bilan avant de reprendre.",
    action: "Accompagner ma culture", milestone: "Première récolte obtenue",
  },
  {
    id: "jury", stage: "jury", act: 2, title: "La récolte rencontre le quartier", scene: "packing",
    description: "Range tes fleurs, termine l’affinage, puis découvre le verdict du jury.",
    coach: "Voilà ta récolte. Choisissons ses contenants et laissons ses arômes s’affiner avant de la présenter. Ensuite, le jury donnera son avis : gagner le duel et obtenir une bonne note sont deux choses différentes.",
    rationale: "Les six heures d’affinage commencent à la récolte. Les gains acquis comptent au jury, puis le lot reste disponible pour la vente. L’horloge de cet essai avance explicitement, sans raccourcir les délais du jeu réel.",
    hint: "Ouvre Stockage, vérifie chaque variété et son contenant, puis termine les six heures fictives. Retourne au jury et découvre le verdict.",
    action: "Affiner puis présenter ma Fleur", milestone: "Affinage et jury découverts",
  },
  {
    id: "delivery", stage: "delivery", act: 3, title: "La première livraison", scene: "packing",
    description: "Compare les débouchés, confirme une vente et ouvre son reçu.",
    coach: "Regarde ce que chaque acheteur accepte, son prix et ce qu’il te restera. Préparons une première livraison. Le reçu nous dira ce qui a été vendu et réellement ajouté à ta trésorerie.",
    rationale: "Qualité, maturité et quotas limitent les débouchés. Les demandes aromatiques sont une occasion, pas une vente garantie. La préparation porte sur le lot ; la quantité ensuite vendue dépend du circuit et du stock disponible.",
    hint: "Dans Commerce, compare deux circuits, lis les conditions, puis confirme une offre disponible. Ouvre le reçu avant de dépenser la recette.",
    action: "Préparer ma livraison", milestone: "Première livraison réalisée",
  },
  {
    id: "shop", stage: "shop", act: 3, title: "Une enseigne pour la ferme", scene: "packing",
    description: "Ouvre ta boutique fictive, prépare une annonce et suis ses commandes.",
    coach: "Je te prête un ordinateur. Donne un nom à ta boutique, prépare ton offre et compare les prix. Après une période simulée, on regardera ensemble ce qui s’est passé.",
    rationale: "La boutique de base est gratuite. Les emballages et dépenses de communication utilisent le budget d’essai. Une estimation n’est pas une commande promise : le prix, le stock, la qualité et la demande comptent.",
    hint: "Ouvre la boutique, choisis un emballage et un format compatibles, puis publie ton annonce. Avance l’horloge de l’essai pour consulter le rapport.",
    action: "Ouvrir ma boutique d’essai", milestone: "Première offre en ligne",
  },
  {
    id: "ledger", stage: "ledger", act: 3, title: "Le registre se remplit", scene: "packing",
    description: "Lis tes comptes, découvre tes récompenses et choisis la suite.",
    coach: "La grange est devenue une chambre de culture. Tu as préparé ta première livraison. Regardons ce qu’il reste, les charges et les récompenses avant de choisir ton prochain projet.",
    rationale: "Le chiffre d’affaires, les sommes réservées et la trésorerie disponible ne sont pas un même montant. La première récolte rapporte actuellement 50 € de jeu dans les Missions ; une récompense se récupère une seule fois.",
    hint: "Consulte une recette et une facture. Vérifie la récompense de première récolte, puis compare le devis de ton prochain projet sans achat obligatoire.",
    action: "Ouvrir mon registre", milestone: "Première aventure accomplie",
  },
];

export const ARENA_RELEVE_MEETINGS: readonly ArenaReleveMeeting[] = [
  {
    id: "expansion", title: "Une place pour demain", scene: "renovation", lessons: [],
    description: "Compare une extension, réorganise les zones et prépare une deuxième variété.",
    coach: "Avant d’agrandir, regardons ce qui manque. On peut déplacer du matériel, réutiliser la réserve et comparer un autre plan sans payer le devis.",
    rationale: "Le local est déjà entièrement rénové. L’investissement porte sur les équipements et les surfaces actives. Déplacer un appareil ne le vend pas ; les zones de service doivent toujours suivre les besoins des récoltes.",
    hint: "Compare deux plans et leurs charges. Cherche d’abord si un équipement en réserve peut être réutilisé.",
    action: "Comparer mon prochain plan", milestone: "Projet d’agrandissement étudié",
  },
  {
    id: "workshop", title: "Le savoir-faire de l’atelier", scene: "packing", lessons: [],
    description: "Découvre une transformation, ses prérequis et l’entretien des machines.",
    coach: "Je te prête un lot et une machine pour cet exercice. Compare le rendement, les conditions et le coût avant de transformer. On vérifiera aussi où va le reste.",
    rationale: "Une machine ne garantit ni la qualité requise ni une meilleure réputation. Son coût, sa capacité et son entretien font partie de la décision. Les prêts de cette rencontre restent identifiés et ne remplacent pas ta propre récolte.",
    hint: "Lis le devis de transformation et la destination du reste, puis retrouve l’état de la machine.",
    action: "Découvrir une transformation", milestone: "Atelier découvert",
  },
  {
    id: "business", title: "Une affaire qui grandit", scene: "packing", lessons: [],
    description: "Compare tes offres et comprends la demande, la satisfaction et la communication.",
    coach: "Une vente, c’est un début. Regardons ton stock, ton prix et les retours des clients. Tu pourras comparer une campagne de communication avant d’engager son budget.",
    rationale: "Une publicité ne remplace pas une offre disponible et adaptée. Les prévisions restent des estimations. Les rapports permettent de distinguer fréquentation, commandes, satisfaction et argent disponible.",
    hint: "Ouvre une annonce, compare son prix et son stock, puis consulte un rapport de campagne.",
    action: "Étudier mon commerce", milestone: "Développement du commerce étudié",
  },
  {
    id: "social", title: "La voix de ta ferme", scene: "packing", lessons: [],
    description: "Publie sur Instagram et X, lis les réactions et découvre les conditions des partenariats.",
    coach: "Les réseaux ont leur place dans le menu du quartier. Je te prête une récolte pour raconter ton métier. Compare les brouillons, choisis ce que tu publies et regarde les réactions avant de continuer.",
    rationale: "Chaque réseau garde ses abonnés et sa confiance ; les deux partagent ton énergie mentale. Les estimations ne sont pas des résultats. Les partenariats ont des conditions et des contenus à livrer avant tout versement. Tout se déroule dans le jeu, sans compte externe.",
    hint: "Dans Réseaux, publie un brouillon sur Instagram, lis son résultat, puis essaie X. Consulte ensuite les conditions des partenariats, sans obligation de signer.",
    action: "Essayer mes réseaux", milestone: "Publications et partenariats découverts",
  },
  {
    id: "merch", title: "Une collection à ton nom", scene: "packing", lessons: [],
    description: "Débloque la papeterie, fabrique une série et mets tes premiers articles en vitrine.",
    coach: "Dans Commerce, choisis Développer, puis Produits dérivés. Je te prête une entreprise déjà éligible : tu peux essayer la fabrication, choisir ton prix et observer les ventes.",
    rationale: "Ce dossier prête le site et la marque nécessaires, avec cinq commandes d’exemple. Débloquer un atelier et fabriquer ses articles sont deux dépenses distinctes. Les articles fabriqués restent en stock ; seuls ceux en vitrine peuvent se vendre. La cadence annoncée est une estimation.",
    hint: "Ouvre Produits dérivés, vérifie les conditions de la papeterie et son coût. Fabrique une petite série, choisis ton prix et mets-la en vitrine avant d’avancer l’horloge fictive.",
    action: "Préparer ma collection", milestone: "Fabrication et vitrine des produits dérivés découvertes",
  },
  {
    id: "bank", title: "La porte de la banque", scene: "arrival", lessons: ["bank", "investments"],
    description: "Lis un prêt, essaie le livret et découvre un portefeuille fictif.",
    coach: "Un financement peut aider un projet. Il faut aussi savoir ce qu’il faudra rembourser. Je t’ai préparé des dossiers d’essai pour comprendre les contrats et les placements.",
    rationale: "Le dossier Trésorier permet d’essayer le livret sans changer ta spécialité. Le portefeuille utilise des euros fictifs ; sa valeur peut baisser. Les gains de ces exercices ne financent pas obligatoirement la ferme.",
    hint: "Consulte le prêt et ses échéances, puis essaie dépôt et retrait. Une position se vend pour redevenir du solde disponible.",
    action: "Ouvrir les dossiers d’essai", milestone: "Dossiers bancaires explorés",
  },
  {
    id: "community", title: "Les gens du quartier", scene: "arrival", lessons: ["specialties", "missions"],
    description: "Essaie un personnage et découvre le circuit des récompenses.",
    coach: "Chacun avance à sa manière. Tu peux essayer une spécialité, regarder les défis et ouvrir une récompense. Ton vrai personnage et ses choix restent inchangés.",
    rationale: "La première récolte donne 50 € de jeu. Pour apprendre l’ouverture d’un pack, cet autre dossier prépare 15 variétés récoltées : le Jardin des connaisseurs donne trois cartes. Apparence et spécialité d’essai ne modifient pas le compte.",
    hint: "Crée ton personnage fictif, puis récupère le pack du Jardin des connaisseurs et ouvre-le directement depuis son reçu.",
    action: "Rencontrer le quartier", milestone: "Personnage et récompenses découverts",
  },
  {
    // Keep the saved meeting identifier when moving the tasting lesson to the Carnet.
    id: "notebook", title: "L’album sur l’étagère", scene: "arrival", lessons: ["collection"],
    description: "Ouvre un pack et découvre comment tes Buddies rejoignent l’album.",
    coach: "Je t’ai préparé un pack d’essai. Révèle ses trois Buddies, range-les dans ton album et ouvre une carte pour découvrir son profil.",
    rationale: "Le pack Buddies de cet exercice contient trois cartes préparées, sans prédire tes prochains tirages. Cet album d’essai reste indépendant de ta collection.",
    hint: "Ouvre le pack, révèle ses trois cartes, puis range-les dans l’album d’essai.",
    action: "Ouvrir mon pack d’essai", milestone: "Pack et album découverts",
  },
];

export const ARENA_RELEVE_LABELS = {
  title: "La relève",
  subtitle: "Une ferme à reprendre. Une aventure à construire.",
  launcher: "La relève · Apprendre à jouer",
  sandbox: "Sans compte · ferme, cartes et euros fictifs",
  pause: "Reprendre plus tard",
  hint: "Me donner un indice",
  chapters: "Voir les chapitres",
  rationale: "Pourquoi ?",
  firstDelivery: "Première livraison réalisée",
  storyComplete: "Première aventure accomplie",
  tourComplete: "Tour de la ferme et du quartier terminé",
} as const;
