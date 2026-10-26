import { createDebateCatalog, choice, reply, ignore, type DraftChoice } from "./kanab-quest-social-debate-builder";
import type { KqSocialContentPerson } from "./kanab-quest-social-content";
import type { KqSocialProducerNarrative } from "./kanab-quest-social-producer-types";
import type { KqSocialPlatform } from "./kanab-quest-social-types";

type Voice = [KqSocialContentPerson, string];
type Replies = Record<"sharp" | "explain" | "ignore", DraftChoice>;
type SecondReplies = Record<"challenge" | "document" | "refocus", DraftChoice>;
type SecondBranch = { body: string; lead: string };
type GrowerArc = {
  id: string; platform: KqSocialPlatform; arc: string; audience: string;
  opening: { title: string; body: string; choices: Record<string, DraftChoice> };
  response: { title: string; body: string; character: string; contexts: Record<string, string>; choices: Replies };
  second: { title: string; body: string; character: string; choices: SecondReplies; branches: Record<keyof Replies, SecondBranch> };
};

const { add, replyBranches, scenarios, narratives } = createDebateCatalog();

/** One authored post, then two independent comments under that same post. */
function conversation(item: GrowerArc) {
  const openingId = `${item.id}-post`, responseId = `${item.id}-reply`;
  const shared = { requirement: "general" as const, arc: item.arc, audience: item.audience };
  add(openingId, item.platform, 1, { ...shared, ...item.opening, image: "workshop", character: "Ta publication du jour" });
  add(responseId, item.platform, 2, { ...shared, title: item.response.title, body: item.response.body,
    character: item.response.character, image: "community", choices: item.response.choices,
    replyTo: { scenarioId: openingId, commentIndex: 0 }, continuations: replyBranches(openingId, item.response.contexts),
  }, openingId);
  const continuations: NonNullable<KqSocialProducerNarrative["continuations"]> = Object.fromEntries(
    Object.entries(item.second.branches).map(([previousChoice, branch]) => [previousChoice, {
      body: branch.body,
      choices: Object.fromEntries(Object.entries(item.second.choices).map(([id, selected]) => [id,
        selected.action === "ignore" ? { post: "", replies: [] } : { post: `${branch.lead} ${selected.post}` },
      ])),
    }]),
  );
  add(`${item.id}-second`, item.platform, 3, { ...shared, title: item.second.title, body: item.second.body,
    character: item.second.character, image: "community", choices: item.second.choices, continuations,
    replyTo: { scenarioId: openingId, commentIndex: 1 },
  }, responseId);
}

const deliveryQuestion: Voice = ["ines", "Et si mon colis arrive écrasé, je fais quoi sans passer ma soirée à me battre avec le vendeur et le transporteur ?"];
conversation({
  id: "ig-debate-shipping", platform: "instagram", arc: "Le colis, ce n’est pas juste un numéro", audience: "Acheteurs à distance, boutiques et producteurs",
  opening: {
    title: "Quand le sachet arrive au bout du voyage",
    body: "Tu veux parler de ce qui se passe entre l’expédition et l’ouverture du colis. Les clients ont parfois vécu un renvoi de responsabilité entre vendeur et transporteur. Tu prends position sur cette relation, sans prétendre qu’une commande précise vient de mal arriver chez toi.",
    choices: {
      explain: choice("Parler du suivi après l’envoi", "Tu expliques pourquoi l’expérience du client ne s’arrête pas au dépôt du colis.", "craft",
        "“C’est parti, voyez avec le transporteur.” Cette phrase me gêne quand elle sert à fermer la porte. Un client attend un produit, pas un numéro de suivi à contempler. L’emballage, les informations utiles et une réponse quand quelque chose se passe mal font aussi partie du boulot.",
        "Des lecteurs racontent leurs expériences d’achat. Max soupçonne une promesse commerciale creuse ; Inès demande surtout comment signaler un colis abîmé.",
        ["skeptic", "Le discours est joli. Jusqu’au premier colis écrasé, où ça devient mystérieusement la faute du client."], deliveryQuestion),
      jab: choice("Piquer les vendeurs qui disparaissent", "Tu dénonces les réponses qui renvoient automatiquement le problème au client.", "reach",
        "Ultra disponible pour encaisser, porté disparu dès qu’un colis fait une mauvaise rencontre : ce service client-là me fatigue. Une fleur a beau avoir une belle photo, si l’acheteur reçoit un souci et un silence, c’est le silence qu’il retiendra.",
        "La pique circule et des clients déçus s’en mêlent. Certains attendent maintenant de voir si ta propre pratique sera à la hauteur de ce ton.",
        ["skeptic", "Le sauveur du SAV vient d’arriver. On reparle de ton discours quand ça te coûtera de l’argent ?"], deliveryQuestion),
      simple: choice("Inviter les retours sans procès", "Tu invites à décrire ce qui arrive, sans promettre de régler tous les dossiers en commentaire.", "care",
        "Un achat qui se passe mal, ça mérite qu’on l’écoute. Si vous parlez d’un colis abîmé, dites ce qui est arrivé au colis et au produit. On peut chercher à comprendre avant de distribuer les étiquettes “arnaqueur” et “client menteur”.",
        "Le ton ouvre un échange calme. Max soupçonne déjà que la demande de détails servira à ne rien faire.",
        ["skeptic", "Traduction : trois formulaires, douze photos et à la fin personne ne rembourse."], deliveryQuestion),
    },
  },
  response: {
    title: "La méfiance arrive avant le colis", character: "Max · @max.sansfiltre",
    body: "Max imagine déjà une mauvaise prise en charge. Il ne présente pas de commande à examiner, mais plusieurs lecteurs reconnaissent la fatigue qu’il exprime derrière sa pique.",
    contexts: { explain: "Tu parlais du suivi ; il te prête déjà le réflexe de mettre le client en cause.", jab: "Ta pique contre d’autres vendeurs te revient comme une promesse qu’il faudrait prouver.", simple: "Tu demandais une description utile ; il y voit une course d’obstacles destinée à décourager les gens." },
    choices: {
      sharp: reply("Lui renvoyer son procès d’intention", "Tu te moques du verdict qu’il prononce avant de connaître un dossier.", "reach",
        "Tu as déjà imaginé le colis, le refus et le verdict sans présenter le moindre dossier ici. Impressionnant, ce SAV par voyance. Une question sur ma façon de faire, oui. Une mauvaise expérience inventée à l’avance pour gagner ton commentaire, on va s’en passer.",
        "La réplique amuse des habitués. Max se braque, et certains clients comprennent que parler d’un souci pourrait tourner à l’affrontement.",
        ["skeptic", "Si c’est comme ça que tu réponds avant même un problème, ça donne envie."], ["sam", "Il te prête un dossier qui n’existe pas, mais la vanne ne rassure pas les clients qui lisent."]),
      explain: reply("Séparer le dossier de la méfiance", "Tu reconnais les mauvaises expériences sans accepter une accusation présentée comme un fait.", "craft",
        "Si tu as déjà été baladé, je comprends la méfiance. Là, on n’a pas de commande précise à regarder. Demander ce qui est arrivé doit aider à traiter le problème, pas à épuiser le client. Et annoncer une solution avant d’avoir compris le dossier, ça peut être une autre façon de raconter n’importe quoi.",
        "Des lecteurs distinguent mieux la demande d’informations et le refus d’aider. Max attend toujours de juger sur des actes.",
        ["skeptic", "D’accord, mais les demandes de pièces qui n’en finissent pas, ça existe."], ["sam", "Oui. Demander le nécessaire d’un coup évite de transformer le client en secrétaire du litige."]),
      ignore: ignore("Tu laisses la pique de Max sans réponse. Aucun dossier n’est ouvert ni refusé ; sa méfiance reste visible sous le post."),
    },
  },
  second: {
    title: "Inès veut savoir par où commencer", character: "Inès · @ines_du_quartier",
    body: "Le deuxième commentaire sous le même post pose une question pratique sur un colis écrasé. Il n’annonce pas une commande réelle à rembourser : Inès veut comprendre comment le contact pourrait se passer.",
    choices: {
      challenge: reply("Lui dire de réclamer une vraie réponse", "Tu défends le client avec une formule ferme, mais peu de détails pratiques.", "reach",
        "Tu ne devrais pas avoir à jouer au ping-pong entre deux interlocuteurs. Tu signales clairement ce que tu as reçu et tu demandes une réponse sur la suite. Faire disparaître le client derrière un numéro de suivi, ce n’est pas du service.",
        "Inès apprécie la fermeté, mais attend encore un chemin concret. Des lecteurs prennent la formule comme une promesse très large.",
        ["ines", "D’accord sur le principe. Mais j’envoie quoi et à qui, concrètement ?"], ["sam", "La formule est bonne. Derrière, il faut un interlocuteur et un suivi, sinon ça reste une formule."]),
      document: reply("Donner un point de départ simple", "Tu proposes des informations utiles et un contact direct, sans décider d’un remboursement imaginaire.", "craft",
        "Garde l’emballage et prends des photos du colis et du produit reçu, puis contacte le vendeur avec la référence de commande et ce qui est abîmé. Évite de publier tes coordonnées dans le fil. L’idée, c’est qu’il comprenne le problème et te dise la suite, sans te demander une pièce différente chaque soir.",
        "Inès sait mieux comment préparer son message. Cela ne préjuge pas de la solution d’un dossier réel, et Sami rappelle que la réponse devra suivre.",
        ["ines", "Ça me paraît faisable. Ce que je redoute, c’est surtout de devoir recommencer mon histoire à chaque message."], ["sam", "Une fois les éléments reçus, il faut une réponse suivie. La liste de photos ne fait pas le travail à elle seule."]),
      refocus: ignore("Tu laisses la question d’Inès sans réponse. Rien n’est promis ni remboursé ; elle reste sans indication supplémentaire de ta part."),
    },
    branches: {
      sharp: { body: "Ta vanne sur le SAV par voyance a braqué Max. Inès avait posé une autre question sous le post : comment signaler un colis abîmé. Tu peux lui répondre sans la traiter comme si elle poursuivait la provocation.", lead: "Ma pique précédente n’était pas une réponse à ta question, Inès." },
      explain: { body: "Tu as expliqué à Max pourquoi il fallait distinguer une mauvaise expérience générale d’un dossier précis. Inès attend maintenant le point de départ concret que cette explication laissait ouvert.", lead: "Pour ta question concrète, Inès :" },
      ignore: { body: "Tu n’as pas répondu à Max. La question d’Inès reste elle aussi sous ton post ; tu peux choisir de répondre à cette personne plutôt qu’au provocateur, sans publier un nouveau post.", lead: "Je n’ai pas répondu à la pique au-dessus ; je réponds à ta question, Inès." },
    },
  },
});

