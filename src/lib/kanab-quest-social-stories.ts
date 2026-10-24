import type { KqSocialChoice, KqSocialEffects, KqSocialScenario, KqSocialSponsorDefinition } from "./kanab-quest-social-types";
import { KQ_SOCIAL_INSTAGRAM_EXPANSION } from "./kanab-quest-social-instagram-expansion";
import { KQ_SOCIAL_X_EXPANSION } from "./kanab-quest-social-x-expansion";
import { applyKqSocialNarrative } from "./kanab-quest-social-narrative";
import { applyKqSocialProducerNarrative } from "./kanab-quest-social-producer";

/** Fictional situations and brands. Moderation is a game rule, not a claim about real platform policy. */
function choice(
  id: string, label: string, description: string, upside: string, downside: string, outcome: string,
  intent: KqSocialChoice["intent"], tag: KqSocialChoice["tag"],
  [followersMin, followersMax, haters, trust, moderation, energy]: [number, number, number, number, number, number],
): KqSocialChoice {
  return { id, label, description, upside, downside, outcome, intent, tag, effects: { followersMin, followersMax, haters, trust, moderation, energy } };
}

const growth = (min: number, max: number, rest: Partial<KqSocialEffects> = {}): Partial<KqSocialEffects> => ({ followersMin: min, followersMax: max, ...rest });