const humidityQuestion: Voice = ["visitor", "Entre une fleur qui s’émiette et une fleur trop humide, comment on parle du problème sans que le vendeur réponde juste “c’est normal” ?"];
conversation({
  id: "ig-debate-humidity", platform: "instagram", arc: "Sèche, souple ou simplement décevante ?", audience: "Amateurs de fleurs et acheteurs déçus par une texture",
  opening: {
    title: "La texture, ça compte aussi",
    body: "Tu prépares un post sur ce qu’un client découvre à l’ouverture d’un sachet. Les préférences de texture varient, mais elles ne doivent pas servir à balayer toute réclamation. Tu ne diagnostiques aucun produit à partir d’une photo.",
    choices: {
      explain: choice("Faire une place aux descriptions précises", "Tu distingues préférence personnelle et observation utile sur le produit.", "craft",
        "“Trop sec”, ça peut raconter plusieurs expériences : une texture qui ne plaît pas, une fleur qui part en poussière, un sachet conservé autrement après ouverture. La réponse ne devrait pas être “tu n’y connais rien”. Décrire ce qu’on constate, c’est déjà plus utile que se battre sur le mot parfait.",
        "Des lecteurs cherchent les bons mots pour parler de texture. Max accuse d’avance les producteurs de masquer les défauts.",
        ["skeptic", "Du foin qui part en poudre et vous appelez ça un curing de connaisseur. Toujours une histoire."], humidityQuestion),
      jab: choice("Piquer le discours qui excuse tout", "Tu refuses que le vocabulaire professionnel serve à invalider l’expérience du client.", "reach",
        "Un client dit “ça s’émiette” et on lui répond “tu ne comprends pas l’affinage”. Ça suffit, le vocabulaire chic pour fermer une discussion. On peut expliquer son travail sans faire passer chaque déception pour un défaut d’éducation du client.",
        "La critique parle aux clients éconduits. Des professionnels trouvent que tu simplifies les échanges pour faire une bonne phrase.",
        ["skeptic", "Vous vous couvrez tous. Trop sec c’est affiné, trop humide c’est frais, et c’est toujours le client qui a tort."], humidityQuestion),
      simple: choice("Reconnaître qu’on n’aime pas tous pareil", "Tu laisses de la place aux préférences sans leur faire expliquer tous les défauts.", "care",
        "On ne cherche pas tous la même texture dans une fleur. Mais “chacun ses goûts” ne suffit pas à répondre à quelqu’un qui trouve son produit abîmé. On peut entendre une déception sans inventer une guerre entre amateurs et débutants.",
        "Quelques lecteurs partagent leurs préférences. Max y voit une excuse supplémentaire pour tout vendre.",
        ["skeptic", "Pratique, les goûts : même le sachet en miettes finit par devenir une expérience personnelle."], humidityQuestion),
    },
  },
  response: {
    title: "Le mot “affinage” est devenu suspect", character: "Max · @max.sansfiltre",
    body: "Max généralise une déception à tout le métier. Sa provocation n’efface pas la vraie question : comment répondre quand le produit reçu ne correspond pas à ce que la personne attendait ?",
    contexts: { explain: "Tu demandais des observations ; il entend surtout un vocabulaire destiné à faire accepter une fleur trop sèche.", jab: "Tu critiquais déjà les excuses automatiques, mais il te range dans le groupe que tu dénonçais.", simple: "Tu laissais de la place aux préférences sans nier les défauts. Il ne retient que la première moitié." },
    choices: {
      sharp: reply("Se moquer du verdict automatique", "Tu retournes sa généralisation contre lui, au prix d’un échange plus tendu.", "reach",
        "Tu viens de découvrir le contrôle qualité universel : pas besoin de voir le produit, “vous êtes tous pareils” suffit. C’est rapide, j’admets. Pour comprendre une vraie déception, c’est nettement moins pratique.",
        "Le sarcasme attire l’attention mais donne à Max une nouvelle raison de parler d’arrogance. Des lecteurs déçus se demandent s’ils sont aussi visés.",
        ["skeptic", "Vous avez surtout toujours une vanne quand ça parle de qualité."], ["jade", "Il généralise. Mais des clients lisent ça avec une vraie mauvaise expérience en tête."]),
      explain: reply("Reconnaître le problème sans conclure à distance", "Tu ne laisses ni un terme technique ni une accusation générale tenir lieu d’examen.", "craft",
        "Un mot comme affinage ne fait pas disparaître une fleur qui déçoit. Je suis d’accord là-dessus. Pour comprendre ce qui est arrivé, il faut décrire le produit et sa conservation, pas conclure que tous les sachets se valent. Demander ces détails ne devrait jamais servir à déclarer le client coupable d’avance.",
        "La distinction laisse de la place à la réclamation. Max reste méfiant envers les demandes sur la conservation, qu’il a déjà vues servir d’excuse.",
        ["skeptic", "Tant que “comment vous l’avez conservé” n’est pas la formule magique pour tout refuser."], ["jade", "C’est la différence entre chercher une cause et chercher quelqu’un à blâmer."]),
      ignore: ignore("Tu ne réponds pas à Max. Son accusation reste dans le fil et tu n’as pas précisé comment accueillir une déception sur la texture."),
    },
  },
  second: {
    title: "Lou veut des mots qui ne ferment pas la porte", character: "Lou · @lou.decouvre",
    body: "Lou a posé une question sur la manière de décrire une fleur trop sèche ou trop humide. Ce deuxième commentaire attend toujours sous ton post, quelle que soit ta réponse à Max.",
    choices: {
      challenge: reply("Refuser le “c’est normal” automatique", "Tu défends le droit d’insister quand une explication ne répond pas au constat.", "reach",
        "“C’est normal” n’est pas une réponse magique. Si tu décris ce qui te gêne, le vendeur doit au moins parler de ce point-là au lieu de t’expliquer que tu es trop novice. Le diplôme d’amateur n’est pas requis pour dire qu’un achat déçoit.",
        "Lou se sent davantage autorisé à parler. Des professionnels trouvent la formule caricaturale et la discussion repart sur la manière de répondre.",
        ["visitor", "C’est surtout ça : je ne veux pas me faire faire un examen de connaissances."], ["sam", "Oui, mais un constat peut aussi avoir une explication que le client ne connaît pas encore."]),
      document: reply("Partir de ce qui est observable", "Tu proposes une description utile sans transformer les commentaires en diagnostic.", "craft",
        "Dis ce que tu observes : ça s’émiette à l’ouverture, ça colle autrement que prévu, l’aspect ou l’odeur te paraît inhabituel. Ajoute quand tu l’as ouvert et comment c’était conservé. Ces détails servent à discuter du même produit, pas à prouver que tu mérites une réponse. Une photo ou un mot dans un fil ne suffit pas à trancher tout le reste.",
        "Lou dispose de mots plus précis. La réponse demande du temps et n’offre pas le verdict immédiat que certains lecteurs espéraient.",
        ["visitor", "Ça m’aide à raconter ce qui me gêne sans commencer par “votre truc est nul”."], ["sam", "Et au vendeur de répondre à ces observations, pas de recopier sa fiche produit."]),
      refocus: ignore("Tu laisses la question de Lou en attente. Aucun conseil, examen de produit ou promesse de remplacement n’est ajouté au fil."),
    },
    branches: {
      sharp: { body: "Ta moquerie envers Max a tendu la discussion. Lou ne réclame pas un duel : sa question portait sur les mots à utiliser pour décrire un vrai problème. Tu peux changer de ton avec cette personne.", lead: "Lou, ta question est plus précise que la dispute au-dessus." },
      explain: { body: "Tu as expliqué que demander des détails ne devait pas servir à blâmer le client. Lou attend maintenant de savoir quels détails aideraient vraiment.", lead: "Voilà ce que j’entends par décrire le problème, Lou :" },
      ignore: { body: "Tu n’as pas répondu à Max. La question pratique de Lou est toujours là ; répondre à ce commentaire serait ton premier message dans la discussion.", lead: "Je laisse la provocation de côté et je prends ta question, Lou." },
    },
  },
});

const aromaQuestion: Voice = ["ines", "Si je n’aime pas les odeurs très sucrées, je peux le dire sans passer pour quelqu’un qui ne reconnaît pas une bonne fleur ?"];
conversation({
  id: "ig-debate-aromas", platform: "instagram", arc: "La fleur ne se résume pas à son pourcentage", audience: "Amateurs d’arômes et lecteurs habitués aux classements",
  opening: {
    title: "On parle du nez ou on compte les points ?",
    body: "Tu veux sortir du classement permanent par chiffre et parler de ce qu’une description aromatique peut apporter. Tu peux défendre cet intérêt sans attribuer des arômes ou une composition mesurée à un lot que le jeu ne te décrit pas.",
    choices: {
      explain: choice("Distinguer arômes et course au chiffre", "Tu parles de préférences et de descriptions sans promettre des effets liés à un parfum.", "craft",
        "Une fleur ne se raconte pas seulement avec le chiffre le plus gros de la fiche. L’odeur, l’aspect, ce qu’on aime ou pas : ça mérite aussi des mots. Une description d’arômes n’est pas une promesse d’effet. Et le parfum préféré du voisin n’a pas à devenir le vôtre.",
        "Des lecteurs ouvrent le sujet des préférences. Max traite le vocabulaire aromatique de décoration commerciale.",
        ["skeptic", "Encore des terpènes pour faire oublier que votre CBD ne fait rien. Vous vendez du vocabulaire maintenant ?"], aromaQuestion),
      jab: choice("Chambrer le concours de pourcentages", "Tu critiques la réduction de la qualité au plus gros nombre affiché.", "reach",
        "À force de ne regarder que le plus gros pourcentage, on finit par acheter une calculette avec des fleurs autour. J’aimerais qu’on reparle aussi du produit et des goûts. Le podium des chiffres n’a pas le monopole de la conversation.",
        "La formule plaît à des amateurs lassés des classements. D’autres y voient une manière de détourner l’attention d’informations mesurables.",
        ["skeptic", "C’est pratique de critiquer les chiffres quand on n’a que des histoires de citron et de forêt à vendre."], aromaQuestion),
      simple: choice("Assumer un goût sans classement", "Tu invites les préférences sans désigner un arôme supérieur.", "care",
        "On peut aimer une odeur terreuse et ne rien vouloir de très sucré. Ou l’inverse. Je préfère savoir ce qui plaît à quelqu’un que lui imposer le parfum supposé haut de gamme du moment. Le bon goût obligatoire, ça m’ennuie.",
        "Les préférences s’expriment sans compétition. Max y voit une excuse pour rendre toutes les descriptions impossibles à discuter.",
        ["skeptic", "Le marketing parfait : si ça plaît pas, c’est le goût du client. Impossible de perdre."], aromaQuestion),
    },
  },
  response: {
    title: "“Les terpènes, c’est du baratin”", character: "Max · @max.sansfiltre",
    body: "Max se méfie des descriptions qui sonnent comme de la publicité. Sa critique du vocabulaire peut être utile ; son raccourci ne permet pas de conclure que tout ce qui ne se chiffre pas est inventé.",
    contexts: { explain: "Tu séparais justement description et promesse d’effet ; il les remet dans le même sac.", jab: "Ta calculette a fait rire, mais elle lui donne l’occasion de présenter les mots comme une esquive des chiffres.", simple: "Tu défendais la liberté de goût ; il y voit une manière de ne jamais entendre une déception." },
    choices: {
      sharp: reply("Se moquer de son détecteur à baratin", "Tu joues la répartie au lieu d’ouvrir la critique du vocabulaire.", "reach",
        "Ton détecteur à baratin se déclenche dès qu’on parle de goût. Pratique : plus besoin de lire la description pour savoir qu’elle est mauvaise. On peut critiquer les grandes phrases du marketing sans décider que toutes les préférences sortent du même service publicité.",
        "La plaisanterie circule, mais Max s’accroche au ton. Des lecteurs qui se méfient des descriptions se sentent aussi un peu pris de haut.",
        ["skeptic", "Et voilà, encore le client trop bête pour comprendre votre poésie."], ["sam", "Les descriptions gonflées existent. On gagnerait à entendre ce point sans se moquer."]),
      explain: reply("Admettre que les mots peuvent être gonflés", "Tu distingues une description sensorielle d’une preuve ou d’une promesse d’effet.", "craft",
        "Oui, certains descriptifs en font des tonnes. Un “dessert tropical” recopié partout ne m’aide pas davantage que toi. Mais on peut parler honnêtement d’une odeur sans lui coller un effet garanti. Les chiffres répondent à certaines questions ; ils ne décident pas de ce que chacun aime sentir.",
        "Les lecteurs comprennent mieux l’utilité et les limites des descriptions. Max attend encore des mots plus concrets sur chaque offre.",
        ["skeptic", "Alors commencez par arrêter les quinze parfums dans une seule phrase."], ["sam", "Une description courte, précise et discutable, ça me paraît plus utile qu’un menu de pâtisserie."]),
      ignore: ignore("Tu ne réponds pas à Max. La suspicion de vocabulaire commercial reste visible, sans précision supplémentaire sur ta manière de décrire une fleur."),
    },
  },
  second: {
    title: "Le goût d’Inès n’a pas à passer un examen", character: "Inès · @ines_du_quartier",
    body: "Inès a demandé si son rejet des odeurs très sucrées la disqualifiait comme amatrice. Elle attend une réponse sous le même post, distincte de la discussion sur les chiffres.",
    choices: {
      challenge: reply("Défendre son goût franchement", "Tu refuses les classements de personnes autant que les classements de parfums.", "reach",
        "Bien sûr que tu peux le dire. Le jury international de l’odeur à la mode ne viendra pas retirer ta carte d’amatrice. Si quelqu’un doit t’expliquer que tu es obligée d’aimer, on a déjà quitté la conversation sur tes goûts.",
        "Inès apprécie la réponse. La plaisanterie attire aussi une petite bataille entre amateurs de profils sucrés et lecteurs qui s’en moquent.",
        ["ines", "Très bien, je rends mon dessert imaginaire sans rendre ma carte alors."], ["jade", "Et ceux qui aiment les profils sucrés n’ont pas besoin de passer pour des victimes du marketing non plus."]),
      document: reply("Distinguer préférence et jugement de qualité", "Tu lui donnes une façon de dire ce qu’elle cherche sans décréter le reste mauvais.", "craft",
        "Oui. “Ce profil sucré ne me plaît pas” décrit ton goût ; ça ne dit pas automatiquement que le produit est mal travaillé. Tu peux demander une description moins sucrée, plus terreuse ou végétale, si ce sont tes repères. Et tu peux toujours être déçue : personne ne doit aimer sur commande.",
        "Inès peut préciser sa recherche sans rabaisser les autres goûts. La discussion devient utile, même si les mots ne transmettent pas une odeur à travers l’écran.",
        ["ines", "C’est cette différence qu’il me fallait : je peux ne pas aimer sans annoncer que tout est mauvais."], ["sam", "Et on peut demander au vendeur ce qu’il entend par ses mots, parce qu’on n’a pas tous les mêmes repères."]),
      refocus: ignore("Tu laisses la question d’Inès sans réponse. Le fil n’ajoute ni classement de goûts ni explication sur ce qu’elle peut demander."),
    },
    branches: {
      sharp: { body: "Ta plaisanterie sur le détecteur à baratin a braqué Max. Inès, elle, demande le droit de ne pas aimer un profil : lui répondre avec la même condescendance contredirait ton post.", lead: "Inès, je ne veux pas transformer ma vanne d’au-dessus en concours de connaisseurs." },
      explain: { body: "Tu as reconnu le vocabulaire exagéré et séparé description, chiffres et goûts. La question d’Inès permet de rendre cette différence concrète.", lead: "Sur ta préférence, Inès, voilà ce que je veux dire :" },
      ignore: { body: "Tu n’as pas répondu à la provocation de Max. Inès attend toujours ; tu peux choisir de lui parler sans revenir sur le duel proposé.", lead: "Je n’ai pas répondu au commentaire précédent. Pour ton goût, Inès :" },
    },
  },
});

const smallQuestion: Voice = ["visitor", "Moi les petites fleurs m’arrangent si c’est moins cher. Comment savoir si on parle du calibre ou d’un tri de qualité inférieure ?"];
conversation({
  id: "ig-debate-smallbuds", platform: "instagram", arc: "Petites fleurs, grandes étiquettes", audience: "Acheteurs attentifs au budget et amateurs de beaux calibres",
  opening: {
    title: "La petite fleur n’est pas un gros mot",
    body: "Tu veux parler des petits calibres, souvent comparés à des restes ou présentés comme une affaire universelle. Tu peux défendre une description honnête sans déclarer que tous les petits et gros calibres sont identiques.",
    choices: {
      explain: choice("Séparer calibre et état du produit", "Tu distingues taille, présentation et qualité sans promettre une équivalence automatique.", "craft",
        "Une petite fleur, c’est d’abord un calibre. Ça ne raconte pas à lui seul l’état du produit, son tri ou son intérêt pour quelqu’un. Une grosse tête peut séduire à l’œil ; une petite peut convenir très bien. Ce qui m’agace, c’est de remplacer la description par “premium” ou “déchet”.",
        "Des lecteurs distinguent mieux la taille et les autres critères. Max réduit les petits calibres à des restes rebaptisés.",
        ["skeptic", "Les fonds de sac ont enfin un service marketing. Small buds, c’est plus chic que miettes."], smallQuestion),
      jab: choice("Se moquer du concours de taille", "Tu attaques la hiérarchie visuelle, avec le risque de nier l’intérêt de la présentation.", "reach",
        "À croire qu’une fleur gagne automatiquement du talent en prenant de la place sur la photo. Les beaux calibres ont leurs amateurs, très bien. Mais le concours de taille ne devrait pas remplacer tout ce qu’on peut demander sur un produit.",
        "La formule attire des réactions. Les amateurs de grosses fleurs se sentent parfois visés, et Max doute de la manière de valoriser les petites.",
        ["skeptic", "Quand on ne sort pas de belles têtes, on explique que les petites sont mieux. Classique."], smallQuestion),
      simple: choice("Laisser chacun choisir son format", "Tu reconnais les préférences de budget et de présentation sans dévaloriser un camp.", "care",
        "Si quelqu’un aime les grosses fleurs pour la présentation, je comprends. Si quelqu’un préfère des petites fleurs clairement décrites et un prix qui lui convient, je comprends aussi. Pas besoin de lui faire sentir qu’il achète le rang d’en dessous.",
        "Le message laisse de la place aux petits budgets. Max soupçonne une façon élégante de vendre les écarts de tri.",
        ["skeptic", "Du moment qu’on arrive à vendre les restes, tout le monde a soudain “ses préférences”."], smallQuestion),
    },
  },
  response: {
    title: "“Les restes ont un nouveau nom”", character: "Max · @max.sansfiltre",
    body: "Max assimile petite fleur, miettes et mauvais tri. Il soulève la question de la description commerciale, mais transforme des catégories différentes en un seul verdict.",
    contexts: { explain: "Tu distinguais justement calibre et état ; il remet les deux dans le même sac.", jab: "Ta pique sur la taille est lue comme une justification de ce que tu serais incapable de produire.", simple: "Tu parlais de choix et de budget ; il n’y voit qu’une manière de valoriser des restes." },
    choices: {
      sharp: reply("Lui rendre son raccourci", "Tu tournes sa classification expéditive en ridicule.", "reach",
        "Tu ranges toutes les petites fleurs dans la case “ce qu’on n’a pas su faire autrement”, et tu appelles ça une démonstration. À cette vitesse, une cerise devient une pomme ratée. On peut demander un tri clair sans inventer une hiérarchie magique par centimètre.",
        "La comparaison se partage. Max réplique sur ton ton, tandis que Lou attend toujours une manière de comparer les offres.",
        ["skeptic", "La comparaison avec les fruits, magnifique. Toujours aucune photo de ce que les gens reçoivent."], ["sam", "Une photo représentative et un nom de catégorie clair répondraient mieux à la question."]),
      explain: reply("Reconnaître que le nom ne suffit pas", "Tu distingues le calibre d’autres catégories et refuses d’excuser une présentation trompeuse.", "craft",
        "Si une offre dit petites fleurs et montre autre chose que ce qu’on reçoit, le nom ne l’excuse pas. Mais petite fleur ne veut pas automatiquement dire miettes ou produit abîmé. Il faut décrire le tri, l’aspect et la quantité proposés. Le mot anglais ne doit ni embellir ni condamner le contenu à lui seul.",
        "Les catégories deviennent plus lisibles. Max garde son exigence d’images représentatives ; tu ne l’as pas remplacée par un slogan favorable aux petits calibres.",
        ["skeptic", "Alors il faut montrer le sachet réel, pas la plus belle petite tête du bac."], ["sam", "Sur une image représentative, on peut se rejoindre."]),
      ignore: ignore("Tu laisses le commentaire de Max visible sans réponse. Les catégories restent confondues dans sa formule et tu gardes ton énergie."),
    },
  },
  second: {
    title: "Lou veut savoir ce qu’il paie", character: "Lou · @lou.decouvre",
    body: "Lou a posé une question de budget et de catégorie sous le post. Il n’attend pas qu’on gagne la dispute : il veut pouvoir comparer ce qui est réellement proposé.",
    choices: {
      challenge: reply("Exiger une étiquette qui dit les choses", "Tu défends une présentation franche avec une réponse courte et tranchante.", "reach",
        "Demande qu’on l’écrive clairement. Si une offre passe son temps à suggérer “pareil mais moins cher” sans dire ce qu’elle contient, le problème est dans la description. Les clients n’ont pas à jouer aux devinettes pour respecter leur budget.",
        "Lou apprécie la défense de son budget. La réponse provoque des réactions sur les fiches commerciales, mais apporte peu de critères supplémentaires.",
        ["visitor", "C’est surtout le “pareil” que je veux pouvoir vérifier."], ["jade", "Oui, et la comparaison doit porter sur une offre précise, pas sur tous les petits calibres à la fois."]),
      document: reply("Proposer les questions de comparaison", "Tu fais préciser calibre, état, tri et image sans garantir qu’un nom annonce tout.", "craft",
        "Demande si le prix correspond seulement au calibre, à un autre tri, ou à une différence d’état annoncée. Regarde si l’image représente la catégorie vendue et ce que la description précise sur le contenu. “Small buds” tout seul ne répond pas à tout. Tu peux chercher moins cher et demander ces infos sans avoir à t’excuser.",
        "Lou repart avec des questions précises. La réponse ne tranche pas à la place d’un vendeur sur une offre absente du fil.",
        ["visitor", "Ça me donne autre chose à comparer que la taille sur la photo et le prix barré."], ["sam", "Et il faut que la fiche réponde, pas que chaque client recommence une enquête."]),
      refocus: ignore("Tu ne réponds pas au second commentaire. Lou conserve sa question sur la différence entre calibre et tri ; aucune équivalence de qualité n’est promise."),
    },
    branches: {
      sharp: { body: "Ta comparaison avec les fruits a fait réagir Max, sans aider Lou à distinguer calibre et tri. Sa question est encore là sous ton post ; elle ne mérite pas d’être noyée dans le duel.", lead: "Lou, je laisse ma comparaison avec les fruits de côté pour te répondre." },
      explain: { body: "Tu as distingué petite fleur et contenu trompeur. Lou demande maintenant comment utiliser cette distinction quand le prix l’intéresse.", lead: "Pour ton choix d’achat, Lou :" },
      ignore: { body: "Tu n’as pas répondu à Max. Tu peux prendre la question de Lou séparément, ou laisser aussi ce deuxième commentaire sans réponse.", lead: "Je n’ai pas répondu à Max ; je prends ta question sur le calibre, Lou." },
    },
  },
});