export const KQ_SOCIAL_ORIGINAL_SCENARIOS: KqSocialScenario[] = [
  {
    id: "ig-first-frame", platform: "instagram", arc: "Trouver sa signature", episode: 1,
    character: "Mila · photographe du quartier", title: "Tout rentre dans le cadre. Sauf toi.",
    audience: "Des curieux qui aiment les images et les histoires d’atelier",
    body: "Mila pose son appareil entre deux cartons. « Le bazar, on l’assume ou on le pousse hors champ ? » Tu prépares une série sur ton atelier. Le public ne te connaît pas encore : il peut venir pour le spectacle, pour ton travail ou pour la personne qui le fait.",
    choices: [
      choice("workshop", "Les mains au travail", "Un carrousel montre une étape réussie, un essai raté et ce que tu en as appris.", "Une raison concrète de te suivre.", "Un montage exigeant pour une portée modérée.", "Les images de travail attirent des curieux patients. L’essai raté suscite des questions utiles ; quelques remarques sèches se glissent aussi dans le fil.", "craft", "craft", [16, 25, 2, 5, 0, -18]),
      choice("reveal", "Le grand avant / après", "Mila transforme le désordre en révélation spectaculaire, avec toi au centre du dernier plan.", "Un format facile à partager.", "Le spectacle attire aussi un public peu fidèle.", "Le changement de décor fait circuler la vidéo. Des visiteurs restent pour la prochaine transformation ; certains trouvent la mise en scène plus intéressante que l’atelier.", "reach", "visual", [28, 42, 8, -3, 0, -14]),
      choice("postcard", "Une carte postale du jour", "Une image simple, une légende personnelle et une réponse aux premiers commentaires.", "Un rythme facile à tenir.", "Peu de personnes découvrent le compte.", "La photo trouve son petit cercle. Les échanges restent tranquilles et tu gardes du temps pour travailler ; la publication dépasse peu le quartier.", "care", "community", [1, 4, -8, 2, 0, -5]),
    ],
  },
  {
    id: "ig-comment", platform: "instagram", arc: "Trouver sa signature", episode: 2,
    character: "Mila · photographe du quartier", title: "« Et derrière le joli décor ? »",
    audience: "Des visiteurs qui hésitent encore à rester",
    body: "Un commentaire demande ce qu’on trouvera ici après les belles images. Ce n’est pas une attaque, mais les réponses commencent à se moquer du décor. Mila lève les yeux : « On peut leur montrer la suite. Ou leur laisser décider de notre programme. »",
    followups: [
      { fromScenarioId: "ig-first-frame", fromChoiceId: "workshop", body: "Ton carrousel a lancé une vraie question : « Et l’essai raté, tu l’as corrigé ? » Une personne se moque du décor, mais plusieurs lecteurs attendent surtout la suite du travail. Mila retrouve les photos : tu as déjà la matière d’un nouvel épisode.", choiceModifiers: { process: growth(5, 8, { energy: 3 }), joke: { trust: -2 } } },
      { fromScenarioId: "ig-first-frame", fromChoiceId: "reveal", body: "Après ton avant / après, le commentaire le plus visible demande : « Et derrière le joli décor ? » Les visiteurs venus pour le spectacle se mélangent aux curieux du métier. Mila sourit : « Le carton qu’on a caché est devenu une vedette. »", choiceModifiers: { joke: growth(6, 10, { haters: 3 }), process: { trust: 3, energy: -2 } } },
    ],
    choices: [
      choice("pin", "Épingler un petit mode d’emploi", "Tu expliques en trois lignes ce que tu partages et ce que tu gardes pour toi.", "Des attentes claires, peu d’énergie dépensée.", "La conversation gagne peu de nouveaux lecteurs.", "Les habitués savent où ils mettent les pieds. Les plaisanteries perdent du terrain, mais ton message de présentation circule peu au-delà du compte.", "care", "community", [1, 3, -9, 3, 0, -5]),
      choice("joke", "Faire du carton une vedette", "Une courte vidéo joue avec ton décor bricolé, sans viser la personne qui a commenté.", "L’autodérision peut élargir ton public.", "Certains attendront désormais surtout des blagues.", "Le carton obtient son propre surnom dans les commentaires. La vidéo attire des regards ; une partie du nouveau public attend déjà le prochain gag.", "reach", "visual", [26, 39, 7, -2, 0, -13]),
      choice("process", "Montrer la suite du travail", "Tu prépares un carrousel sur une décision concrète, avec ses contraintes et ses limites.", "Les curieux comprennent ton métier.", "La préparation prend une vraie part de ta journée.", "Les lecteurs discutent de tes choix au lieu du décor. Le fond intéresse les curieux du métier, tandis que les amateurs de spectacle passent plus vite à autre chose.", "craft", "craft", [17, 26, 1, 5, 0, -18]),
    ],
  },
  {
    id: "ig-collab", platform: "instagram", arc: "Trouver sa signature", episode: 3,
    character: "Jade · céramiste voisine", title: "Deux ateliers, une seule prise",
    audience: "Les communautés de deux artisans du même quartier",
    body: "Jade arrive avec trois bols et une rallonge. « J’apporte les objets, tu apportes la lumière. Pour la rallonge, on négocie. » Elle propose une publication commune sans paiement. Vos publics peuvent se rencontrer, mais il faut décider ce que vous racontez ensemble.",
    followups: [
      { fromScenarioId: "ig-comment", fromChoiceId: "joke", body: "Jade a vu la vidéo du carton vedette. Elle apporte trois bols et propose un duel amical de décors bricolés. « On garde une place pour le travail, quand même ? » Le format drôle a déjà un public ; une vraie démonstration demanderait de changer son attente.", choiceModifiers: { challenge: growth(7, 11, { haters: 2 }), duet: { energy: -2, trust: 2 } } },
      { fromScenarioId: "ig-comment", fromChoiceId: "process", body: "Jade a suivi ton explication du métier et veut comparer vos façons de travailler. Elle apporte trois bols : le réussi, le bancal et celui qu’elle appelle « conceptuel ». Vos abonnés ont déjà des questions. Vous pouvez prolonger la discussion ou élargir le spectacle.", choiceModifiers: { duet: growth(5, 8, { energy: 3 }), thanks: { trust: 2 } } },
    ],
    choices: [
      choice("challenge", "Un défi de décors en duo", "Chacun compose une image avec les objets de l’autre ; les lecteurs votent pour leur ambiance préférée.", "Les deux publics peuvent relayer le défi.", "La compétition attire du bruit et des comparaisons.", "Le vote fait voyager les images entre les deux comptes. Les curieux comparent vos univers, tandis qu’une petite bataille de goûts occupe une partie des commentaires.", "reach", "visual", [30, 44, 9, -2, 0, -16]),
      choice("duet", "Croiser deux gestes de métier", "Un carrousel rapproche vos choix de matières, vos erreurs et vos contraintes.", "Un lien cohérent entre les communautés.", "Il faut coordonner deux emplois du temps.", "Les lecteurs reconnaissent des préoccupations communes derrière des métiers différents. La rencontre attire un public intéressé, au prix d’une longue préparation à deux.", "craft", "craft", [19, 29, 2, 6, 0, -20]),
      choice("thanks", "Une recommandation personnelle", "Une photo de l’atelier de Jade, un mot sincère et un renvoi vers son compte.", "Une rencontre simple, sans grand dispositif.", "Tu occupes moins le centre de la publication.", "Quelques lecteurs partent découvrir Jade, et d’autres font le chemin inverse. La rencontre reste discrète ; tu n’as pas transformé une visite en journée de tournage.", "care", "community", [2, 5, -7, 3, 0, -6]),
    ],
  },
  {
    id: "ig-sensitive-frame", platform: "instagram", arc: "Le cadre et ses limites", episode: 1,
    character: "Mila · photographe du quartier", title: "Ce que l’image peut montrer",
    audience: "Des passionnés de cannabis mêlés aux curieux du visuel",
    body: "Tu prépares une série sur ton univers, cannabis compris. Dans cette aventure, les images de cannabis peuvent déclencher des alertes et limiter la diffusion. Mila aligne trois cadrages : le sujet frontal, les gestes de l’atelier et une nature morte. Chaque image raconte quelque chose de différent.",
    choices: [
      choice("still", "Une nature morte d’atelier", "Carnet, outils et lumière du soir : une image d’ambiance, sans produit sensible ni promesse commerciale.", "Une publication légère à préparer.", "Les passionnés verront peu de leur sujet favori.", "L’ambiance plaît au public des images. La publication déclenche peu de discussions et laisse les passionnés attendre un prochain sujet plus précis.", "care", "visual", [2, 4, -6, 1, 0, -5]),
      choice("flower", "Assumer le gros plan de cannabis", "Tu publies une photo détaillée avec une légende descriptive, en acceptant le risque de modération du jeu.", "Une image identifiable pour les passionnés.", "Une alerte supplémentaire peut réduire ta portée.", "Les passionnés reconnaissent immédiatement le sujet. Une alerte du jeu s’ajoute au compte : l’intérêt pour la photo ne protège pas sa diffusion.", "reach", "visual", [29, 43, 7, -1, 1, -15]),
      choice("craft", "Raconter un choix de fabrication", "Un récit illustré explique une contrainte de l’atelier, sans présenter le produit sensible.", "De la matière pour les lecteurs qui aiment comprendre.", "Il faut trouver des images parlantes sans tout montrer.", "Le récit attire des questions sur ta démarche. Il plaît davantage aux curieux du métier qu’aux amateurs de gros plans et demande un vrai travail de préparation.", "craft", "craft", [17, 25, 2, 5, 0, -18]),
    ],
  },
  {
    id: "ig-moderation", platform: "instagram", arc: "Le cadre et ses limites", episode: 2,
    character: "Mila · photographe du quartier", title: "Une ligne à tenir",
    audience: "Des abonnés qui veulent savoir ce qu’ils pourront suivre ici",
    body: "Une lectrice demande où tu traces la limite entre récit d’atelier et présentation de cannabis. Le fil accueille des goûts différents. Mila te laisse son carnet : « On peut changer de cadrage sans faire semblant d’être devenus une boutique de coussins. »",
    followups: [
      { fromScenarioId: "ig-sensitive-frame", fromChoiceId: "flower", body: "Ton gros plan a ajouté une alerte au compte. Plusieurs passionnés en redemandent ; d’autres veulent comprendre la restriction. Mila te montre le carnet : « On choisit la suite avant de chercher à faire plus de bruit. » Ton prochain geste donnera le ton.", choiceModifiers: { explain: { trust: 3 }, defend: growth(6, 9, { haters: 4 }), archive: { moderation: -1 } } },
      { fromScenarioId: "ig-sensitive-frame", fromChoiceId: "craft", body: "Ton récit d’atelier a reçu des questions précises, dont une sur l’absence de gros plans. Mila feuillette les images inutilisées : « Tu as déjà une ligne. Reste à la rendre lisible. » Tu peux approfondir, ouvrir le débat ou garder un fil léger.", choiceModifiers: { explain: growth(4, 7, { energy: 3 }), defend: { trust: -2 } } },
    ],
    choices: [
      choice("explain", "Expliquer ton cadrage", "Une courte série présente ta ligne éditoriale et transforme les contenus sensibles en récits de métier.", "La confiance progresse ; une alerte peut disparaître.", "Une explication attire moins qu’une image spectaculaire.", "Les lecteurs comprennent ce que tu veux partager. Le compte retrouve de la marge face à la modération, et quelques curieux restent pour cette ligne plus claire.", "craft", "craft", [15, 23, -2, 6, -1, -18]),
      choice("archive", "Élaguer le fil et souffler", "Tu archives les contenus sensibles et épingles une annonce brève sur les prochains thèmes.", "Moins de pression et d’alertes.", "La visibilité du jour reste faible.", "Le fil gagne en lisibilité. Les conversations se calment, sans grande vague de découverte ; tu récupères surtout de la place pour préparer la suite.", "care", "community", [0, 2, -9, 2, -1, -5]),
      choice("defend", "Ouvrir un débat sur les images", "Un visuel typographique pose la question du cadrage et invite le public à se prononcer.", "Un sujet qui peut sortir de ton cercle.", "Le débat attire des réactions hostiles et détourne du métier.", "Le débat est relayé au-delà du compte. Certains découvrent ton projet ; d’autres viennent surtout défendre leur camp, et la modération des commentaires te sollicite.", "reach", "dialogue", [27, 40, 11, -3, 0, -16]),
    ],
  },
  {
    id: "ig-return", platform: "instagram", arc: "Le cadre et ses limites", episode: 3,
    character: "Jade · céramiste voisine", title: "Le prochain rendez-vous",
    audience: "Des lecteurs qui choisissent s’ils vont revenir",
    body: "Jade propose de prêter un coin de son atelier pour la prochaine publication. « La lumière est parfaite. Le tabouret, moins. » Tu peux lancer un grand format, installer un rendez-vous de métier ou faire une petite place à la communauté. La suite doit rester possible à tenir.",
    followups: [
      { fromScenarioId: "ig-moderation", fromChoiceId: "defend", body: "Le débat sur tes images a amené du monde, avec des conversations qui débordent encore. Jade propose un tournage dans son atelier : « Mon tabouret ne participera à aucune polémique. » Une annonce forte profiterait de l’attention ; un rendez-vous calme changerait le rythme.", choiceModifiers: { premiere: growth(7, 10, { haters: 3 }), letters: { haters: -4, trust: 2 } } },
      { fromScenarioId: "ig-moderation", fromChoiceId: "archive", body: "Après ton tri du fil, les commentaires sont plus calmes et les habitudes restent à reconstruire. Jade prête son atelier pour une nouvelle série. « Le tabouret grince, mais il tient ses engagements. » Un retour modeste peut remettre le rendez-vous en route.", choiceModifiers: { letters: growth(3, 5, { trust: 2 }), series: { energy: 2 } } },
      { fromScenarioId: "ig-moderation", fromChoiceId: "explain", body: "Ta ligne éditoriale est plus claire, et des lecteurs réclament déjà un exemple. Jade prête son atelier pour le montrer en images. « Une démonstration, oui. Une conférence sur mon tabouret, non. » Ton explication t’a préparé un public attentif.", choiceModifiers: { series: growth(5, 8, { trust: 2 }), premiere: { energy: -2 } } },
    ],
    choices: [
      choice("series", "Un épisode de carnet d’atelier", "Tu réalises un format reproductible sur une décision et son résultat, sans promesse de cadence impossible.", "Une série que les curieux peuvent reconnaître.", "Le premier épisode demande de la préparation.", "Les lecteurs retrouvent un fil conducteur. La série attire moins de regards qu’un grand lancement, mais donne une raison concrète de suivre la prochaine étape.", "craft", "craft", [18, 27, 1, 5, 0, -19]),
      choice("premiere", "Une première très visuelle", "Tu montes une visite spectaculaire des deux ateliers, annoncée comme un événement unique.", "Une porte d’entrée pour un public plus large.", "Beaucoup d’attention à gérer après le montage.", "La visite fait découvrir ton univers à de nouveaux curieux. Les commentaires s’accélèrent, et une partie du public venu pour l’événement repart aussitôt après.", "reach", "visual", [29, 43, 8, -2, 0, -16]),
      choice("letters", "Répondre à une question d’abonné", "Une photo simple accompagne une réponse choisie parmi les questions reçues.", "Un lien direct et une pression qui retombe.", "Une portée limitée au cercle déjà intéressé.", "La personne reçoit une vraie réponse, et les habitués reprennent la conversation. La publication reste discrète mais laisse de l’air dans ta journée.", "care", "community", [2, 4, -9, 3, 0, -5]),
    ],
  },
  {
    id: "ig-demand", platform: "instagram", arc: "Quand le quartier regarde", episode: 1,
    character: "Mila · photographe du quartier", title: "« C’est quand, la suite ? »",
    audience: "Des curieux du compte et de ta boutique",
    body: "Sous une image, trois messages posent la même question : « C’est quand, la suite ? » Mila dessine un calendrier sur un emballage. Tu peux transformer l’attente en événement, montrer ce qui avance ou répondre sans fabriquer une promesse. La visibilité attire des demandes, pas du stock magique.",
    choices: [
      choice("preview", "Faire une bande-annonce", "Tu annonces une présentation de l’univers, en précisant que ce n’est pas une disponibilité produit.", "Le suspense peut toucher de nouveaux curieux.", "L’attention et les attentes montent ensemble.", "La bande-annonce circule et attire des questions sur la suite. Malgré la précision, certains retiennent surtout l’effet d’annonce : le fil demande davantage d’attention.", "reach", "visual", [28, 42, 9, -3, 0, -14]),
      choice("honest", "Montrer une étape en cours", "Tu expliques ce qui avance et ce qui reste incertain, sans annoncer une vente fictive.", "Une communauté qui comprend ton rythme.", "Documenter le travail prend du temps.", "Le point d’étape aide les lecteurs à comprendre le rythme de l’atelier. La découverte est moins spectaculaire, mais les questions deviennent plus précises.", "craft", "craft", [17, 26, 2, 5, 0, -18]),
      choice("window", "Ouvrir une petite boîte à questions", "Tu regroupes quelques questions et annonces que tu répondras à une sélection, sans permanence en messages privés.", "Un cadre clair et peu de préparation.", "Le format reste surtout entre habitués.", "Les habitués déposent leurs questions. Le cadre limite les sollicitations et la publication déborde peu du cercle déjà intéressé par ton aventure.", "care", "community", [1, 3, -8, 2, 0, -6]),
    ],
  },
  {
    id: "ig-identity", platform: "instagram", arc: "Quand le quartier regarde", episode: 2,
    character: "Mila · photographe du quartier", title: "Le visage et la vitrine",
    audience: "Des visiteurs qui cherchent une personne derrière la marque",
    body: "Une tendance consiste à montrer « une journée entière avec moi ». Mila te propose un portrait. Toi, tu regardes surtout la liste de tout ce qui entrerait dans le cadre. Montrer davantage de soi peut créer un lien ; garder une frontière peut aussi donner une identité au compte.",
    followups: [
      { fromScenarioId: "ig-demand", fromChoiceId: "preview", body: "Ta bande-annonce a laissé des curieux sur leur faim. Ils réclament maintenant « une journée entière avec toi ». Mila propose un portrait vivant ; tu regardes la liste des choses que tu préfères garder hors champ. Le public veut une suite, pas forcément toute ta vie.", choiceModifiers: { day: growth(6, 9, { haters: 3 }), objects: { trust: 3 } } },
      { fromScenarioId: "ig-demand", fromChoiceId: "window", body: "Ta boîte à questions a fait remonter un thème : comment travailles-tu au quotidien ? Les habitués savent déjà que tu réponds à une sélection. Mila propose un portrait ; tu peux garder ce cadre ou ouvrir une fenêtre plus large sur ton atelier.", choiceModifiers: { objects: growth(4, 6, { energy: 2 }), boundary: { haters: -3 } } },
    ],
    choices: [
      choice("boundary", "Un portrait, une frontière", "Tu partages une image et une petite anecdote d’atelier, en gardant ta vie privée hors du fil.", "Une présence personnelle facile à soutenir.", "Peu de matière pour les amateurs de coulisses.", "Le portrait fait plaisir aux habitués sans ouvrir un feuilleton sur ton quotidien. Le lien se réchauffe, mais la publication attire peu de nouveaux regards.", "care", "community", [2, 4, -8, 3, 0, -5]),
      choice("objects", "Raconter trois objets importants", "Un carrousel relie trois objets à des choix de métier, avec une courte histoire pour chacun.", "Une signature personnelle liée à ton travail.", "Écrire et photographier la série coûte de l’énergie.", "Les objets deviennent des repères pour les lecteurs. Le public découvre ton parcours à travers le travail, et plusieurs questions prolongent la série.", "craft", "craft", [18, 27, 2, 5, 0, -18]),
      choice("day", "Une journée d’atelier en vidéo", "Tu montres un parcours vivant entre tâches, imprévus et préparation, dans les limites que tu as choisies.", "Un format accessible au-delà des passionnés.", "Les demandes de contenu personnel vont augmenter.", "Les imprévus et les détails du quotidien rendent la vidéo facile à partager. Des curieux restent pour toi ; certains demandent déjà de filmer beaucoup plus souvent.", "reach", "visual", [27, 41, 8, -2, 0, -15]),
    ],
  },
  {
    id: "ig-open-house", platform: "instagram", arc: "Quand le quartier regarde", episode: 3,
    character: "Jade · céramiste voisine", title: "La porte ouverte, le téléphone fermé",
    audience: "Une communauté qui commence à reconnaître ton univers",
    body: "Jade organise une rencontre entre ateliers et te propose d’en raconter un morceau. Mila a préparé une pancarte : « Merci de demander avant de filmer les gens. » Tu dois choisir un format qui accueille les curieux sans passer toute la rencontre derrière ton téléphone.",
    followups: [
      { fromScenarioId: "ig-identity", fromChoiceId: "day", body: "Depuis ta vidéo du quotidien, les curieux demandent une visite. La rencontre organisée par Jade tombe bien. Mila a une pancarte sur le droit de rester hors champ et une question pratique : « Tu veux vivre l’événement ou en monter la bande-annonce ? »", choiceModifiers: { highlights: growth(6, 10, { haters: 2 }), portrait: { trust: 2 } } },
      { fromScenarioId: "ig-identity", fromChoiceId: "objects", body: "Ta série sur les objets a donné aux lecteurs des questions pour la rencontre de Jade. Mila prépare un coin photo où chacun choisira d’apparaître ou non. Les curieux viennent avec des sujets précis : tu peux en faire un reportage ou simplement prendre le temps de discuter.", choiceModifiers: { portrait: growth(5, 8, { energy: 3 }), postcard: { trust: 2 } } },
    ],
    choices: [
      choice("portrait", "Un petit reportage de métier", "Tu choisis un artisan volontaire et racontes une étape de son travail, avec le contexte qui lui tient à cœur.", "Une rencontre utile aux deux communautés.", "Le montage se fera après l’événement.", "Le reportage donne envie de découvrir le travail présenté et ton regard sur le quartier. La rencontre laisse une histoire solide, avec encore du montage à fournir.", "craft", "craft", [19, 28, 2, 6, 0, -20]),
      choice("postcard", "Une photo collective volontaire", "Une image avec les participants qui le souhaitent, un remerciement, puis tu ranges le téléphone.", "Tu profites de la rencontre sans nourrir la pression.", "La publication a peu de chances de dépasser le cercle local.", "La photo entretient le lien avec le quartier. Les participants apprécient l’attention, la conversation reste paisible et l’événement ne devient pas une journée de production.", "care", "community", [2, 5, -9, 3, 0, -5]),
      choice("highlights", "Les temps forts en une minute", "Tu montes les images des participants volontaires dans un format rythmé, pensé pour découvrir les ateliers.", "Une vitrine qui peut circuler largement.", "Le format montre peu de profondeur et attire plus de bruit.", "Les temps forts font voyager la rencontre hors du quartier. Les curieux arrivent vite ; une partie ne cherche que le prochain événement spectaculaire.", "reach", "visual", [30, 44, 9, -2, 0, -16]),
    ],
  },
  {
    id: "x-first-thread", platform: "x", arc: "Un nom dans la discussion", episode: 1,
    character: "Noé · habitué des longues discussions", title: "Une phrase, beaucoup de monde",
    audience: "Des passionnés, des professionnels et des contradicteurs",
    body: "Noé t’envoie un fil sur le travail artisanal. « Tu as quelque chose à raconter. Essaie de le faire avant que le débat porte sur la définition du mot travail. » Ici, tu peux défendre une idée, détailler ton expérience ou commencer par écouter. L’attention se mérite et se discute.",
    choices: [
      choice("listen", "Poser une question précise", "Tu interroges les autres sur une contrainte que tu connais, sans demander de régler tout ton atelier.", "Une entrée tranquille dans la conversation.", "Tu touches surtout les personnes déjà présentes.", "Quelques passionnés prennent le temps de répondre. Tu trouves une place dans la discussion, sans occuper toute la scène ni attirer beaucoup de nouveaux lecteurs.", "care", "dialogue", [0, 3, -8, 2, 0, -6]),
      choice("thread", "Partager une expérience détaillée", "Tu racontes une décision, ce qu’elle a changé et les limites de ton cas.", "Les lecteurs ont quelque chose à discuter et à retenir.", "Rédiger clairement prend beaucoup d’attention.", "Le fil attire un petit public attentif. Des lecteurs discutent tes limites ; quelques réponses hostiles arrivent aussi, sans résumer l’ensemble de la conversation.", "craft", "craft", [9, 16, 3, 5, 0, -22]),
      choice("hook", "Défendre une idée en une formule", "Une phrase tranchée remet en question une habitude du métier, puis renvoie vers ton expérience.", "Une position facile à reprendre et à contester.", "La formule circulera parfois sans son contexte.", "La formule dépasse ton premier cercle. Des lecteurs s’abonnent pour ton point de vue ; d’autres la citent sans le contexte et rendent le fil plus agressif.", "reach", "dialogue", [14, 24, 12, -3, 0, -18]),
    ],
  },
  {
    id: "x-proof", platform: "x", arc: "Un nom dans la discussion", episode: 2,
    character: "Sami · artisan qui aime vérifier", title: "« Tu peux montrer ton raisonnement ? »",
    audience: "Des lecteurs qui cherchent ce qui tient derrière les affirmations",
    body: "Sami demande sur quoi repose ton avis. Son message est direct, mais la question est valable. Deux comptes en profitent pour se moquer. Noé rappelle que tu n’es pas obligé de répondre aux trois de la même façon. Tu peux approfondir, synthétiser ou poser une limite précise.",
    followups: [
      { fromScenarioId: "x-first-thread", fromChoiceId: "thread", body: "Sami a lu ton retour d’expérience et relève une limite que tu avais signalée. Il propose une autre explication. Deux comptes ricanent déjà, mais tu disposes de tes notes. Noé insiste : « Il pose une question. Les autres font le bruit de fond. »", choiceModifiers: { notes: growth(4, 6, { energy: 4 }), concise: { trust: 2 } } },
      { fromScenarioId: "x-first-thread", fromChoiceId: "hook", body: "Ta formule tranchée circule sans le lien vers ton expérience. Sami demande ce que tu voulais vraiment dire. Des lecteurs débattent désormais d’une version simplifiée de ton idée. Noé te conseille de choisir ta cible : préciser le fond, reformuler publiquement ou borner la discussion.", choiceModifiers: { concise: growth(4, 7, { haters: 3 }), notes: { trust: 3, energy: -2 }, scope: { haters: -3 } } },
    ],
    choices: [
      choice("concise", "Reformuler pour tout le fil", "Tu publies une réponse courte, ferme sur ton idée et explicite sur la limite de ton expérience.", "Un message lisible par les nouveaux arrivants.", "La discussion peut repartir autour de la formule.", "La réponse redonne un point d’entrée aux lecteurs. Elle est reprise, parfois contestée vivement ; l’échange gagne en visibilité plus qu’en tranquillité.", "reach", "dialogue", [14, 23, 10, -2, 0, -18]),
      choice("scope", "Dire où s’arrête ta réponse", "Tu précises ce que tu sais et la question que tu ne peux pas trancher aujourd’hui.", "Tu gardes une limite sans inventer une certitude.", "Les lecteurs qui attendent une démonstration repartent sans elle.", "Les échanges ralentissent après ta précision. Quelques lecteurs apprécient la limite posée ; d’autres cherchent un développement ailleurs, sans que tu prolonges indéfiniment le fil.", "care", "dialogue", [0, 2, -10, 3, 0, -6]),
      choice("notes", "Ouvrir ton carnet de travail", "Tu relies ton argument à un exemple concret, avec ce qui peut et ne peut pas s’en déduire.", "Une discussion plus solide avec les passionnés.", "Préparer les détails coûte du temps et de l’énergie.", "Sami peut répondre sur le fond. Les lecteurs intéressés par la méthode trouvent une raison de rester, et la discussion gagne en précision sans devenir unanime.", "craft", "craft", [10, 17, 2, 6, 0, -23]),
    ],
  },
  {
    id: "x-rival", platform: "x", arc: "Un nom dans la discussion", episode: 3,
    character: "Sami · artisan qui aime vérifier", title: "Le même métier, deux méthodes",
    audience: "Deux petites communautés qui comparent leurs habitudes",
    body: "Sami propose de comparer vos façons d’aborder le même problème. « On peut être en désaccord sans mesurer nos étagères », précise-t-il. Son public est curieux du tien. Un duel d’idées, une comparaison documentée ou un simple passage de relais ne construiront pas la même relation.",
    followups: [
      { fromScenarioId: "x-proof", fromChoiceId: "notes", body: "Sami a lu ton carnet et y a reconnu une contrainte qu’il gère autrement. Il propose de comparer vos méthodes, avec un exemple chacun. « On peut être en désaccord sans mesurer nos étagères. » Tu as déjà de quoi préparer la discussion.", choiceModifiers: { compare: growth(4, 7, { energy: 4 }), relay: { trust: 2 } } },
      { fromScenarioId: "x-proof", fromChoiceId: "concise", body: "Ta réponse courte a attiré des lecteurs qui veulent voir qui aura le dernier mot. Sami propose une comparaison de méthodes : « Les étagères peuvent rester hors compétition. » Un débat profiterait de cette attention ; un échange documenté demanderait de changer de tempo.", choiceModifiers: { debate: growth(5, 8, { haters: 4 }), compare: { trust: 3, energy: -2 } } },
    ],
    choices: [
      choice("compare", "Comparer les contraintes", "Vous préparez chacun un exemple et expliquez dans quelles conditions votre méthode vous convient.", "Une rencontre utile entre publics exigeants.", "La préparation est longue, même sans affrontement.", "Les lecteurs découvrent deux raisonnements plutôt qu’un classement. Une partie du public de Sami s’intéresse à ton travail ; quelques désaccords restent vifs.", "craft", "craft", [11, 18, 3, 6, 0, -24]),
      choice("relay", "Partager sa réponse et un point commun", "Tu mets en avant un élément utile de son approche, avec une courte remarque personnelle.", "Un lien entre communautés sans mobiliser tout ton temps.", "Tu laisses l’essentiel de la lumière à Sami.", "Des lecteurs passent d’un compte à l’autre. Le relais reste discret, mais la rivalité recule et tu gardes du temps pour ton atelier.", "care", "community", [1, 4, -9, 3, 0, -6]),
      choice("debate", "Organiser un duel d’idées cadré", "Une question, deux positions et une limite de réponses : tu invites les lecteurs à trancher sur le fond.", "Le contraste rend la discussion facile à partager.", "Même cadrée, la confrontation attire des prises de parti.", "Le duel d’idées fait circuler vos deux comptes. Des lecteurs découvrent ton point de vue, pendant que d’autres transforment la comparaison en match entre équipes.", "reach", "dialogue", [16, 26, 13, -3, 0, -20]),
    ],
  },
  {
    id: "x-pile-on", platform: "x", arc: "Garder la main", episode: 1,
    character: "Noé · habitué des longues discussions", title: "Le téléphone n’a plus de table",
    audience: "Des curieux mêlés à des comptes venus provoquer",
    body: "Un compte reprend un de tes messages hors contexte. Les notifications font vibrer le téléphone au point de le rapprocher du bord de la table. Noé t’envoie un seul mot : « Respire. » Tu peux rendre le contexte visible, documenter calmement ou fermer la porte aux relances.",
    choices: [
      choice("mute", "Clarifier en une ligne, puis couper", "Tu ajoutes le contexte essentiel, limites les notifications et laisses la conversation suivre son cours.", "La pression recule à faible coût mental.", "Tu renonces à accueillir une partie des nouveaux lecteurs.", "Ton message de contexte reste accessible pendant que tu quittes le fil. Les relances perdent une prise et tu laisses passer une partie de l’attention disponible.", "care", "community", [0, 2, -12, 2, 0, -6]),
      choice("reframe", "Faire une réponse très visible", "Tu réponds au message qui circule avec une formule claire et un lien vers le contexte complet.", "Les lecteurs extérieurs peuvent retrouver ton point de vue.", "Tu remets ton compte au centre des notifications.", "La réponse retrouve une partie du public arrivé par la citation. Des curieux restent ; de nouveaux contradicteurs hostiles arrivent aussi, prolongeant la pression.", "reach", "dialogue", [15, 25, 14, -3, 0, -20]),
      choice("context", "Assembler le contexte une fois", "Un court fil reprend la question d’origine, ton exemple et la limite qu’il avait.", "Un repère solide pour les lecteurs de bonne foi.", "Rédiger sous pression demande beaucoup d’attention.", "Le fil devient un point de référence pour les lecteurs qui veulent comprendre. Il attire un public limité mais attentif, sans empêcher quelques relances agressives.", "craft", "craft", [9, 16, 2, 6, 0, -23]),
    ],
  },
  {
    id: "x-spotlight", platform: "x", arc: "Garder la main", episode: 2,
    character: "Noé · habitué des longues discussions", title: "Tout le monde a une dernière question",
    audience: "Des lecteurs arrivés par les partages récents",
    body: "Des personnes découvrent ton compte et posent des questions déjà vues. D’autres voudraient relancer une vieille dispute. Noé te propose de regrouper ce qui mérite une réponse. Tu peux donner un rendez-vous clair, faire un accueil très visible ou annoncer quand tu refermes le fil.",
    followups: [
      { fromScenarioId: "x-pile-on", fromChoiceId: "reframe", body: "Ta réponse visible a remis ton compte dans la conversation. Les bonnes questions et les provocations arrivent ensemble. Noé a repéré trois thèmes qui reviennent : « Tu peux répondre à des sujets. Tu n’es pas obligé de répondre à Internet. »", choiceModifiers: { welcome: growth(5, 8, { haters: 4 }), boundaries: { haters: -4, trust: 2 } } },
      { fromScenarioId: "x-pile-on", fromChoiceId: "context", body: "Ton fil de contexte sert déjà de réponse aux questions répétées. Noé suggère de le transformer en point d’accueil. Les lecteurs intéressés ont surtout besoin de savoir où poursuivre ; les relances agressives cherchent encore à t’occuper.", choiceModifiers: { faq: growth(4, 6, { energy: 4 }), welcome: { trust: 2 } } },
      { fromScenarioId: "x-pile-on", fromChoiceId: "mute", body: "Tu as coupé les notifications et laissé le contexte accessible. Le bruit a baissé ; quelques questions utiles attendent encore. Noé les a regroupées : « Elles seront toujours là après ton café. » Tu peux rouvrir une fenêtre choisie sans revenir à toutes les relances.", choiceModifiers: { boundaries: { haters: -3 }, faq: { energy: 3, trust: 2 } } },
    ],
    choices: [
      choice("welcome", "Accueillir les nouveaux en public", "Un message accrocheur résume ton projet et invite les lecteurs à choisir le prochain sujet de discussion.", "Une porte d’entrée largement partageable.", "Tu ouvres une nouvelle vague de sollicitations.", "Le message donne une raison simple de découvrir ton compte. Les propositions affluent, avec de nouvelles attentes et quelques comptes venus imposer leur programme.", "reach", "dialogue", [15, 24, 12, -2, 0, -18]),
      choice("faq", "Construire un fil de repères", "Tu regroupes trois questions utiles et y réponds avec tes exemples, sans promettre une permanence.", "Un accueil qui donne de la profondeur au compte.", "Il faut choisir et rédiger les réponses.", "Les nouveaux lecteurs trouvent des repères et les habitués peuvent les partager. Le fil attire un public intéressé sans transformer chaque notification en obligation.", "craft", "craft", [10, 17, 2, 5, 0, -22]),
      choice("boundaries", "Fermer le fil avec un prochain thème", "Tu annonces ce que tu aborderas ensuite et ranges les notifications après une réponse brève.", "Un rythme lisible et moins de pression.", "Une partie de l’attention retombe sans devenir des abonnements.", "Les lecteurs savent que la discussion a une fin. Quelques curieux restent pour le thème annoncé ; d’autres passent à autre chose et les relances diminuent.", "care", "community", [0, 3, -11, 3, 0, -6]),
    ],
  },
  {
    id: "x-community", platform: "x", arc: "Garder la main", episode: 3,
    character: "Noé · habitué des longues discussions", title: "Une table, pas un ring",
    audience: "Les habitués qui ont envie de revenir échanger",
    body: "Noé propose un rendez-vous : chacun raconte une erreur de travail et ce qu’il en a fait. « J’ai déjà trois exemples. Je peux en prêter un. » Tu peux animer un échange approfondi, ouvrir une question qui circulera largement ou simplement passer le micro aux habitués.",
    followups: [
      { fromScenarioId: "x-spotlight", fromChoiceId: "faq", body: "Ton fil de repères a fait émerger des lecteurs qui se répondent déjà entre eux. Noé propose un rendez-vous sur les erreurs de travail : « J’en ai assez pour le premier trimestre. » Tu peux prolonger ce fond commun ou lancer un sujet plus large.", choiceModifiers: { roundtable: growth(4, 7, { energy: 4 }), relay: { trust: 2 } } },
      { fromScenarioId: "x-spotlight", fromChoiceId: "boundaries", body: "Tu avais annoncé un prochain thème avant de refermer le fil. Les habitués l’attendent sans avoir reçu une promesse de disponibilité permanente. Noé propose les erreurs de travail : « Un sujet sur lequel je suis très documenté. » Le cadre est déjà posé.", choiceModifiers: { relay: growth(3, 5, { haters: -3 }), roundtable: { energy: 3 } } },
      { fromScenarioId: "x-spotlight", fromChoiceId: "welcome", body: "Ton invitation a amené de nombreuses propositions, parfois incompatibles. Noé suggère un thème commun : une erreur et ce qu’elle a appris. « Tout le monde a le droit de parler. Personne n’a besoin de tenir le micro toute la nuit. »", choiceModifiers: { question: growth(4, 7, { haters: 3 }), roundtable: { trust: 3, energy: -2 } } },
    ],
    choices: [
      choice("roundtable", "Animer des retours d’expérience", "Tu choisis trois récits, poses une question utile à chacun et termines par ce qui reste à explorer.", "Une communauté qui se retrouve pour le fond.", "L’animation demande une vraie disponibilité.", "Les récits attirent des lecteurs intéressés par les méthodes et les limites. La conversation devient plus utile, même si certains désaccords restent difficiles à modérer.", "craft", "dialogue", [11, 18, 1, 6, 0, -24]),
      choice("question", "Lancer une grande question du métier", "Tu formules un désaccord concret et invites chacun à expliquer son choix en une réponse.", "Une conversation qui peut dépasser les habitués.", "La simplicité du format favorise aussi les prises de parti.", "La question passe de cercle en cercle. Les lecteurs qui aiment comparer les approches trouvent matière à échanger ; d’autres répondent surtout pour défendre leur camp.", "reach", "dialogue", [15, 25, 12, -2, 0, -19]),
      choice("relay", "Passer le micro à un habitué", "Tu partages un récit avec son accord et ajoutes ce que tu y as trouvé utile.", "Tu entretiens le lien sans porter toute la discussion.", "La visibilité se partage avec la personne mise en avant.", "Le récit trouve un petit public réceptif. Les habitués prennent davantage de place dans les échanges, et tu peux rester présent sans tout animer toi-même.", "care", "community", [1, 4, -10, 3, 0, -6]),
    ],
  },
  {
    id: "x-invitation", platform: "x", arc: "Ce que vaut ta parole", episode: 1,
    character: "Sami · artisan qui aime vérifier", title: "Une invitation à ton nom",
    audience: "Des lecteurs qui s’intéressent à ta façon de travailler",
    body: "Un petit média local prépare un échange sur les ateliers et invite ton compte. Aucune rémunération : seulement une occasion de rencontrer un autre public. Sami lit l’annonce : « Ils veulent un avis. Pas forcément une déclaration de guerre. » Tu dois choisir ce que tu apportes à la discussion.",
    choices: [
      choice("case", "Apporter un cas concret", "Tu prépares une histoire de travail avec une décision difficile, son résultat et ses limites.", "Une intervention utile pour les lecteurs exigeants.", "La préparation dépasse celle d’un simple message.", "Le récit fait découvrir ta façon de réfléchir. Une petite partie du public te suit pour ces exemples, et quelques questions précises prolongent l’échange.", "craft", "craft", [10, 17, 3, 6, 0, -23]),
      choice("position", "Porter une position marquante", "Tu défends un changement que tu souhaites dans le métier, avec une formule faite pour ouvrir le débat.", "Une idée qui peut porter ton nom plus loin.", "On attendra ensuite que tu la défendes publiquement.", "Ta position est reprise au-delà de l’échange. Tu gagnes en visibilité, avec des lecteurs curieux et des opposants qui attendent désormais chacune de tes prises de parole.", "reach", "dialogue", [16, 26, 13, -3, 0, -20]),
      choice("recommend", "Recommander une autre voix", "Tu proposes un artisan pertinent et ajoutes une courte question que tu aimerais voir abordée.", "Un lien utile sans te créer une obligation d’intervention.", "Tu renonces à une grande partie de l’exposition directe.", "Le média accueille ta recommandation. Quelques lecteurs apprécient ton regard sur le métier, mais la conversation place surtout la personne invitée au premier plan.", "care", "community", [0, 3, -9, 3, 0, -6]),
    ],
  },
  {
    id: "x-brief", platform: "x", arc: "Ce que vaut ta parole", episode: 2,
    character: "Sami · artisan qui aime vérifier", title: "L’avis qu’on te prête",
    audience: "Des nouveaux lecteurs qui connaissent surtout une citation",
    body: "Un résumé de l’échange circule. Une phrase ressemble à ton avis, mais elle laisse beaucoup de place aux raccourcis. Sami t’envoie le lien : « Ça se corrige. Pas besoin d’y déménager. » Tu peux expliquer ton cadre, publier une réponse très visible ou faire une précision brève.",
    followups: [
      { fromScenarioId: "x-invitation", fromChoiceId: "case", body: "Le résumé du média a transformé ton exemple de travail en recommandation générale. Sami t’envoie la phrase : « Tu avais justement dit que ça dépendait du contexte. » Tes notes permettent d’expliquer la différence ; une réponse courte pourrait aussi la rendre visible.", choiceModifiers: { framework: growth(4, 7, { energy: 4 }), correction: { trust: 2 } } },
      { fromScenarioId: "x-invitation", fromChoiceId: "position", body: "Ta position marquante a été résumée en une formule encore plus tranchée. Des comptes te demandent de la défendre telle quelle. Sami propose de remettre ton idée à sa juste place. L’attention est réelle ; elle ne t’oblige pas à endosser chaque raccourci.", choiceModifiers: { response: growth(5, 8, { haters: 4 }), framework: { trust: 3, energy: -2 } } },
      { fromScenarioId: "x-invitation", fromChoiceId: "recommend", body: "Le résumé cite ta recommandation comme si tu partageais tous les avis de la personne invitée. Sami te montre le passage : « Présenter quelqu’un, ce n’est pas signer ses phrases. » Tu peux préciser ton geste sans ouvrir une nouvelle affaire.", choiceModifiers: { correction: growth(2, 4, { trust: 2 }), response: { haters: 3 } } },
    ],
    choices: [
      choice("response", "Faire une réponse qui se retient", "Tu reformules publiquement ton idée en une phrase nette, puis indiques le contexte à consulter.", "Une correction qui peut atteindre les lecteurs du résumé.", "Le débat reprend et la pression remonte.", "La réponse circule avec le résumé et redonne de la place à ton point de vue. Elle attire aussi des comptes qui préfèrent prolonger l’affrontement.", "reach", "dialogue", [15, 25, 12, -2, 0, -19]),
      choice("correction", "Préciser le point, puis refermer", "Une réponse courte identifie le raccourci, sans commenter chaque réaction.", "Une limite claire à faible coût d’attention.", "La précision voyagera moins que le message d’origine.", "Les lecteurs proches du fil voient la précision. Elle réduit la confusion sans reprendre toute l’attention disponible, et la pression sur ton compte baisse.", "care", "dialogue", [0, 3, -10, 3, 0, -6]),
      choice("framework", "Expliquer quand ton avis s’applique", "Tu prépares un exemple et un contre-exemple, puis résumes la différence entre les deux.", "Les lecteurs comprennent ton raisonnement.", "Un texte exigeant à préparer et à lire.", "L’explication attire les lecteurs qui veulent comprendre la nuance. Elle fait moins de bruit qu’une formule, mais renforce la confiance dans ta parole.", "craft", "craft", [10, 17, 2, 6, 0, -23]),
    ],
  },
  {
    id: "x-line", platform: "x", arc: "Ce que vaut ta parole", episode: 3,
    character: "Noé · habitué des longues discussions", title: "Choisir pourquoi on te suit",
    audience: "Des lecteurs qui commencent à associer ton nom à une manière de parler",
    body: "Noé te demande quel genre de rendez-vous tu veux installer : des idées qui font réagir, des récits qui font comprendre ou une conversation qu’on a envie de retrouver. « Les trois existent. Mais ton téléphone n’a que vingt-quatre heures par jour. Toi aussi, d’ailleurs. »",
    followups: [
      { fromScenarioId: "x-brief", fromChoiceId: "response", body: "Ta réponse mémorable a ramené des regards, et certains attendent déjà le prochain désaccord. Noé te propose de choisir un rendez-vous qui reste à ta mesure. Continuer les opinions profiterait de cette attente ; un retour d’expérience commencerait à la déplacer.", choiceModifiers: { column: growth(5, 8, { haters: 3 }), notebook: { trust: 3, energy: -2 }, circles: { haters: -3 } } },
      { fromScenarioId: "x-brief", fromChoiceId: "framework", body: "Ton exemple et ton contre-exemple ont donné aux lecteurs une raison de revenir pour ton raisonnement. Noé y voit le début d’un rendez-vous. « Une bonne habitude n’a pas besoin d’être une permanence. » Tu peux approfondir cette ligne ou tenter un format plus large.", choiceModifiers: { notebook: growth(4, 7, { energy: 4 }), circles: { trust: 2 } } },
      { fromScenarioId: "x-brief", fromChoiceId: "correction", body: "Ta précision a fermé le sujet sans rallumer toute la discussion. Noé te propose maintenant un rendez-vous choisi : une réflexion, un cas d’atelier ou un relais de communauté. « On peut avoir une voix sans avoir un mégaphone allumé en permanence. »", choiceModifiers: { circles: growth(2, 4, { haters: -3 }), notebook: { energy: 2 } } },
    ],
    choices: [
      choice("circles", "Un relais entre habitués", "Tu proposes de partager à tour de rôle une découverte, avec un bref mot sur ce qu’elle vous apporte.", "Une communauté qui ne repose pas sur ta présence constante.", "Une croissance lente et une lumière partagée.", "Les habitués trouvent une place à prendre dans le compte. Ils peuvent échanger entre eux, et le fil devient plus respirable sans grande poussée de visibilité.", "care", "community", [1, 4, -11, 3, 0, -6]),
      choice("column", "Une opinion pour ouvrir la semaine", "Tu publies une position argumentée en quelques lignes, avec une question ouverte pour les lecteurs.", "Un rendez-vous facile à reconnaître et à relayer.", "La notoriété vient avec davantage de contradiction hostile.", "L’opinion donne un rendez-vous aux lecteurs qui aiment confronter les idées. Le compte gagne en visibilité, tandis que certains viennent surtout chercher le prochain conflit.", "reach", "dialogue", [16, 26, 13, -3, 0, -20]),
      choice("notebook", "Une page de carnet d’atelier", "Tu choisis un cas concret et expliques ce qu’il t’a appris, sans promettre de réponse universelle.", "Une parole de métier que les lecteurs peuvent suivre.", "Chaque publication exige un vrai travail de préparation.", "Le carnet attire des lecteurs qui reviennent pour tes exemples. La confiance progresse avec cette continuité, au prix d’un effort régulier de rédaction.", "craft", "craft", [11, 18, 3, 6, 0, -24]),
    ],
  },
];