const photoQuestion: Voice = ["mila", "Une photo fidèle, ça ne veut pas dire une photo ratée. Où tu mets la limite entre bien éclairer et changer ce que le client croit voir ?"];
conversation({
  id: "ig-debate-photo", platform: "instagram", arc: "La lumière ne doit pas refaire le produit", audience: "Acheteurs sur photo, photographes et producteurs",
  opening: {
    title: "Belle photo, mauvais rendez-vous ?",
    body: "Tu prépares un post sur la présentation des fleurs en ligne. Une image peut être soignée sans être trompeuse ; les écrans, la lumière et le choix du sujet rendent la fidélité plus compliquée qu’un simple mot “sans filtre”.",
    choices: {
      explain: choice("Parler de représentation fidèle", "Tu distingues une image lisible et une promesse visuelle excessive.", "craft",
        "Bien éclairer une fleur, c’est normal. Lui inventer une couleur ou ne montrer qu’un exemplaire exceptionnel pour représenter tout un lot, c’est une autre histoire. “Sans filtre” ne dit pas tout : le cadrage et le choix de ce qu’on montre comptent aussi.",
        "Le post ouvre une discussion sur les attentes créées par l’image. Max transforme la réserve en aveu que toutes les photos seraient trompeuses.",
        ["skeptic", "Enfin vous avouez que vos photos sont bidonnées. En vrai on reçoit toujours autre chose."], photoQuestion),
      jab: choice("Piquer les fleurs de studio impossibles", "Tu te moques des images qui semblent promettre plus que le produit.", "reach",
        "Certaines photos de fleurs ont plus de travail sur la saturation que sur la légende. C’est magnifique, mais si le produit doit ensuite s’excuser de ne pas ressembler au poster, on a raté quelque chose. Le client achète une fleur, pas un préréglage photo.",
        "La formule amuse et circule. Des lecteurs regardent maintenant tes propres images avec une exigence accrue.",
        ["skeptic", "Le producteur qui découvre les filtres chez les autres. Chez toi c’est forcément la lumière naturelle du talent ?"], photoQuestion),
      simple: choice("Dire ce qu’une image ne montre pas", "Tu gardes une place pour les questions qui dépassent le visuel.", "care",
        "Une photo peut donner envie. Elle ne transmet ni l’odeur ni la texture dans la main, et elle ne raconte pas tout ce qu’il y a dans un sachet. J’aime les belles images ; j’aime aussi qu’on puisse poser les questions qui restent après.",
        "La limite paraît raisonnable à des lecteurs. Max y voit déjà une excuse préparée pour une future déception.",
        ["skeptic", "Comme ça, si ça n’a rien à voir à l’arrivée, c’est la faute de l’écran. Bien joué."], photoQuestion),
    },
  },
  response: {
    title: "Le procès du filtre commence", character: "Max · @max.sansfiltre",
    body: "Max transforme la discussion sur les images en accusation générale. Mila pose au même endroit une vraie question de métier : comment montrer correctement sans fabriquer une attente impossible ?",
    contexts: { explain: "Tu distinguais éclairage et altération ; il résume le post à un aveu de trucage.", jab: "Ta critique des images trop saturées lui donne envie de retourner le soupçon sur toi.", simple: "Tu évoquais les limites du support ; il y voit une excuse prête à servir." },
    choices: {
      sharp: reply("Le chambrer sur son enquête instantanée", "Tu réponds à la généralisation par une attaque sur sa façon de lire.", "reach",
        "Enquête bouclée en un commentaire, bravo. À partir d’un post sur la photo, tu as déjà ton soupçon prêt à servir. Avec cette méthode, parler des limites d’une image devient suspect en soi. Très pratique pour ne jamais écouter la suite.",
        "La réponse déclenche un duel sur les intentions. Max parle d’esquive et les questions de photo passent au second plan.",
        ["skeptic", "Ça fait beaucoup de texte pour ne pas montrer la différence entre la photo et le sachet."], ["mila", "On peut peut-être revenir à ce qu’une image doit permettre de comprendre."]),
      explain: reply("Reconnaître le risque sans avouer un faux", "Tu distingues une accusation sur un achat précis d’une discussion de représentation.", "craft",
        "Parler d’une photo trompeuse ne prouve pas que toutes le sont. Si quelqu’un constate un écart sur un achat précis, ça mérite une comparaison précise. Et “c’est ton écran” ne devrait pas servir à évacuer automatiquement le problème. La fidélité se travaille ; elle ne se décrète pas avec une mention sans filtre.",
        "La discussion peut revenir aux critères de représentation. Max reste méfiant et demande des exemples comparables.",
        ["skeptic", "Alors il faut aussi des vues normales, pas seulement le gros plan parfait."], ["mila", "Plusieurs vues peuvent raconter ce qu’un seul cadrage laisse hors champ."]),
      ignore: ignore("Tu ne réponds pas à Max. Son accusation reste sous la publication ; tu n’as ni reconnu un trucage ni donné de précision sur ta manière de photographier."),
    },
  },
  second: {
    title: "Mila défend aussi le droit à une belle image", character: "Mila · @mila.cadre",
    body: "La deuxième intervention sous ton post vient de Mila. Elle refuse l’alternative entre photo bâclée et image trompeuse ; sa question permet de revenir au travail concret.",
    choices: {
      challenge: reply("Tracer une limite nette", "Tu opposes embellissement du cadre et transformation du produit, avec une formule forte.", "reach",
        "Je veux qu’on soigne la lumière, pas qu’on repeigne la réalité. Une belle mise en scène peut donner envie ; elle ne devrait pas fabriquer une couleur ou une attente que le produit ne peut pas tenir. Si le sachet doit s’excuser devant la photo, le studio a pris trop de place.",
        "La formule se retient. Mila rappelle que la limite demande aussi des choix concrets, pas uniquement une bonne intention.",
        ["mila", "D’accord, mais “repeindre la réalité” se discute : balance des blancs, éclairage, sélection du sujet…"], ["visitor", "En tant que client, je veux surtout comprendre ce que je vais recevoir au-delà de la photo vedette."]),
      document: reply("Parler des choix de prise de vue", "Tu proposes des vues et informations complémentaires sans prétendre annuler toute variation d’écran.", "craft",
        "Pour moi : une lumière qui rend les détails lisibles, une couleur qu’on ne pousse pas juste pour impressionner, et un sujet représentatif de ce qu’on décrit. Une vue plus large à côté du gros plan aide aussi. Et si la photo montre un exemple particulier, le dire compte autant que le réglage de l’appareil.",
        "Mila peut discuter de choix précis. Les lecteurs disposent de critères supplémentaires, tout en gardant le droit de signaler un écart sur une offre réelle.",
        ["mila", "Oui : le choix de la fleur photographiée est déjà un choix de présentation, avant toute retouche."], ["visitor", "La vue large et l’exemple clairement annoncé, ça me parlerait davantage qu’un badge sans filtre."]),
      refocus: ignore("Tu laisses la question de Mila sans réponse. Aucun engagement technique ni nouvelle photo n’est annoncé ; sa distinction reste ouverte dans le fil."),
    },
    branches: {
      sharp: { body: "Ta réponse à Max a lancé un duel sur son enquête instantanée. Mila demande de revenir à l’image ; tu peux répondre à cette question sans traiter son désaccord comme une attaque.", lead: "Mila, ta question mérite mieux que mon échange de piques au-dessus." },
      explain: { body: "Tu as refusé l’excuse automatique de l’écran et le verdict automatique de trucage. Mila te demande ce que cela change au moment de faire une photo.", lead: "Sur le travail de photo lui-même, Mila :" },
      ignore: { body: "Tu n’as pas répondu à Max. Mila a déjà posé sa question sous le post ; tu peux intervenir maintenant sur ce point de métier, ou garder le silence.", lead: "Je n’ai pas répondu à Max, mais ta question sur la photo m’intéresse, Mila." },
    },
  },
});

const energyQuestion: Voice = ["jade", "On peut aimer le travail indoor et demander où réduire l’énergie. Qu’est-ce que tu accepterais de remettre en question sans te sentir attaqué ?"];
conversation({
  id: "x-debate-powerbill", platform: "x", arc: "L’indoor face à la facture et au climat", audience: "Producteurs indoor, amateurs et lecteurs préoccupés par l’énergie",
  opening: {
    title: "La prise électrique fait partie du métier",
    body: "Tu veux parler de l’énergie utilisée par la culture indoor. Le jeu ne fournit pas ici de bilan énergétique : tu peux discuter des choix et des questions à poser sans annoncer une économie ou un impact chiffré.",
    choices: {
      explain: choice("Reconnaître la question de l’énergie", "Tu acceptes le sujet sans prétendre qu’une méthode annule tout impact.", "craft",
        "L’indoor demande de parler de lumière, de ventilation et de conditions de culture. Donc d’énergie. Dire “j’aime ce travail” ne ferme pas la question. Je préfère qu’on discute des choix et de ce qu’on peut améliorer plutôt que coller un mot vert sur une installation et passer à autre chose.",
        "Des lecteurs apprécient l’ouverture. Max estime que la discussion sert surtout à rendre une activité énergivore plus acceptable.",
        ["skeptic", "De l’écologie sous des lampes. Il fallait oser. Le soleil vous a bloqués sur les réseaux ?"], energyQuestion),
      jab: choice("Refuser le verdict en une vanne", "Tu contestes les procès expéditifs tout en gardant la question énergétique ouverte.", "reach",
        "“Il suffit de mettre ça dehors.” Merci pour l’étude complète, on peut fermer les carnets. L’énergie est un vrai sujet de l’indoor ; justement, ça mérite mieux qu’une vanne qui prétend répondre à toutes les contraintes et tous les choix à la fois.",
        "Le ton mobilise des producteurs agacés. Les lecteurs qui posent une question environnementale légitime se demandent s’ils sont aussi visés.",
        ["skeptic", "Vos contraintes ont surtout bon dos pour brancher des lampes et raconter que c’est responsable."], energyQuestion),
      simple: choice("Dire que la question reste ouverte", "Tu reconnais une tension sans chercher à la résoudre par une étiquette.", "care",
        "Je travaille dans un univers que j’aime, et je peux entendre qu’on en questionne l’énergie. Je ne vais pas répondre “tout va bien” juste parce que la question dérange. J’aimerais qu’on puisse en parler sans faire semblant qu’un camp n’a jamais rien à apprendre.",
        "Le message ouvre peu de fronts. Max demande aussitôt si cette ouverture changera quoi que ce soit.",
        ["skeptic", "En gros : tu entends, tu comprends, et tu continues pareil. De la communication verte sans effort."], energyQuestion),
    },
  },
  response: {
    title: "La facture se transforme en procès", character: "Max · @max.sansfiltre",
    body: "Max soupçonne ton discours de servir surtout à justifier l’indoor. Derrière la moquerie, il y a une question que ton métier ne suffit pas à écarter : quelles décisions changent réellement l’usage d’énergie ?",
    contexts: { explain: "Tu voulais ouvrir la discussion ; il y voit déjà une justification écologique.", jab: "Ta propre moquerie a durci l’échange avant même qu’on parle de choix concrets.", simple: "Tu reconnaissais une tension ; il exige désormais que cette reconnaissance mène à autre chose que des mots." },
    choices: {
      sharp: reply("Lui retourner son verdict minute", "Tu moques la simplicité de sa réponse au risque de paraître éviter le fond.", "reach",
        "On cherchait justement un spécialiste capable de juger une activité entière avant d’avoir posé une question. Le poste est pour toi, visiblement. Si tu veux parler énergie, parlons-en. Si tu veux seulement savourer ta vanne, je pense qu’on a tous compris.",
        "La réplique se partage chez des producteurs. Max répond sur ton mépris, et Jade attend toujours une discussion sur les décisions possibles.",
        ["skeptic", "Quand on touche à votre facture, ça devient vite personnel."], ["noe", "Ta vanne ne dit toujours pas quelles questions tu accepterais de regarder."]),
      explain: reply("Reconnaître la critique sans vendre une vertu", "Tu laisses la question énergétique ouverte et refuses de présenter une préférence comme un bilan.", "craft",
        "L’énergie compte, oui. Et dire qu’il existe des contraintes indoor n’efface pas cette question. Pour comparer ou améliorer, il faut regarder les usages, les équipements et ce qu’on mesure réellement. Je ne vais pas transformer mon attachement au métier en certificat écologique. Ta vanne ne fait pas non plus cette comparaison à notre place.",
        "Des lecteurs voient une discussion possible. Max reste sceptique tant qu’aucune décision concrète n’est présentée.",
        ["skeptic", "Très bien. Maintenant il faut autre chose que “c’est complexe”."], ["noe", "Accepter la mesure avant la grande conclusion, c’est déjà une base de travail."]),
      ignore: ignore("Tu ne réponds pas à Max. La moquerie reste visible et aucune amélioration énergétique n’est annoncée."),
    },
  },
  second: {
    title: "Jade demande ce qui peut réellement bouger", character: "Jade · @jade.culture",
    body: "Jade a posé une question différente sous le même post : quels choix peut-on examiner sans considérer chaque remise en question comme une attaque contre le métier ?",
    choices: {
      challenge: reply("Accepter le débat sans accepter tous les slogans", "Tu poses une limite ferme, avec le risque de rester davantage sur le ton que sur les choix.", "reach",
        "Je peux remettre en question des habitudes et des équipements. Je ne suis pas marié à chaque bouton de mon installation. Ce que je refuse, c’est qu’on remplace l’examen d’un choix par “ton métier est absurde, fin du débat”. On peut demander mieux sans commencer par humilier.",
        "Jade entend l’ouverture mais attend encore une méthode. Le ton ferme entretient une partie de la polarisation.",
        ["jade", "D’accord. Reste à choisir un usage à regarder, sinon on revient toujours au débat sur le débat."], ["skeptic", "Vous êtes très forts pour expliquer comment on a le droit de vous poser la question."]),
      document: reply("Proposer de regarder un usage à la fois", "Tu parles de démarche et de critères sans annoncer de gain déjà réalisé.", "craft",
        "Je commencerais par distinguer les usages au lieu de parler d’une facture comme d’un bloc : lumière, ventilation, gestion des conditions. Puis regarder ce qui tourne, pourquoi, et ce qu’un changement implique pour la culture. Une piste n’est pas encore une économie prouvée. Je préfère expliquer une décision mesurée que promettre une installation miraculeuse.",
        "La conversation devient plus concrète. Jade rappelle qu’il faudra ensuite des données ; aucune économie n’est attribuée à ton exploitation par ce commentaire.",
        ["jade", "Voilà une façon de poser le travail. Ensuite on pourra discuter des observations, même si elles ne racontent pas l’histoire qu’on espérait."], ["noe", "Et accepter qu’une piste ne fonctionne pas fait aussi partie de l’examen."]),
      refocus: ignore("Tu laisses la question de Jade sans réponse. Le fil ne contient aucune décision supplémentaire ni amélioration annoncée."),
    },
    branches: {
      sharp: { body: "Ta réponse sur le spécialiste du verdict minute a fait monter le ton. Jade n’avait pas demandé une nouvelle vanne : sa question sur les habitudes et les équipements reste ouverte.", lead: "Jade, je laisse ma pique d’au-dessus de côté pour te répondre." },
      explain: { body: "Tu as reconnu que l’attachement au métier n’était pas un bilan énergétique. Jade demande maintenant par quels choix commencer la discussion.", lead: "Sur ce que je suis prêt à examiner, Jade :" },
      ignore: { body: "Tu n’as pas répondu à Max. Jade a posé un autre commentaire sous ton post ; tu peux choisir cette conversation sans rouvrir le duel.", lead: "Je n’ai pas répondu à Max. Ta question est celle que j’ai envie de prendre, Jade." },
    },
  },
});