const legacyExpansion = [...KQ_SOCIAL_INSTAGRAM_EXPANSION, ...KQ_SOCIAL_X_EXPANSION];
/** Immutable old prose is retained only for restoring saved lesson commands. */
export const KQ_SOCIAL_LEGACY_SCENARIOS: KqSocialScenario[] = [...KQ_SOCIAL_ORIGINAL_SCENARIOS, ...legacyExpansion.map(content => content.scenario)];
export const KQ_SOCIAL_V2_CONTENT = KQ_SOCIAL_LEGACY_SCENARIOS.map(applyKqSocialNarrative);
export const KQ_SOCIAL_V2_SCENARIOS = KQ_SOCIAL_V2_CONTENT.map(content => content.scenario);
// Kept for old receipt renderers; V3 publications use the producer registry.
export const KQ_SOCIAL_CONTENT = KQ_SOCIAL_V2_CONTENT;
export const KQ_SOCIAL_EXPANSION = KQ_SOCIAL_CONTENT.slice(KQ_SOCIAL_ORIGINAL_SCENARIOS.length);
export const KQ_SOCIAL_SCENARIOS: KqSocialScenario[] = KQ_SOCIAL_LEGACY_SCENARIOS.map(applyKqSocialProducerNarrative);

export const KQ_SOCIAL_SPONSORS: KqSocialSponsorDefinition[] = [
  {
    id: "atelier-marne", name: "Atelier Marne", contact: "Lila · céramique locale", platform: "instagram",
    minimumFollowers: 75, minimumTrust: 45, maxHaters: 65, maxModeration: 3, rewardCents: 3_000,
    brief: "Soutenir ton journal de producteur : une publication visuelle autour du travail indoor, puis un échange avec ta communauté. Tu gardes tes sujets et ton avis. Chaque publication porte la mention « Partenariat rémunéré ».",
    requiredTags: ["visual", "community"], publicationBudget: 4,
    tradeoff: "Deux publications partenaires à réaliser parmi tes quatre prochaines publications Instagram. Elles occupent ton fil et coûtent de l’énergie ; la prime est versée après les deux livrables.",
    completionText: "Lila a reçu les deux publications annoncées. Le partenariat avec Atelier Marne est terminé et la prime convenue rejoint ta trésorerie de jeu.",
  },
  {
    id: "carnet-brut", name: "Carnet Brut", contact: "Anouk · carnets et papeterie", platform: "x",
    minimumFollowers: 200, minimumTrust: 60, maxHaters: 50, maxModeration: 5, rewardCents: 6_000,
    brief: "Financer deux pages de ton carnet de producteur : une explication de métier, puis une discussion avec les lecteurs. Tu peux raconter un doute ou un raté sans le maquiller. Chaque publication porte la mention « Partenariat rémunéré ».",
    requiredTags: ["craft", "dialogue"], publicationBudget: 4,
    tradeoff: "Deux publications partenaires parmi tes quatre prochaines publications X. La marque cherche une parole crédible ; préparer les deux formats demande une vraie disponibilité mentale.",
    completionText: "Anouk valide le récit d’usage et l’échange sur les notes. Les deux engagements envers Carnet Brut sont remplis ; la prime convenue rejoint ta trésorerie de jeu.",
  },
  {
    id: "planche-pixel", name: "Planche & Pixel", contact: "Lou · décors photo d’atelier", platform: "instagram",
    minimumFollowers: 500, minimumTrust: 75, maxHaters: 55, maxModeration: 2, rewardCents: 10_000,
    brief: "Soutenir une série sur les coulisses de la production : une publication visuelle, puis une explication du travail. Les outils, les notes et les gestes ont leur place ; aucun résultat parfait à promettre. Chaque publication porte la mention « Partenariat rémunéré ».",
    requiredTags: ["visual", "craft"], publicationBudget: 4,
    tradeoff: "Deux publications partenaires parmi tes quatre prochaines publications Instagram. Un brief visuel précis et une place commerciale visible dans ton fil, contre une prime après livraison.",
    completionText: "Lou reçoit le visuel et le récit de préparation. Planche & Pixel clôt le partenariat ; la prime convenue rejoint ta trésorerie de jeu.",
  },
  {
    id: "decibel-club", name: "Décibel Club", contact: "Romy · vêtements d’ateliers et de concerts", platform: "x",
    minimumFollowers: 1_000, minimumTrust: 45, maxHaters: 70, maxModeration: 5, rewardCents: 18_000,
    brief: "Donner de la place au quotidien des producteurs : une publication pour ta communauté, puis un échange sur le métier. La marque soutient la série sans dicter tes prises de position sur le CBD. Chaque publication porte la mention « Partenariat rémunéré ».",
    requiredTags: ["community", "dialogue"], publicationBudget: 4,
    tradeoff: "Deux publications partenaires parmi tes quatre prochaines publications X. Une marque très visible attire aussi des lecteurs éloignés de ton métier ; garde de l’énergie pour la discussion.",
    completionText: "Romy confirme les deux publications convenues. La campagne Décibel Club est terminée et la prime convenue rejoint ta trésorerie de jeu.",
  },
];