const setbackQuestion: Voice = ["noe", "Quand on partage un problème en cours, comment éviter que les conseils arrivent tous en même temps et qu’on finisse par tout changer ?"];
conversation({
  id: "x-debate-setbacks", platform: "x", arc: "Montrer un souci sans fabriquer un spectacle", audience: "Producteurs, débutants et lecteurs des carnets de culture",
  opening: {
    title: "Le fil parfait fatigue aussi",
    body: "Tu prépares une réflexion sur la manière de raconter les difficultés de culture. Il ne s’agit pas d’annoncer un problème réel sur tes plantes : tu choisis la place que les questions, les hésitations et les essais devraient avoir dans un compte de producteur.",
    choices: {
      explain: choice("Défendre les observations honnêtes", "Tu sépares ce qui est observé, ce qui est supposé et ce qui reste à vérifier.", "craft",
        "Un carnet de culture utile peut contenir “je ne sais pas encore”. On peut décrire ce qu’on observe, expliquer une piste et revenir sur ce qu’elle donne. Le compte où tout était prévu et tout réussit du premier coup, ça me fait surtout demander ce qui est resté hors champ.",
        "Des lecteurs reconnaissent les limites des récits trop parfaits. Max confond l’aveu d’incertitude avec l’incompétence.",
        ["skeptic", "Un producteur qui ne sait pas, ça s’appelle un amateur. On paie pour le produit, pas pour vos essais."], setbackQuestion),
      jab: choice("Piquer les experts qui ne ratent jamais", "Tu critiques le personnage infaillible que les réseaux encouragent.", "reach",
        "Sur les réseaux, certaines plantes n’ont jamais un souci et certains experts n’ont jamais eu tort. Quelle chance. Moi, ce qui m’intéresse dans un récit, c’est aussi la décision difficile et ce qu’on a compris après, pas seulement la photo où tout le monde avait raison depuis le début.",
        "La pique fait réagir des producteurs. Max te renvoie l’image du débutant qui utiliserait l’honnêteté comme excuse.",
        ["skeptic", "Préparer le public à vos ratés, c’est malin. Le manque de compétence devient de l’authenticité."], setbackQuestion),
      simple: choice("Laisser une place aux questions", "Tu défends un rythme de récit qui ne transforme pas chaque doute en urgence publique.", "care",
        "On peut poser une question de culture sans annoncer une catastrophe. On peut aussi attendre d’avoir compris avant de publier. J’aimerais qu’on laisse aux producteurs le droit d’apprendre sans leur réclamer soit une réussite parfaite, soit un naufrage en direct.",
        "Le ton convient aux lecteurs fatigués des dramatisations. Max assimile quand même apprentissage et amateurisme.",
        ["skeptic", "Le droit d’apprendre, oui. Faire passer ça pour un métier maîtrisé, c’est une autre histoire."], setbackQuestion),
    },
  },
  response: {
    title: "L’incertitude n’est pas un aveu d’abandon", character: "Max · @max.sansfiltre",
    body: "Max attaque l’idée même de dire “je ne sais pas encore”. Aucun échec de culture n’a été annoncé dans ton post ; le débat porte sur la manière de raconter un travail réel et ses limites.",
    contexts: { explain: "Tu séparais observation et hypothèse ; il y voit la preuve d’un métier mal maîtrisé.", jab: "Ta critique de l’expert infaillible lui donne envie de te ranger parmi ceux qui excusent leurs erreurs.", simple: "Tu demandais le droit de poser des questions ; il en fait un conflit entre apprentissage et professionnalisme." },
    choices: {
      sharp: reply("Lui renvoyer son expert infaillible", "Tu te moques de l’exigence de certitude absolue.", "reach",
        "Tu as donc trouvé le métier où poser une question retire toutes les compétences acquises. Fascinant. L’expert qui sait tout avant d’avoir regardé, on le trouve surtout dans les commentaires. Ça ne rend pas son produit meilleur.",
        "La réplique attire des soutiens. Max se sent visé et la conversation dérive vers qui a le droit de parler du métier.",
        ["skeptic", "Toujours un moyen de regarder de haut celui qui demande de la compétence."], ["jade", "On peut demander de la rigueur sans exiger que personne ne doute jamais."]),
      explain: reply("Distinguer doute et absence de rigueur", "Tu défends l’apprentissage tout en maintenant l’exigence sur le travail.", "craft",
        "On peut exiger du sérieux. Mais le sérieux, c’est aussi savoir ce qu’on n’a pas encore établi et ne pas vendre une hypothèse comme un diagnostic. Dire qu’on examine un problème n’efface pas les compétences ; prétendre avoir tout compris pour sauver son image n’en ajoute aucune.",
        "La distinction convainc certains lecteurs. Max conserve son exigence de résultats et de responsabilité vis-à-vis des clients.",
        ["skeptic", "Tant que le client ne devient pas celui qui paie pour toutes les erreurs."], ["jade", "Le récit honnête ne remplace pas les exigences sur le produit. Les deux sujets peuvent tenir ensemble."]),
      ignore: ignore("Tu ne réponds pas à Max. Aucun problème de culture personnel n’est annoncé ni résolu ; sa définition de la compétence reste dans le fil."),
    },
  },
  second: {
    title: "Noé veut éviter la culture pilotée par les commentaires", character: "Noé · @noe.cultive",
    body: "Noé a posé une question pratique sur la foule de conseils contradictoires. Elle reste sous le même post et ne demande ni diagnostic ni intervention sur une plante précise.",
    choices: {
      challenge: reply("Refuser le pilotage par acclamation", "Tu rappelles que la décision ne se prend pas au nombre de commentaires.", "reach",
        "Le commentaire le plus sûr de lui n’a pas automatiquement raison. Et dix personnes qui proposent dix changements ne deviennent pas un protocole. Le producteur garde la main ; sinon on finit avec une plante conduite par un sondage et personne pour expliquer ce qui a changé.",
        "La formule plaît, mais certains lecteurs se sentent renvoyés dans les cordes alors qu’ils voulaient aider.",
        ["noe", "Oui, c’est exactement la tentation du sondage que je veux éviter."], ["visitor", "On peut quand même proposer une piste sans essayer de prendre le contrôle."]),
      document: reply("Poser un cadre à la demande de conseils", "Tu proposes de préciser la question et de séparer les pistes des actions décidées.", "craft",
        "Je préciserais ce qui est observé, ce qui a déjà changé et la question à laquelle je cherche une réponse. Les idées reçues restent des pistes, pas des ordres à appliquer toutes ensemble. Puis je dirais quelle décision est retenue et pourquoi. Ça permet aussi de revenir sur la suite sans réécrire l’histoire après coup.",
        "Noé dispose d’un cadre pour discuter sans empiler toutes les suggestions. Cela demande de documenter et ne garantit pas que les commentaires resteront calmes.",
        ["noe", "Annoncer la question et la décision retenue, ça évite déjà de donner l’impression que tout conseil a été suivi."], ["jade", "Et quand on ne suit pas une piste, on peut l’expliquer sans ridiculiser celui qui l’a proposée."]),
      refocus: ignore("Tu ne réponds pas au second commentaire. Noé ne reçoit aucune méthode supplémentaire et aucune action de culture n’est déclenchée."),
    },
    branches: {
      sharp: { body: "Ta pique sur l’expert des commentaires a tendu le fil. Noé ne demande pas qu’on juge les lecteurs : il veut savoir comment accueillir des pistes sans perdre le fil des décisions.", lead: "Noé, ta question ne se résume pas à ma pique sur les experts du fil." },
      explain: { body: "Tu as défendu la différence entre une hypothèse et un diagnostic. La question de Noé permet d’expliquer comment garder cette différence quand plusieurs personnes conseillent en même temps.", lead: "Pour garder cette rigueur dans les commentaires, Noé :" },
      ignore: { body: "Tu n’as pas répondu à Max. Noé a posé une autre question sous le même post ; tu peux lui répondre sans entrer dans le procès de compétence.", lead: "Je n’ai pas répondu à Max. Sur ta question, Noé :" },
    },
  },
});

const originQuestion: Voice = ["sam", "Je vends plusieurs origines. Est-ce qu’on peut soutenir les producteurs français sans faire passer chaque produit importé pour une arnaque ?"];
conversation({
  id: "x-debate-imports", platform: "x", arc: "Défendre le local sans vendre un drapeau", audience: "Chanvriers français, revendeurs et clients comparant les origines",
  opening: {
    title: "Le drapeau ne cultive pas à la place des gens",
    body: "Tu veux parler de la place des producteurs français face aux importations. Ton post peut défendre une filière et demander une origine lisible sans attribuer une provenance précise à tes lots ni dénigrer des personnes selon leur pays.",
    choices: {
      explain: choice("Séparer origine et qualité automatique", "Tu défends une information utile sans transformer un pays en note de qualité.", "craft",
        "Soutenir les chanvriers français, ça peut avoir du sens. Mais un drapeau n’explique ni le travail ni la qualité d’un produit. Je veux qu’on sache où c’est cultivé, par qui, et qui revend. Valoriser une filière n’oblige pas à raconter que tout ce qui vient d’ailleurs est mauvais.",
        "La distinction parle aux lecteurs qui veulent choisir une origine. Max accuse les producteurs de se servir du drapeau pour éviter la concurrence.",
        ["skeptic", "Le patriotisme du sachet quand on n’arrive pas à tenir les prix. C’est beau comme une marge."], originQuestion),
      jab: choice("Refuser la filière française en décor", "Tu critiques les présentations qui empruntent l’image du chanvrier sans expliquer l’origine.", "reach",
        "Le portrait du chanvrier et le drapeau en grand, puis plus personne pour dire d’où vient le contenu : ça m’agace. Défendre les producteurs français, ce n’est pas louer leur image pour habiller une fiche produit. Qu’on explique qui cultive et qui revend, sans théâtre.",
        "La formule circule entre producteurs. Certains lecteurs l’entendent comme une accusation générale envers les importations.",
        ["skeptic", "Vous voulez surtout faire peur avec l’importé pour vendre plus cher votre petit roman local."], originQuestion),
      simple: choice("Respecter le choix d’origine du client", "Tu reconnais plusieurs raisons d’acheter sans exiger un serment de soutien.", "care",
        "Un client peut vouloir soutenir une production proche. Un autre compare surtout le prix ou un produit qui lui plaît. Je peux défendre la place des chanvriers français sans demander à chaque acheteur de prouver sa loyauté sous mon compte.",
        "Le ton laisse de la place aux budgets et aux préférences. Max soupçonne encore une communication qui cherche à valoriser artificiellement le local.",
        ["skeptic", "C’est toujours le même emballage : achetez local, comprenez nos prix, applaudissez le producteur."], originQuestion),
    },
  },
  response: {
    title: "Le drapeau devient une accusation de marge", character: "Max · @max.sansfiltre",
    body: "Max transforme ta défense de la lisibilité des origines en demande de préférence automatique. Sami, revendeur, attend aussi de savoir si ton discours lui laisse une place honnête.",
    contexts: { explain: "Tu refusais la qualité automatique par pays ; il te renvoie quand même au patriotisme commercial.", jab: "Ta pique sur les décors commerciaux est lue comme une attaque contre l’importation elle-même.", simple: "Tu avais explicitement laissé le choix aux clients ; il prête malgré tout à ton post un test de loyauté." },
    choices: {
      sharp: reply("Lui renvoyer son obsession du drapeau", "Tu moques son interprétation, avec le risque de fermer aussi les questions sur les prix.", "reach",
        "Soutenir une filière devient automatiquement vendre un drapeau dans ta lecture. À ce niveau, tu pourrais répondre avant de lire, ça irait plus vite. On peut défendre une place pour les chanvriers français sans demander au client de prêter serment au moment de payer.",
        "La répartie trouve des soutiens. Max répond sur ton agacement et le sujet de la filière reste polarisé.",
        ["skeptic", "On connaît le discours. Le prix français reste toujours à justifier au nom de l’effort."], ["ines", "On peut aussi vouloir savoir l’origine sans vouloir prendre un camp."]),
      explain: reply("Rappeler ce que l’origine permet de choisir", "Tu distingues préférence, traçabilité et preuve de qualité.", "craft",
        "L’origine permet de choisir ce qu’on veut soutenir ; elle ne remplace pas les autres informations. Si un produit importé est clairement présenté, il peut être comparé comme les autres. Ce que je critique, c’est l’origine floue ou l’image locale utilisée pour suggérer autre chose que le contenu.",
        "Le désaccord devient plus précis. Max reste critique sur les prix, mais les lecteurs comprennent que l’importation n’est pas assimilée à une fraude.",
        ["skeptic", "Très bien, alors comparez aussi les produits, pas seulement les portraits de producteurs."], ["ines", "Là, je comprends ce qu’on peut demander sans juger tout un pays."]),
      ignore: ignore("Tu ne réponds pas à Max. Le soupçon de patriotisme commercial reste sous le post ; aucune origine n’est ajoutée à tes produits."),
    },
  },
  second: {
    title: "Sami demande une place pour le revendeur honnête", character: "Sami · @sami.cbd",
    body: "Sami a demandé si plusieurs origines pouvaient coexister dans une boutique sans être présentées comme un choix entre honnêteté et arnaque. Ce commentaire reste attaché à ta publication initiale.",
    choices: {
      challenge: reply("Tracer la frontière sur la présentation", "Tu affirmes que le problème vient du flou commercial, avec un ton qui peut encore crisper les vendeurs.", "reach",
        "Oui. Ce n’est pas le passeport du produit qui me dérange, c’est le tour de passe-passe autour. Si c’est importé, que ce soit lisible. Si c’est français, qu’on explique qui a travaillé. Le client n’a pas à décoder une mise en scène pour savoir ce qu’il soutient.",
        "Sami entend la distinction. La formule sur le tour de passe-passe attire aussi des soupçons généraux que ton commentaire cherchait à éviter.",
        ["sam", "D’accord sur la lisibilité. Faisons attention à ne pas laisser entendre que toutes les boutiques cachent quelque chose."], ["visitor", "Je préfère une information claire à un sous-entendu dans la photo."]),
      document: reply("Reconnaître les métiers et les origines", "Tu proposes une présentation qui laisse le client choisir sans hiérarchie automatique.", "craft",
        "Oui, à condition de présenter clairement les origines et les rôles. Une boutique peut sélectionner, stocker, conseiller ; un producteur cultive. Ces métiers peuvent se compléter. Je défends une place pour les chanvriers français, pas l’idée qu’un client tromperait son camp en choisissant une autre origine.",
        "Sami peut se reconnaître dans le propos sans abandonner sa sélection. Certains producteurs restent inquiets de la concurrence sur les prix.",
        ["sam", "Avec cette distinction, on peut parler de sélection et de filière sans transformer mon rayon en tribunal."], ["jade", "Et la question de rémunérer la production locale reste à traiter, même quand l’étiquette est honnête."]),
      refocus: ignore("Tu ne réponds pas à Sami. Sa question sur la coexistence des origines reste ouverte ; aucune boutique n’est accusée ou validée par ce silence."),
    },
    branches: {
      sharp: { body: "Ta remarque sur la lecture de Max a durci le fil. Sami te posait une question de métier, pas la même accusation ; tu peux lui donner une réponse distincte.", lead: "Sami, je sépare ta question de ma dispute avec Max." },
      explain: { body: "Tu as placé le problème dans l’origine floue plutôt que dans l’importation elle-même. Sami te demande comment cette distinction peut s’appliquer à son travail de revendeur.", lead: "Pour une boutique avec plusieurs origines, Sami :" },
      ignore: { body: "Tu n’as pas répondu à Max. Le commentaire de Sami attend toujours sous ton post ; tu peux choisir cet échange professionnel sans prétendre avoir déjà clarifié ta position.", lead: "Je n’ai pas répondu à Max. Je prends ta question sur les boutiques, Sami." },
    },
  },
});

const priceRaceQuestion: Voice = ["jade", "Si chacun baisse pour ne pas perdre la vente, on fait comment pour défendre son prix sans raconter que les clients sont responsables de tous nos problèmes ?"];
conversation({
  id: "x-debate-pricerace", platform: "x", arc: "La course au prix qui mange le métier", audience: "Chanvriers, revendeurs et acheteurs aux budgets différents",
  opening: {
    title: "Toujours moins cher, jusqu’où ?",
    body: "Tu veux parler de la pression des prix entre professionnels. Il ne s’agit pas d’annoncer tes marges ou tes coûts : tu choisis comment défendre le travail sans accuser chaque client de chercher à le détruire.",
    choices: {
      explain: choice("Distinguer comparaison et course à la baisse", "Tu reconnais le besoin de comparer tout en interrogeant ce qui est mis sous pression.", "craft",
        "Comparer les prix, c’est normal. Ce qui m’inquiète, c’est la discussion où chaque effort devient “ailleurs c’est moins cher”, sans regarder ce qu’on compare ni qui absorbe la différence. On peut parler du coût du travail sans réclamer au client un don de soutien à chaque achat.",
        "Des professionnels reconnaissent la pression. Max y voit une plainte destinée à maintenir des prix élevés.",
        ["skeptic", "Bienvenue dans la concurrence. Si vous êtes trop chers, les clients vont ailleurs, pas besoin d’un roman."], priceRaceQuestion),
      jab: choice("Dire que le producteur n’est pas une variable magique", "Tu exprimes le ras-le-bol de la baisse permanente avec un ton offensif.", "reach",
        "On veut du soin, de la disponibilité, des infos, du suivi… et encore un petit effort sur le prix. Le producteur n’est pas une tirelire inversée où l’on appuie pour sortir la même chose moins cher. La course au rabais finit par demander à quelqu’un d’absorber l’écart.",
        "Le post se partage entre professionnels. Des clients modestes le lisent comme un reproche sur leurs moyens.",
        ["skeptic", "Le client devrait payer plus pour que vous n’ayez jamais à vous remettre en question. Beau modèle."], priceRaceQuestion),
      simple: choice("Refuser de culpabiliser les petits budgets", "Tu défends une limite commerciale sans transformer le refus d’achat en manque de respect.", "care",
        "Je peux expliquer un prix et refuser une négociation qui ne me convient pas. Le client peut aussi dire qu’il n’a pas le budget. Ce n’est pas une trahison. J’aimerais qu’on puisse garder ces deux phrases sans finir en “radin” contre “arnaqueur”.",
        "Le ton calme la discussion autour du budget. Max entend tout de même une manière de préparer le terrain pour des tarifs qu’il juge trop hauts.",
        ["skeptic", "Joli emballage pour dire “mes prix ne se discutent pas”. La concurrence, ça vous arrange surtout quand vous gagnez."], priceRaceQuestion),
    },
  },
  response: {
    title: "“C’est la concurrence, débrouillez-vous”", character: "Max · @max.sansfiltre",
    body: "Max présente la concurrence comme une réponse suffisante à toute question sur la rémunération. Tu peux défendre ton travail sans promettre de meilleurs résultats ni expliquer au client comment dépenser son argent.",
    contexts: { explain: "Tu acceptais la comparaison ; il te répond comme si tu voulais la supprimer.", jab: "Ta métaphore de la tirelire a fait réagir, mais elle donne aussi l’impression que le client serait responsable de tout l’écart.", simple: "Tu laissais le droit de refuser l’achat ; il résume la position à un refus de discuter les prix." },
    choices: {
      sharp: reply("Lui renvoyer sa leçon d’économie minute", "Tu moques sa réponse expéditive au risque de donner l’impression de mépriser les acheteurs.", "reach",
        "Merci pour le verdict économique express. En une phrase tu viens de supprimer le besoin de regarder ce qu’on compare et comment on le produit. Quelle économie de temps. Moins sûr que ça fasse une discussion utile à quelqu’un qui veut comprendre le prix.",
        "La réplique est relayée par des professionnels. Max et d’autres lecteurs y voient encore un refus d’entendre la pression du budget.",
        ["skeptic", "Vous adorez parler du travail, beaucoup moins de l’argent des clients."], ["ines", "Je comprends le problème, mais je ne peux toujours pas dépenser plus parce que la réponse est bien tournée."]),
      explain: reply("Maintenir le droit de comparer et de refuser", "Tu refuses la culpabilisation des clients comme la réduction du travail à un prix isolé.", "craft",
        "Le client peut aller ailleurs. Le producteur peut aussi expliquer ce qu’il propose et ne pas accepter tous les prix. La question utile, c’est ce qu’on compare réellement : origine annoncée, quantité, catégorie, service. Si le budget ne suit pas, le débat ne va pas fabriquer de l’argent dans la poche du client.",
        "Des lecteurs trouvent la position plus lisible. Max reste convaincu que le marché décidera, et la pression sur la rémunération ne disparaît pas.",
        ["skeptic", "Très bien, alors chacun assume son choix sans venir pleurer sur celui des autres."], ["ines", "Je peux entendre une explication si on me laisse aussi le droit de ne pas acheter."]),
      ignore: ignore("Tu laisses le commentaire de Max sans réponse. Aucun prix ne change et aucune vente n’est attribuée au silence ; la question de rémunération reste ouverte."),
    },
  },
  second: {
    title: "Jade veut défendre un prix sans désigner un coupable", character: "Jade · @jade.culture",
    body: "Jade a posé une question de positionnement professionnel sous ton post. Elle demande une façon de tenir sa limite sans transformer les clients en ennemis.",
    choices: {
      challenge: reply("Défendre le droit de dire non", "Tu poses une limite commerciale ferme, sans négociation inventée ni modification des tarifs.", "reach",
        "On a le droit de dire “à ce prix, ça ne me convient pas”, même quand on est du côté du vendeur. Pas besoin de traiter le client de radin pour ça. Si chaque discussion finit en obligation de baisser, ce n’est plus une discussion sur la valeur, c’est une usure.",
        "La formule rassure des producteurs. Certains clients craignent qu’elle serve à fermer toute demande d’explication.",
        ["jade", "Dire non sans faire un procès au client, c’est la limite que je cherchais."], ["visitor", "Tant qu’une question sur le prix ne passe pas tout de suite pour une tentative de vous user."]),
      document: reply("Revenir à l’offre et à la limite choisie", "Tu proposes de décrire ce qui est inclus et ce qui ne change pas, sans inventer des coûts personnels.", "craft",
        "Je décrirais ce qui est proposé, ce qui est inclus et la limite à laquelle je ne veux pas aller. Puis je laisserais le client choisir. On peut réfléchir à une autre offre ou à une autre présentation ; on n’est pas obligé de promettre exactement la même chose toujours moins cher. Et la difficulté d’un métier ne devient pas une dette du client.",
        "Jade dispose d’une manière de poser le problème. Cela n’assure ni la vente ni la viabilité d’une offre ; les choix commerciaux restent à faire.",
        ["jade", "Ça permet de parler d’une offre précise, au lieu d’attendre qu’un client comprenne toute la vie de l’exploitation."], ["ines", "L’explication m’intéresse davantage si je ne deviens pas responsable de régler tout le problème."]),
      refocus: ignore("Tu ne réponds pas à Jade. Aucun prix, offre ou engagement commercial n’est modifié ; sa question reste visible sous le post."),
    },
    branches: {
      sharp: { body: "Ta leçon d’économie minute a fait rire des producteurs mais braqué des clients. Jade demande justement comment tenir une limite sans alimenter cette opposition.", lead: "Jade, ma pique précédente montre aussi à quelle vitesse on peut perdre le sujet." },
      explain: { body: "Tu as reconnu le droit du client de partir et celui du producteur de refuser un prix. Jade demande comment exprimer cette limite sans rester dans le principe général.", lead: "Pour défendre cette limite concrètement, Jade :" },
      ignore: { body: "Tu n’as pas répondu à Max. Tu peux choisir la question de Jade pour discuter du métier, sans te justifier auprès du premier commentaire.", lead: "Je n’ai pas répondu à Max. Ta question sur la manière de tenir son prix m’intéresse, Jade." },
    },
  },
});

const geneticsQuestion: Voice = ["visitor", "Quand deux boutiques utilisent le même nom de variété, je peux m’attendre à retrouver la même chose ou c’est juste un repère très large ?"];
conversation({
  id: "x-debate-genetics", platform: "x", arc: "Le nom de variété ne fait pas tout le travail", audience: "Clients qui suivent des noms de variétés et producteurs",
  opening: {
    title: "Un nom célèbre, et derrière ?",
    body: "Tu veux parler des noms de variétés et de ce qu’ils laissent imaginer. Tu ne connais pas ici la généalogie de chaque produit du marché ; ton post peut demander des informations sans inventer une origine génétique à tes propres fleurs.",
    choices: {
      explain: choice("Distinguer le nom et la description", "Tu expliques pourquoi un nom ne répond pas à toutes les questions sur une offre.", "craft",
        "Un nom de variété peut être un repère. Il ne raconte pas à lui seul qui a produit, comment le lot se présente ni ce que la personne va apprécier. J’aime qu’on puisse demander ce qu’il y a derrière le nom, sans recevoir en réponse une légende de trois pages et aucune information sur le produit.",
        "Des lecteurs veulent comprendre les écarts entre offres portant le même nom. Max affirme que tout le vocabulaire génétique serait inventé.",
        ["skeptic", "Vos noms sont tous bidons. Vous renommez la même fleur selon ce qui marche sur Instagram."], geneticsQuestion),
      jab: choice("Piquer les noms qui font tout le spectacle", "Tu critiques les références prestigieuses utilisées à la place d’une description.", "reach",
        "Certains noms de fleurs ont un arbre généalogique plus prestigieux qu’une famille royale. C’est formidable. Maintenant, qui l’a produite, qu’est-ce qu’on vend et qu’est-ce qu’on sait vraiment de cette origine ? Le nom ne devrait pas faire tout le boulot pendant que la fiche produit se repose.",
        "La formule amuse les lecteurs lassés du folklore. Elle pousse aussi certains à conclure que toute dénomination est mensongère.",
        ["skeptic", "Enfin quelqu’un avoue que vos génétiques, c’est du cinéma pour augmenter le prix."], geneticsQuestion),
      simple: choice("Accepter la question derrière le nom", "Tu invites à demander des précisions sans donner au client un examen de génétique.", "care",
        "Vous pouvez demander ce que signifie un nom de variété sur une offre. Ce n’est pas une question bête. Tout le monde n’a pas envie de mémoriser cinquante croisements supposés avant d’acheter, et le vendeur devrait pouvoir expliquer ce qu’il sait simplement.",
        "Le ton facilite les questions de débutants. Max soupçonne une manière de rendre acceptables des informations imprécises.",
        ["skeptic", "“Ce qu’il sait”, c’est souvent juste le nom qu’il a choisi pour l’étiquette. On va pas faire semblant."], geneticsQuestion),
    },
  },
  response: {
    title: "Tout serait inventé sur l’étiquette", character: "Max · @max.sansfiltre",
    body: "Max étend sa méfiance à tous les noms du marché. Tu peux reconnaître que le marketing existe sans confirmer une accusation générale ou inventer des généalogies pour défendre le secteur.",
    contexts: { explain: "Tu demandais des informations derrière le nom ; il transforme cette exigence en preuve que tous les noms sont fictifs.", jab: "Ta famille royale fait rire, mais elle lui sert maintenant de prétendu aveu sur l’ensemble des variétés.", simple: "Tu encourageais les questions ; il suppose que les vendeurs n’ont jamais rien de plus à répondre." },
    choices: {
      sharp: reply("Lui renvoyer sa génétique par intuition", "Tu moques son verdict généralisé, au risque de paraître défendre toutes les étiquettes.", "reach",
        "Tu viens de vérifier tous les produits du marché depuis un commentaire. La génétique par intuition, on progresse. On peut demander des infos et critiquer un nom flou sans inventer que tout est la même fleur rebaptisée.",
        "La réplique fait réagir, mais Max la présente comme une défense du marketing. Lou attend toujours la réponse sur deux offres portant le même nom.",
        ["skeptic", "Et toi tu les défends tous sans rien vérifier. On est bien avancés."], ["sam", "Le plus utile serait de dire ce qu’un nom permet d’attendre et ce qu’il ne garantit pas."]),
      explain: reply("Reconnaître le flou sans généraliser", "Tu demandes des informations sur l’offre précise et la source des affirmations.", "craft",
        "Si une origine génétique est annoncée, on peut demander sur quoi elle repose. Et un nom commercial flou mérite une explication. Mais je ne peux pas conclure que tous les produits sont identiques à partir de ça. Le bon réflexe, c’est de séparer ce qui est documenté, ce qui est décrit et ce qui relève d’une histoire marketing.",
        "Les lecteurs disposent d’une distinction utile. Max reste sceptique sur la qualité des réponses que les vendeurs donneront réellement.",
        ["skeptic", "Alors il faut accepter de dire “on ne sait pas” au lieu d’inventer une lignée prestigieuse."], ["sam", "Oui, et une description du produit reste nécessaire même quand le nom est connu."]),
      ignore: ignore("Tu ne réponds pas à Max. Son accusation générale reste visible ; aucune généalogie ni identité entre produits n’est confirmée."),
    },
  },
  second: {
    title: "Lou compare deux offres au même nom", character: "Lou · @lou.decouvre",
    body: "Lou avait demandé si un nom identique permettait d’attendre le même produit dans deux boutiques. Ce commentaire concerne une attente d’achat, pas une demande de verdict sur tous les vendeurs.",
    choices: {
      challenge: reply("Refuser que le nom serve de garantie totale", "Tu réponds fermement avec une image facile à retenir.", "reach",
        "Le nom ne doit pas devenir une télécommande qui promet le même produit partout. Si les deux offres n’expliquent rien d’autre, il manque une partie de la conversation. Tu achètes ce qui est proposé maintenant, pas seulement le souvenir d’un nom que tu as aimé ailleurs.",
        "Lou comprend la limite, mais demande encore quels éléments comparer. Certains lecteurs trouvent la réponse trop méfiante envers les noms connus.",
        ["visitor", "Donc je ne dois pas m’arrêter au nom. Mais je regarde quoi ensuite ?"], ["jade", "Un nom peut rester utile comme repère, tant qu’il ne remplace pas tout le reste."]),
      document: reply("Comparer les informations autour du nom", "Tu distingues attente, description et identification de l’offre sans attribuer une génétique inconnue.", "craft",
        "Je le prendrais comme un point de départ, pas comme la garantie de retrouver exactement la même expérience. Compare qui produit, ce que la fiche décrit, les informations de lot disponibles et ce qui est réellement annoncé sur l’origine du nom. Et demande ce que le vendeur peut confirmer : mieux vaut une limite claire qu’une certitude décorative.",
        "Lou peut comparer au-delà du nom. La réponse laisse une part d’incertitude et ne tranche pas entre des offres qui ne sont pas présentées dans le fil.",
        ["visitor", "C’est plus clair. Je m’attendais à retrouver automatiquement le même produit parce que le nom était identique."], ["sam", "Et si on n’a que le nom, il faut reconnaître que l’information est courte."]),
      refocus: ignore("Tu laisses la question de Lou sans réponse. Aucun rapprochement entre offres ni origine génétique n’est ajouté au fil."),
    },
    branches: {
      sharp: { body: "Ta pique sur la génétique par intuition a entretenu le duel avec Max. Lou voulait surtout comprendre ce qu’un nom identique permet d’attendre ; tu peux revenir à cette question sans l’associer à la provocation.", lead: "Lou, ta comparaison entre deux offres mérite une réponse plus utile que ma pique précédente." },
      explain: { body: "Tu as séparé les informations documentées, la description et le récit marketing. Lou demande comment utiliser cette différence devant deux offres au même nom.", lead: "Pour tes deux offres au même nom, Lou :" },
      ignore: { body: "Tu n’as pas répondu à Max. Lou a posé une question distincte sous le même post ; tu peux la prendre maintenant ou laisser également ce commentaire sans réponse.", lead: "Je n’ai pas répondu à Max. Sur ta comparaison, Lou :" },
    },
  },
});

export const KQ_SOCIAL_GROWER_SCENARIOS = scenarios;
export const KQ_SOCIAL_GROWER_NARRATIVES = narratives;
