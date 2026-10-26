import { createDebateCatalog, choice, reply, ignore, finishBranches } from "./kanab-quest-social-debate-builder";
import type { KqSocialProducerNarrative } from "./kanab-quest-social-producer-types";
import type { KqSocialScenario } from "./kanab-quest-social-types";
import { KQ_SOCIAL_COMMUNITY_DEBATE_NARRATIVES, KQ_SOCIAL_COMMUNITY_DEBATE_SCENARIOS } from "./kanab-quest-social-debates-community";
import { KQ_SOCIAL_GROWER_NARRATIVES, KQ_SOCIAL_GROWER_SCENARIOS } from "./kanab-quest-social-debates-growers";
import { KQ_SOCIAL_COMMUNITY_MORE_DEBATE_NARRATIVES, KQ_SOCIAL_COMMUNITY_MORE_DEBATE_SCENARIOS } from "./kanab-quest-social-debates-community-more";

const { add, replyBranches, scenarios, narratives } = createDebateCatalog();

const foinArc = "Le CBD, c’est du foin ?";
add("ig-debate-foin-post", "instagram", 1, {
  requirement: "general", arc: foinArc, title: "Une plante, des attentes différentes", image: "workshop",
  body: "Tu veux parler du CBD sans jouer au vendeur de miracles. Certains arrivent avec des habitudes de cannabis riche en THC, d’autres avec une mauvaise expérience d’achat, d’autres ne voient simplement pas l’intérêt. Tu choisis ce que tu publies avant de découvrir les réactions.",
  audience: "Amateurs de fleurs, anciens déçus et curieux", character: "Ton post sur le CBD",
  choices: {
    plant: choice("Parler de la même plante", "Tu expliques les profils cannabinoïdes sans promettre les mêmes sensations.", "craft",
      "Le CBD et le THC ne viennent pas de deux mondes séparés : on parle de Cannabis sativa, avec des profils et des proportions de cannabinoïdes différents selon les variétés. Ça ne veut pas dire mêmes effets, ni que ça plaît à tout le monde. Je cultive du CBD, pas une promesse de mettre tout le monde d’accord.",
      "Le repère botanique intéresse des lecteurs. Max réduit tout à l’effet qu’il recherche ; Inès raconte une déception sans attaquer ton travail.",
      ["skeptic", "Le CBD c’est du foin ! Si ça défonce pas, autant acheter de la pelouse 😂"],
      ["ines", "J’ai déjà acheté un sachet très cher qui sentait le carton. Je ne cherche pas à être défoncée, juste à comprendre ce qui peut me plaire."]),
    taste: choice("Assumer les goûts différents", "Tu poses ta place de producteur sans transformer les non-amateurs en ennemis.", "care",
      "Vous avez le droit de ne pas aimer le CBD. Vraiment. Certains apprécient cet univers, d’autres n’y trouvent rien pour eux. Mon boulot, c’est de parler honnêtement de ce que je produis, pas de vous expliquer que vous avez tort de ne pas aimer.",
      "Ton ouverture permet des avis contrastés. Max vient quand même provoquer ; Sami rappelle que la déception d’un client n’est pas toujours du mépris.",
      ["skeptic", "Normal qu’on aime pas : le CBD c’est du foin vendu au prix de la weed."],
      ["sam", "J’aime les bonnes fleurs CBD, mais certains produits m’ont déçu aussi. On peut dire les deux sans se faire tomber dessus ?"]),
    jab: choice("Lancer la pique du foin", "Tu reprends l’insulte pour attirer le débat, au risque de parler d’abord aux provocateurs.", "reach",
      "“Le CBD c’est du foin.” On me la sert souvent, celle-là. À ce compte-là, tout ce qui ne correspond pas à votre effet préféré mérite une botte et une fourche ? On peut ne pas aimer une fleur sans mépriser ceux qui la travaillent.",
      "La formule fait réagir, et la discussion s’ouvre déjà sur ton ton. Les lecteurs qui voulaient parler de qualité cherchent leur place entre les piques.",
      ["skeptic", "Ben oui, c’est du foin. Si t’as besoin d’un post entier pour te défendre, c’est que ça pique 😂"],
      ["visitor", "La vanne m’a fait rire, mais j’aimerais savoir ce qui différencie deux fleurs CBD, concrètement."]),
  },
});

add("ig-debate-foin-reply", "instagram", 2, {
  requirement: "general", arc: foinArc, title: "Max a sorti la botte de foin", image: "community",
  body: "Sous ton post sur le CBD, Max réduit toute la discussion à une comparaison avec du foin. Son commentaire est public. D’autres lecteurs veulent parler de goût, d’attentes ou de qualité : leurs questions ne se confondent pas avec sa provocation.",
  audience: "Max, les lecteurs silencieux et les clients déçus", character: "Max · @max.sansfiltre",
  replyTo: { scenarioId: "ig-debate-foin-post", commentIndex: 0 },
  continuations: replyBranches("ig-debate-foin-post", {
    plant: "Il répond à ton explication botanique par une comparaison sur les effets. Inès, elle, parle de qualité : les deux sujets ne se confondent pas.",
    taste: "Tu avais explicitement laissé le droit de ne pas aimer. Il transforme ce désaccord de goût en accusation sur la valeur de tout ton métier.",
    jab: "Ta propre pique a attiré la sienne. Répondre encore sur ce ton prolongerait le duel que tu as contribué à ouvrir.",
  }),
  choices: {
    sharp: reply("Le traiter d’ignare", "Tu réponds à Max sur le même ton, avec une attaque personnelle.", "reach",
      "Ignare et fier de l’être, visiblement. Ne pas aimer, c’est ton droit. Résumer toute une plante à “ça défonce ou ça sert à rien”, ça ne devient pas une expertise parce que tu mets un emoji derrière.",
      "La répartie se partage. Max repart à l’attaque et des lecteurs retiennent surtout “ignare” ; ton explication sur la plante passe au second plan.",
      ["skeptic", "Ah voilà, le commerçant insulte quand on aime pas sa marchandise. Belle pub."],
      ["ines", "Sa remarque était nulle. Mais je n’ose plus trop poser ma question sur le sachet qui m’a déçue."]),
    explain: reply("Expliquer, sans chercher à le convertir", "Tu distingues plante, profils cannabinoïdes et préférences personnelles.", "craft",
      "C’est la même espèce, Cannabis sativa, avec des profils cannabinoïdes différents. Du CBD dominant, ce n’est pas une copie des effets d’un produit riche en THC. Tu peux ne pas aimer, ou avoir acheté quelque chose de mauvais. D’autres apprécient. On n’est pas là pour mettre tout le monde d’accord, et je ne promets aucun miracle.",
      "Inès ose préciser sa question. Max reste peu convaincu : le message sert surtout aux gens qui lisaient sans intervenir, au prix d’une longue réponse.",
      ["skeptic", "OK pour la plante. Moi ça ne m’intéresse toujours pas, on va pas y passer la nuit."],
      ["ines", "Ça, je comprends. Ma déception portait sur le produit acheté, pas sur les gens qui en aiment d’autres."]),
    ignore: ignore("Tu ne publies aucune réponse. Max garde son commentaire et les demandes de précision restent en attente ; tu ne consacres pas ton énergie à ce duel."),
  },
}, "ig-debate-foin-post");

const foinFinish = {
  challenge: choice("Reprendre la formule publiquement", "Tu consacres un nouveau post au cliché du foin, avec le risque de lui donner encore de la place.", "reach",
    "Il faudrait donc qu’une fleur plaise à tout le monde et reproduise l’effet préféré de chacun pour mériter autre chose que “du foin”. Drôle de cahier des charges. Mon activité n’a pas besoin de cette unanimité pour exister.",
    "Le cliché repart dans les partages. Ton compte gagne de la visibilité, mais le débat sur la qualité reste coincé derrière la punchline.",
    ["noe", "Je comprends le ras-le-bol. Tu lui offres quand même un deuxième épisode."], ["visitor", "Je débarque, je comprends la dispute mais toujours pas ce que tu fais au quotidien."]),
  document: choice("Séparer goûts, effets et qualité", "Tu réponds à la vraie question des lecteurs sans inventer un test sur tes propres fleurs.", "craft",
    "Trois conversations se mélangent : est-ce qu’on aime, qu’est-ce qu’on recherche, et qu’a-t-on vraiment acheté ? Une mauvaise expérience mérite qu’on l’écoute. Un nom de variété ou une belle photo ne décrit pas tout un produit. Et mon métier ne me donne pas le droit de décider à votre place ce que vous devez aimer.",
    "Les témoignages deviennent plus précis. Tu gagnes en crédibilité auprès de certains lecteurs, mais d’autres trouvent le post trop long ou quittent le débat.",
    ["ines", "Mon sachet décevant, c’est la troisième question. Merci de ne pas résumer ça à “elle n’a pas compris le CBD”."], ["skeptic", "Toujours pas mon truc. Au moins on peut le dire."]),
  refocus: choice("Revenir au compte sans faire voter", "Tu poses le droit au désaccord et tu annonces la fin de cette discussion.", "care",
    "Je garde le droit de parler de mon activité, vous gardez celui de ne pas aimer le CBD. On n’a pas besoin d’un vote final sous chaque post. Les questions précises restent les bienvenues ; je vais aussi parler d’autre chose que de cette dispute.",
    "Tu limites le temps consacré au fil. Les habitués restent ; le désaccord demeure et certains nouveaux lecteurs repartent sans en savoir plus.",
    ["sam", "Pas besoin de transformer chaque sachet décevant en guerre de camps."], ["skeptic", "Ça ne change pas mon avis, mais bon."]),
};
add("ig-debate-foin-after", "instagram", 3, {
  requirement: "general", arc: foinArc, title: "Ce que les lecteurs ont retenu", image: "still-life",
  body: "Le débat a laissé plusieurs questions : le goût, les attentes et la qualité. Ton prochain post peut prolonger la polémique, clarifier ces différences ou tourner la page.",
  audience: "Les gens venus pour la discussion et ceux qui suivent ton travail", character: "Ton prochain post", choices: foinFinish,
  continuations: finishBranches({
    sharp: { body: "Tu as traité Max d’ignare. Il a repris ton insulte, tandis qu’Inès dit hésiter à poser sa question. Ta réplique a rendu le fil visible ; elle a aussi fait paraître plus risqué le simple fait de ne pas être convaincu. Le prochain post devra vivre avec cette impression.", lead: "J’ai traité un commentateur d’ignare. C’est écrit, et ça a déplacé la discussion vers mon ton. Ça ne répondait pas aux déceptions racontées par d’autres." },
    explain: { body: "Tu as expliqué la même espèce et les profils cannabinoïdes sans promettre les mêmes effets. Max ne veut toujours pas de CBD ; Inès distingue maintenant sa déception d’achat d’un jugement sur toute la plante. Tu peux prolonger ce point sans annoncer que tout le monde est convaincu.", lead: "J’ai répondu sur la plante et les profils cannabinoïdes. Ça n’a pas donné envie de CBD à tout le monde, et ce n’était pas une obligation." },
    ignore: { body: "Tu n’as envoyé aucune réponse à Max. Le commentaire sur le foin et les autres réactions restent visibles. Le silence t’a coûté peu d’énergie ; il n’a corrigé aucune confusion. Ce qui suit sera un nouveau post, pas une réponse que tu aurais déjà donnée.", lead: "Je n’ai pas répondu au commentaire sur le foin. Je reviens ici avec un nouveau post, pour celles et ceux qui veulent encore discuter du sujet." },
  }, foinFinish),
}, "ig-debate-foin-reply");

const priceArc = "Le prix et ceux qui travaillent";
add("ig-debate-price-post", "instagram", 1, {
  requirement: "general", arc: priceArc, title: "Pourquoi ces écarts de prix ?", image: "workshop",
  body: "Un prix bas ne dit pas à lui seul comment une fleur a été produite ; un prix élevé ne prouve pas sa qualité. Tu veux parler du travail des chanvriers et des écarts entre production et revente, sans sortir de faux comptes de ton exploitation.",
  audience: "Clients qui comparent, producteurs et revendeurs", character: "Ton post sur les prix",
  choices: {
    work: choice("Montrer les postes de travail", "Tu expliques ce qu’un prix doit couvrir, sans avancer de coût personnel inventé.", "craft",
      "Avant le sachet, il y a la culture, le séchage, le tri, les analyses et le temps passé. À la revente s’ajoutent d’autres frais. Ça ne justifie pas automatiquement n’importe quel prix : ça explique pourquoi comparer seulement deux étiquettes ne dit pas qui a été payé, ni pour quoi.",
      "Des lecteurs veulent comprendre les intermédiaires ; Max soupçonne un discours destiné à justifier une marge. La question du budget reste entière.",
      ["skeptic", "Oui oui le petit producteur… Ça achète en gros et ça revend dix fois plus cher. Le storytelling, ça rapporte."], ["ines", "Je peux entendre le boulot derrière. Mais à la fin, mon budget ne grandit pas avec l’explication."]),
    squeeze: choice("Dénoncer la pression sur les producteurs", "Tu prends parti pour le travail agricole sans accuser une enseigne précise.", "reach",
      "On voudrait du local, du travail soigné, de la traçabilité, et payer le producteur comme si rien de tout ça ne coûtait du temps. Puis on s’étonne que certains abandonnent. Les marges de la filière méritent une discussion, pas juste un joli portrait de chanvrier sur le sachet.",
      "Le post circule entre professionnels. Il attire aussi ceux qui y voient une attaque contre tous les clients attentifs au prix.",
      ["skeptic", "Encore la pleurniche des producteurs pour revendre des sacs de grossiste hors de prix. Nous aussi on bosse, hein."], ["sam", "Je revends aussi, et le loyer ne se paie pas en portraits. On peut parler du partage sans faire croire qu’une boutique n’a pas de frais ?"]),
    budget: choice("Partir du budget des clients", "Tu reconnais la contrainte du client tout en défendant une rémunération du travail.", "care",
      "“C’est trop cher pour moi”, c’est une réponse recevable. Je ne vais pas vous culpabiliser pour votre budget. J’aimerais simplement qu’on puisse discuter du travail rémunéré à chaque étape, sans décider que le moins cher est forcément mauvais ou que le plus cher est forcément honnête.",
      "Le ton laisse de la place aux budgets modestes. La suspicion de revente maquillée en production surgit malgré cette précaution.",
      ["skeptic", "Commence par dire combien tu prends de marge au lieu de faire le philosophe. Les producteurs qui reconditionnent, on connaît."], ["visitor", "Merci pour le budget. Je comparerais volontiers l’origine, mais ce n’est pas toujours lisible."]),
  },
});
add("ig-debate-price-reply", "instagram", 2, {
  requirement: "general", arc: priceArc, title: "« Du storytelling pour la marge »", image: "community",
  body: "Max met en doute ton activité de producteur. Les autres lecteurs posent des questions légitimes sur le prix et l’origine ; tu peux répondre à l’accusation sans traiter toutes ces questions comme une attaque.",
  audience: "Clients qui comparent les prix et professionnels de la filière", character: "Max · @max.sansfiltre", replyTo: { scenarioId: "ig-debate-price-post", commentIndex: 0 },
  continuations: replyBranches("ig-debate-price-post", {
    work: "Tu avais décrit des postes de travail, sans annoncer ta marge. Son chiffre ne vient d’aucun compte publié par toi.",
    squeeze: "Ta critique portait sur la rémunération du producteur ; il la transforme en mépris du travail des clients. Sami demande aussi que les frais des boutiques soient reconnus.",
    budget: "Tu avais reconnu la contrainte du budget. Il te demande maintenant des comptes et glisse une accusation de reconditionnement sans élément à l’appui.",
  }),
  choices: {
    sharp: reply("Renvoyer le procureur à son comptoir", "Tu attaques la certitude de Max, au risque de fermer aussi les questions honnêtes.", "reach",
      "Tu ne connais ni mes comptes ni mon activité, mais tu as déjà la marge et le verdict. Procureur de comptoir, ça recrute visiblement sans dossier. Pose une question sur le prix si tu veux. Inventer mon boulot pour me traiter d’escroc, c’est autre chose.",
      "La réponse mobilise des soutiens, mais la moquerie masque ta demande de preuve. Des clients hésitent à poser leur propre question sur les prix.",
      ["skeptic", "Toujours aucun chiffre, juste une insulte. Les gens jugeront."], ["ines", "Je ne t’accuse de rien. Mais ça devient compliqué de demander pourquoi un produit coûte plus cher."]),
    explain: reply("Distinguer prix, marge et accusation", "Tu reconnais les frais de chaque métier et la limite des informations publiées.", "craft",
      "Tu peux me demander l’origine et ce qui justifie un prix. Mais ton histoire de marge et de revente cachée, tu la sors d’où ? Le prix de vente n’est pas ce qui reste au producteur : il y a les charges, les pertes, les intermédiaires. On peut en parler. Et si c’est trop cher pour ton budget, je n’ai pas à te faire la morale.",
      "Les lecteurs disposent de distinctions plus claires. Max réclame toujours les chiffres que tu n’as pas publiés ; l’explication ne remplace pas une preuve commerciale.",
      ["skeptic", "OK, mais tant qu’on ne voit pas les infos produit, ça reste des paroles."], ["sam", "Le prix de vente n’est pas la marge, côté ferme comme côté boutique. Sur l’origine affichée, il a quand même raison de demander."]),
    ignore: ignore("Tu ne réponds pas. L’accusation de reconditionnement reste visible sans preuve ni réfutation ; tu gardes ton énergie, et les demandes honnêtes restent elles aussi en attente."),
  },
}, "ig-debate-price-post");

const priceFinish = {
  challenge: choice("Défendre frontalement le métier", "Tu refuses le soupçon automatique, dans un ton qui peut encore braquer des clients.", "reach",
    "Le mot “producteur” n’immunise personne contre les questions. Mais les questions n’autorisent pas non plus à inventer une arnaque. On peut exiger une origine lisible et parler de rémunération sans commencer chaque discussion par un procès.",
    "Des professionnels relaient la formule. Des clients y entendent encore une réaction défensive, et les renseignements qu’ils cherchent restent à fournir produit par produit.",
    ["jade", "La suspicion permanente use. Il faudra quand même répondre aux demandes concrètes quand elles arrivent."], ["visitor", "Je veux juste savoir ce que j’achète, je ne prépare pas un procès."]),
  document: choice("Donner des critères de comparaison", "Tu proposes des questions utiles, sans transformer le post en certificat de tes lots.", "craft",
    "Quand je compare deux offres, je veux savoir d’où ça vient, qui a cultivé, qui revend et à quel lot correspondent les infos. Pas juste admirer un drapeau ou une belle étiquette. Le plus cher peut raconter n’importe quoi ; le moins cher peut avoir une histoire parfaitement explicable. Commençons par avoir les infos sous les yeux.",
    "Les lecteurs ont des critères plus utiles qu’une querelle de marges. Le travail documentaire est exigeant, et certains restent méfiants tant qu’ils n’ont pas les réponses sur une offre précise.",
    ["ines", "Ça m’aide à comparer sans devoir deviner votre comptabilité."], ["sam", "Et un document sans correspondance claire avec le lot ne répond pas à tout. Les boutiques ont leur part du boulot."]),
  refocus: choice("Laisser une place aux petits budgets", "Tu reviens à une limite simple : défendre son travail ne donne pas le droit de culpabiliser les acheteurs.", "care",
    "Je veux pouvoir vivre de mon travail. Vous avez aussi un budget, et vous n’avez pas à vous en excuser sous mon compte. Si une offre ne vous convient pas, vous pouvez passer votre chemin. Je préfère une question précise sur ce qui est proposé à une guerre entre “radins” et “arnaqueurs”.",
    "Le fil redevient supportable pour certains habitués. Tu ne règles ni la question des prix de la filière ni toutes les suspicions sur l’origine.",
    ["visitor", "On peut donc dire trop cher pour moi sans se faire faire la leçon. Ça me va."], ["skeptic", "Reste à voir les infos concrètes, pas seulement les bonnes intentions."]),
};
add("ig-debate-price-after", "instagram", 3, {
  requirement: "general", arc: priceArc, title: "La confiance ne tient pas dans une marge", image: "still-life",
  body: "Le débat sur les prix a fait apparaître deux attentes : une origine compréhensible et un budget respecté. Ton prochain post peut donner des repères ou prolonger l’affrontement.",
  audience: "Clients, chanvriers et revendeurs qui lisent le fil", character: "Ton prochain post", choices: priceFinish,
  continuations: finishBranches({
    sharp: { body: "Tu as traité Max de procureur de comptoir. Il a répondu que l’insulte ne donnait aucun chiffre, et Inès craint de poser une question pourtant légitime. Le soupçon n’a pas disparu ; c’est maintenant aussi ta manière de recevoir les clients qui est discutée.", lead: "Ma vanne sur le procureur de comptoir a surtout lancé une dispute. Si vous veniez simplement demander pourquoi ça coûte ce prix, je comprends que ça vous ait refroidis." },
    explain: { body: "Tu as distingué prix de vente et revenu sans inventer tes comptes. Sami reconnaît cette distinction, mais Max et d’autres attendent toujours des informations concrètes sur les offres. Tu ne peux pas présenter ce commentaire comme un audit de ton activité.", lead: "J’ai distingué prix, charges et revenu dans ma réponse. Ça ne remplace pas les informations qu’un client est en droit de chercher sur un produit." },
    ignore: { body: "Tu n’as publié aucune réponse. L’accusation reste dans les commentaires et les lecteurs n’ont pas reçu tes repères sur les prix. Un nouveau post peut ouvrir ce sujet ; il ne doit pas raconter que tu l’as déjà expliqué.", lead: "Je n’ai pas répondu à l’accusation sous le précédent post. Je prends ici le sujet du prix et de l’origine, sans inventer de comptes à vous montrer." },
  }, priceFinish),
}, "ig-debate-price-reply");

const boundaryArc = "La critique a sa place, l’acharnement non";
add("ig-debate-boundary-post", "instagram", 1, {
  requirement: "general", arc: boundaryArc, title: "À qui appartient la discussion ?", image: "community",
  body: "Tu veux que les déçus puissent parler sans que ton compte devienne un endroit où l’on s’acharne sur les gens. Tu prépares un post sur les limites de la discussion. Dire “je n’aime pas” n’est pas la même chose qu’insulter quelqu’un à répétition.",
  audience: "Habitués, critiques et personnes qui n’osent plus commenter", character: "Ta règle de discussion",
  choices: {
    distinction: choice("Distinguer critique et attaque", "Tu poses une règle sur les comportements, pas sur les opinions favorables.", "craft",
      "“Je n’aime pas”, “j’ai été déçu” et “je ne comprends pas ton prix” ont leur place ici. L’insulte répétée, les menaces et l’acharnement contre une personne, non. Je veux qu’on puisse critiquer mon travail sans que les autres aient peur d’ouvrir les commentaires.",
      "La distinction rassure certains lecteurs. Max y voit d’avance un prétexte pour écarter les avis gênants, tandis qu’Inès veut une règle valable pour tout le monde.",
      ["skeptic", "Traduction : les compliments restent, les critiques dégagent. La fameuse liberté d’expression des vendeurs de CBD 😂"], ["ines", "D’accord si ça vaut aussi pour tes soutiens quand ils se mettent à plusieurs sur un client déçu."]),
    doorstep: choice("Assumer que c’est ton espace", "Tu affirmes ta limite avec une formule qui peut ressembler à une fermeture aux critiques.", "reach",
      "Mon compte n’est pas un paillasson. On peut discuter de CBD, de prix, de qualité, et être en désaccord. Par contre, je ne dois à personne une permanence d’insultes sous prétexte que je parle de mon métier en public.",
      "La formule plaît à des habitués fatigués des tensions. Elle donne aussi prise à l’accusation de vouloir choisir uniquement les réactions agréables.",
      ["skeptic", "Fallait pas ouvrir un compte public si tu supportes pas qu’on dise que ton CBD vaut rien."], ["noe", "Je comprends la fatigue. Attention à ne pas ranger le premier avis sec avec les gens qui s’acharnent."]),
    welcome: choice("Donner de la place aux déçus", "Tu invites les critiques précises tout en annonçant une limite aux attaques contre les personnes.", "care",
      "Si vous avez une question ou une déception, vous pouvez la dire ici. Pas besoin d’enrober tout dans un compliment. Je demande seulement qu’on parle des faits et des produits sans se prendre les uns les autres pour cible.",
      "Des lecteurs voient une porte ouverte à la critique. Max se moque de cette invitation ; Sami rappelle qu’un avis décevant peut aussi être maladroit.",
      ["skeptic", "Mdr, on va devoir remplir ton formulaire de politesse pour dire que c’est nul ?"], ["sam", "Un client énervé ne formule pas toujours bien. Ce qui compte, c’est ce qu’on en fait après."]),
  },
});
add("ig-debate-boundary-reply", "instagram", 2, {
  requirement: "general", arc: boundaryArc, title: "« Tu supprimes les critiques »", image: "community",
  body: "Max attaque ta règle de discussion. Son commentaire est provocateur, mais le qualifier automatiquement de harcèlement serait incohérent avec la place que tu annonces laisser au désaccord.",
  audience: "Ceux qui testent la règle et ceux qui attendent de voir", character: "Max · @max.sansfiltre", replyTo: { scenarioId: "ig-debate-boundary-post", commentIndex: 0 },
  continuations: replyBranches("ig-debate-boundary-post", {
    distinction: "Tu avais distingué les comportements des opinions. Il prétend que seuls les avis positifs seront admis ; Inès attend surtout que tes soutiens soient traités de la même façon.",
    doorstep: "Ta formule du paillasson est lue comme un refus des critiques. Noé t’a aussi invité à distinguer une remarque sèche d’un acharnement.",
    welcome: "Tu avais invité les déceptions sans exiger de compliment. Il se moque d’une formalité que tu n’as pas demandée ; sa remarque reste pour l’instant une provocation, pas une campagne de harcèlement.",
  }),
  choices: {
    sharp: reply("Se moquer de sa lecture sélective", "Tu réponds à la provocation par une attaque qui fragilise ta propre règle.", "reach",
      "La lecture sélective, chez toi, c’est un sport de haut niveau. J’écris que les critiques ont leur place, tu arrives quand même à lire l’inverse. Tu peux ne rien aimer ici. Par contre, je ne vais pas te dérouler le tapis rouge pour venir te foutre des gens.",
      "Tes soutiens applaudissent la réplique. D’autres relèvent que tu viens d’insulter quelqu’un sous un post qui demandait d’éviter les attaques personnelles.",
      ["skeptic", "Pas d’attaque personnelle sauf quand c’est toi. Ta règle a tenu un commentaire."], ["ines", "Là, il marque un point sur la cohérence. Même si sa provocation m’agaçait."]),
    explain: reply("Appliquer la règle à tout le monde", "Tu laisses sa critique visible et précises le comportement qui justifierait une limite.", "craft",
      "Ton commentaire reste visible. Tu peux trouver mon CBD nul, ou ma règle mauvaise. Ce que je refuse, c’est l’attaque répétée contre une personne, les menaces ou l’appel à aller lui tomber dessus. Et ça vaut aussi pour ceux qui me défendent. Un avis négatif n’est pas du harcèlement à lui tout seul.",
      "La limite devient plus vérifiable. Max reste méfiant, et tu devras accepter que tes propres soutiens soient rappelés à l’ordre si leur comportement dérape.",
      ["skeptic", "On verra au premier vrai avis qui te dérange."], ["ines", "Si ça vaut aussi pour tes habitués, je peux vivre avec cette règle."]),
    ignore: ignore("Tu n’envoies aucune réponse et tu ne supprimes pas le commentaire. Sa présence montre que la critique reste possible, mais tu n’as pas clarifié comment ta règle s’appliquerait."),
  },
}, "ig-debate-boundary-post");

const boundaryFinish = {
  challenge: choice("Réaffirmer la limite avec fermeté", "Tu rappelles que le compte n’offre pas un accès illimité à ton attention.", "reach",
    "Être visible ne veut pas dire être disponible pour chaque provocation. Les avis négatifs ont leur place ; personne ne gagne pour autant un droit à mon attention à toute heure. Je vais tenir cette limite, même si elle ne plaît pas à tout le monde.",
    "La position trouve des soutiens. Elle reste assez générale pour que les lecteurs méfiants y voient encore la possibilité d’écarter les discussions difficiles.",
    ["noe", "La disponibilité, c’est une vraie limite. L’application aux avis négatifs, on la verra dans le temps."], ["skeptic", "Pratique quand une question devient gênante."]),
  document: choice("Écrire une règle vérifiable", "Tu détailles les comportements concernés et tu inclus tes soutiens dans la règle.", "craft",
    "“Trop cher”, “pas aimé”, “j’ai été déçu” : ça reste. Même si ça ne me fait pas plaisir. Les menaces, les insultes à répétition et les appels à aller tomber sur quelqu’un, ça dépasse la limite. Et si vous me défendez en vous mettant à dix sur un client, vous avez raté le principe. Le maillot de mon équipe ne donne aucun passe-droit.",
    "Les lecteurs peuvent juger tes décisions futures à partir d’une règle précise. Ce cadre demande de l’attention dans la durée et ne fait pas disparaître les personnes qui le contestent.",
    ["ines", "Je garde surtout la règle sur les fans. C’est souvent là qu’on n’ose plus parler."], ["sam", "Il faudra distinguer répétition et personne qui revient parce qu’elle n’a pas eu de réponse. Ça restera du travail."]),
  refocus: choice("Fermer la dispute sans effacer les avis", "Tu arrêtes de commenter ce conflit et tu maintiens l’espace pour les questions concrètes.", "care",
    "Je vais m’arrêter là sur cette dispute. Les avis restent visibles, les questions sur le boulot et les produits restent bienvenues. Je ne vais juste pas passer ma soirée à répondre à chaque pique. Si je ne réponds pas, inutile d’en faire un aveu ou une victoire : j’ai aussi une vie hors de ce fil.",
    "Tu réduis le temps passé à te justifier. La règle devra encore être mise à l’épreuve et les commentaires hostiles ne disparaissent pas avec ton départ.",
    ["visitor", "Ça me laisse au moins la place de poser autre chose qu’une question sur votre dispute."], ["skeptic", "On verra si les avis restent vraiment."]),
};
add("ig-debate-boundary-after", "instagram", 3, {
  requirement: "general", arc: boundaryArc, title: "Une règle doit tenir aussi contre ses amis", image: "still-life",
  body: "Ce que tu annonces compte moins que la manière dont tu traiteras le prochain avis gênant. Tu choisis un nouveau post sur cette limite, sans prétendre avoir déjà effectué une action de modération.",
  audience: "Les soutiens du compte et les lecteurs qui hésitent à parler", character: "Ta règle mise à l’épreuve", choices: boundaryFinish,
  continuations: finishBranches({
    sharp: { body: "Tu t’es moqué de Max sous ton propre appel à éviter les attaques personnelles. Max et Inès ont relevé la contradiction. Tes soutiens peuvent aimer la répartie ; ils ne peuvent pas effacer ce décalage. Ton nouveau post doit l’assumer.", lead: "J’ai demandé d’éviter les attaques personnelles, puis je me suis moqué de lui. Pas très cohérent. La règle vaut aussi quand c’est moi qui perds patience." },
    explain: { body: "Tu as laissé la provocation visible et expliqué qu’un avis négatif ne suffit pas à constituer du harcèlement. Inès attend maintenant que la règle vaille pour les habitués. Max ne te croit pas encore : le commentaire n’a pas réglé la confiance à lui seul.", lead: "J’ai répondu que cette règle valait pour tout le monde, y compris ceux qui me défendent. Je sais que ça se jugera sur mes actes." },
    ignore: { body: "Tu n’as répondu ni supprimé quoi que ce soit. Le commentaire reste visible ; les lecteurs ne savent pas encore comment tu distingueras une question insistante d’un acharnement. Ce nouveau post sera ta première précision après la provocation.", lead: "Je n’ai pas répondu à la provocation sous mon post. Le commentaire est resté. Je précise ici ce que je veux faire de cet espace." },
  }, boundaryFinish),
}, "ig-debate-boundary-reply");

const foodArc = "Le CBD alimentaire et l’impasse des chanvriers";
add("x-debate-food-post", "x", 1, {
  requirement: "general", arc: foodArc, title: "On est censés vivre de quoi ?", image: "still-life",
  body: "Tu veux parler du cadre alimentaire et de ce qu’il fait vivre à la filière. Le rappel officiel du 20 mai 2026 annonce des contrôles renforcés : le CBD comme ingrédient alimentaire n’a pas l’autorisation requise. Les exceptions du chanvre alimentaire ne se résument pas à “tout est interdit”.",
  audience: "Chanvriers, clients et personnes qui suivent les décisions publiques", character: "Ton post sur le cadre alimentaire",
  choices: {
    anger: choice("Dire le ras-le-bol du secteur", "Tu critiques l’impasse réglementaire sans transformer le rappel officiel en interdiction de tout aliment au chanvre.", "reach",
      "Franchement, cette impasse sur le CBD alimentaire me rend dingue. On veut des chanvriers qui investissent, qui travaillent proprement, qui construisent une filière… et derrière, quelle perspective ? Le rappel du 20 mai 2026 annonce des contrôles renforcés. Très bien, mais la filière a aussi besoin d’autre chose qu’un mur. Ce cadre me paraît absurde, et je compte bien le dire.",
      "Le ras-le-bol trouve des relais. Max y voit une demande de passe-droit, tandis que d’autres craignent que la colère masque la question des autorisations.",
      ["skeptic", "Donc vous avez vendu des trucs interdits et maintenant vous pleurez ? Changez de métier."], ["jade", "La colère existe. Si on veut être entendus, il faut aussi préciser ce qui manque : un débouché autorisé, pas juste moins de contrôles."]),
    explain: choice("Séparer CBD ajouté et chanvre alimentaire", "Tu pars du rappel officiel et de ses exceptions pour éviter le slogan faux.", "craft",
      "Le rappel officiel du 20 mai 2026 dit : le CBD comme ingrédient alimentaire n’est pas autorisé faute d’autorisation Novel Food. Ça ne veut pas dire “plus aucun aliment au chanvre” : graines et dérivés, et feuilles pour infusion aqueuse, ont des exceptions sans enrichissement en cannabinoïdes. La filière mérite mieux que des slogans des deux côtés.",
      "Des lecteurs découvrent les différences de statut. Le texte est moins facile à partager qu’un slogan ; Max l’interprète quand même comme une défense de produits interdits.",
      ["skeptic", "Toute cette gymnastique pour vendre de la drogue en bonbons. Le mot chanvre ne rend pas ça sérieux."], ["ines", "Donc l’huile de graines de chanvre n’est pas automatiquement la même chose qu’une huile avec du CBD ajouté ? J’avais tout mélangé."]),
    question: choice("Demander une perspective à la filière", "Tu poses une demande politique sans affirmer que ton activité a déjà subi une interdiction particulière.", "care",
      "Sur le CBD alimentaire, on est censés aller où ? Quelles données, quel dossier, quel chemin pour obtenir une autorisation ? On ne construit pas une activité avec “on verra”. Je veux des exigences qu’on puisse comprendre et une perspective de travail, pas une médaille pour avoir tenu jusque-là.",
      "La demande ouvre une discussion précise, mais touche peu de monde. Max ramène le sujet à la responsabilité individuelle des professionnels.",
      ["skeptic", "Le chemin c’est lire la loi AVANT de vendre, pas demander qu’on l’arrange pour vous."], ["sam", "Un cadre lisible et un accès à l’autorisation, ça mérite une réponse. Ça n’efface pas les obligations actuelles."]),
  },
});
add("x-debate-food-reply", "x", 2, {
  requirement: "general", arc: foodArc, title: "« Vous n’aviez qu’à lire la loi »", image: "community",
  body: "Max transforme ta critique du cadre en aveu de vente irrégulière. Tu n’as rien déclaré de tel. Tu peux contester cette accusation tout en restant précis sur les autorisations alimentaires.",
  audience: "Professionnels en colère et lecteurs soucieux des règles alimentaires", character: "Max · @max.sansfiltre", replyTo: { scenarioId: "x-debate-food-post", commentIndex: 0 },
  continuations: replyBranches("x-debate-food-post", {
    anger: "Ton post critiquait les perspectives offertes à la filière. Il ne disait pas que tu vendais un produit alimentaire non autorisé.",
    explain: "Tu avais cité les différences de statut ; il ramène tout aux bonbons et à la drogue. La question d’Inès sur l’huile de graines montre que la distinction sert aussi à des lecteurs de bonne foi.",
    question: "Tu demandais quel chemin d’autorisation existe. Il te répond comme si tu avais demandé de contourner les obligations actuelles.",
  }),
  choices: {
    sharp: reply("Lui renvoyer sa leçon de comptoir", "Tu attaques son raccourci, en donnant un nouveau sujet à la dispute.", "reach",
      "Merci pour le cours magistral depuis ton canapé. Je parle de l’avenir d’une filière, tu inventes un délit et tu rends ton verdict. Critiquer ce cadre ne veut pas dire que je vends un produit interdit. Essaie de lire le post avant de distribuer les leçons.",
      "La pique rallie des professionnels excédés. Max cite le ton de ta réponse ; le sujet des autorisations passe derrière le duel personnel.",
      ["skeptic", "Toujours la faute des autres. Et maintenant les insultes."], ["ines", "J’étais venue comprendre ce qui est alimentaire ou pas. Là vous m’avez perdue."]),
    explain: reply("Répondre sur le statut et la demande", "Tu cites le cadre daté, ses exceptions et la différence entre critique politique et droit de vendre.", "craft",
      "Tu me prêtes une vente que je n’ai jamais annoncée. Le rappel officiel du 20 mai 2026 dit bien que le CBD alimentaire n’est pas autorisé. Il distingue aussi les graines et leurs dérivés, et les feuilles seulement en infusion aqueuse, sans enrichissement en cannabinoïdes. Je demande un débouché autorisé et un cadre plus lisible. On peut demander ça sans prétendre que les règles actuelles ont disparu.",
      "Des lecteurs comprennent mieux la demande. Max garde son reproche sur la responsabilité des vendeurs ; la précision a coûté du temps sans produire un accord politique.",
      ["skeptic", "D’accord pour ne pas mélanger les graines. Ceux qui vendent quand même restent responsables."], ["jade", "Oui. On peut demander une autre politique sans raconter que les autorisations existent déjà."]),
    ignore: ignore("Tu ne réponds pas à Max. Tu évites un échange coûteux, mais son interprétation reste sous ton post et les lecteurs n’ont pas de précision supplémentaire de ta part."),
  },
}, "x-debate-food-post");

const foodFinish = {
  challenge: choice("Porter une revendication ferme", "Tu assumes une critique politique sans appeler à ignorer les règles.", "reach",
    "La filière ne peut pas vivre éternellement entre un rappel à l’ordre et un “dossier à suivre”. Je veux qu’on mette autour de la table les exigences de sécurité, le coût des dossiers et un vrai chemin d’autorisation. On peut trouver ce cadre absurde et demander qu’il change. C’est une revendication politique, pas un permis de vendre dès demain.",
    "La revendication se partage entre professionnels. Certains lecteurs la soutiennent ; d’autres estiment que le coût de démontrer la sécurité appartient aux opérateurs.",
    ["jade", "Un objectif précis donne davantage de prise qu’un simple “laissez-nous travailler”."], ["skeptic", "Accessible ne doit pas vouloir dire baisser les exigences parce que c’est votre métier."]),
  document: choice("Publier les distinctions utiles", "Tu reprends le point officiel daté et tu renonces au raccourci “tout le chanvre alimentaire est interdit”.", "craft",
    "Repère : rappel ministériel du 20 mai 2026. CBD comme ingrédient alimentaire : pas d’autorisation Novel Food à cette date, contrôles renforcés. Exceptions mentionnées : graines et dérivés ; feuilles uniquement pour infusion aqueuse, sans enrichissement en cannabinoïdes. Une huile de graines et un aliment enrichi en CBD ne se confondent pas. Le détail du produit et son usage comptent.",
    "Le post donne un point d’entrée fiable aux lecteurs. Il ne transforme aucune offre en produit autorisé et il faudra suivre les évolutions du cadre.",
    ["ines", "Je comprends pourquoi ma bouteille d’huile de graines ne répondait pas à ma question sur le CBD ajouté."], ["sam", "Et une exception ne vaut pas validation automatique de tout ce qu’on met sur le marché."]),
  refocus: choice("Dire ce que tu demandes, simplement", "Tu gardes une demande claire sans relancer toute la bataille réglementaire.", "care",
    "Je ne demande pas qu’on nous dise “faites ce que vous voulez”. Je demande qu’on arrête de parler des chanvriers comme d’un problème à déplacer. Des exigences compréhensibles et une perspective pour travailler : c’est trop demander ? Ma colère est là.",
    "Le message limite les confusions et le temps passé au fil. Il laisse les questions de calendrier et d’accès aux autorisations sans réponse.",
    ["noe", "La colère reste, mais on sait mieux ce que tu demandes."], ["visitor", "Et concrètement, qui pourrait faire avancer le dossier ? Je reste sur cette question."]),
};
add("x-debate-food-after", "x", 3, {
  requirement: "general", arc: foodArc, title: "Transformer la colère en demande précise", image: "still-life",
  body: "Le prochain post peut porter une revendication, expliquer les catégories ou résumer ta position. Aucun commentaire ne crée une autorisation alimentaire pour ton activité.",
  audience: "Lecteurs qui cherchent une position compréhensible", character: "Ton prochain post", choices: foodFinish,
  continuations: finishBranches({
    sharp: { body: "Tu as renvoyé Max à son cours magistral depuis le canapé. Il parle maintenant des insultes, et Inès dit avoir perdu le fil. La colère des producteurs a trouvé un écho, mais les distinctions alimentaires n’ont pas été expliquées dans ta réponse.", lead: "Ma pique sur les leçons de canapé a surtout alimenté notre dispute. La colère derrière est toujours là. Voilà ce que je veux défendre." },
    explain: { body: "Tu as précisé le statut du CBD alimentaire et les exceptions sans enrichissement. Max reconnaît la distinction sur les graines, tout en maintenant son reproche aux vendeurs. Le désaccord politique demeure ; les faits sont mieux posés.", lead: "J’ai répondu sur le cadre et ses exceptions. Nous ne sommes pas d’accord sur la politique à mener, mais les catégories ne sont pas interchangeables." },
    ignore: { body: "Tu n’as publié aucune réponse. L’accusation reste sous le post ; tu n’as ni confirmé une vente ni expliqué le cadre en commentaire. Ce nouveau message peut préciser ta demande sans faire passer ton silence pour une réfutation.", lead: "J’ai laissé le commentaire sans réponse. Je n’ai pas envie de passer la soirée à me justifier sur une vente que je n’ai jamais annoncée. Je reviens au sujet de la filière." },
  }, foodFinish),
}, "x-debate-food-reply");

const neoArc = "Les nouvelles molécules et le deux poids, deux mesures";
add("x-debate-neo-post", "x", 1, {
  requirement: "general", arc: neoArc, title: "Quand “CBD” masque autre chose", image: "still-life",
  body: "Tu veux parler des produits vendus sous une image CBD alors qu’ils contiennent d’autres cannabinoïdes. Le sentiment de courir derrière des molécules changeantes est réel dans la filière ; en déduire qu’elles seraient toutes autorisées ou jamais contrôlées serait faux.",
  audience: "Chanvriers, revendeurs et clients inquiets de ce qu’ils achètent", character: "Ton post sur les néocannabinoïdes",
  choices: {
    unfair: choice("Exprimer le sentiment d’injustice", "Tu parles du décalage ressenti sans prétendre connaître tous les contrôles ni les ventes.", "reach",
      "Ce qui me met en colère : voir revenir de nouvelles molécules derrière des emballages qui évoquent le CBD, pendant que les chanvriers cherchent à comprendre chaque exigence sur leurs produits. J’ai l’impression qu’on court après les substitutions. Ça ne veut pas dire que ces vendeurs sont tous dans la légalité ou jamais contrôlés.",
      "Le sentiment d’injustice touche des professionnels. Max résume malgré tout le post à “les autres vendent légalement, vous êtes jaloux”.",
      ["skeptic", "Vous êtes juste jaloux : les nouvelles molécules sont légales, sinon les shops ne les vendraient pas."], ["sam", "Je comprends la colère. Une vitrine ouverte ne prouve pas qu’un produit est autorisé."]),
    label: choice("Parler de ce que l’étiquette cache", "Tu recentres le problème sur la composition et les substitutions documentées.", "craft",
      "L’étiquette CBD ne suffit pas à savoir ce qu’il y a dans un produit. La Douane a documenté en 2025 des produits présentés comme CBD mais contenant d’autres substances. Je veux qu’on parle de composition réelle, de traçabilité et de contrôles, sans transformer tous les revendeurs en suspects.",
      "Les lecteurs interrogent la fiabilité des étiquettes. Max utilise l’absence de contrôle visible dans son entourage comme preuve que le problème n’est pas pris au sérieux.",
      ["skeptic", "Personne ne contrôle ces shops, ils vendent tout ce qu’ils veulent. Vos histoires de labo, c’est du théâtre."], ["ines", "Quand c’est écrit CBD en gros, je pensais savoir ce que j’achetais. Comment je fais la différence ?"]),
    ban: choice("Rappeler que des interdictions existent", "Tu distingues les familles de produits et les décisions datées.", "care",
      "Petit repère dans les noms : HHC, HHCO et HHCP ont été interdits en 2023 ; H4-CBD, H2-CBD et THCP figurent notamment parmi les interdictions de 2024. “Nouvelle molécule” ne veut pas dire “autorisée”. Voir une offre en ligne ne suffit pas à connaître son statut ni sa composition.",
      "Le rappel corrige une confusion chez quelques lecteurs. Max y voit une façon de se distinguer commercialement de toute la catégorie.",
      ["skeptic", "C’est surtout pour vendre ton CBD à toi. Chimique ou naturel, c’est pareil au final."], ["noe", "Et “naturel” ne règle pas non plus la question de la sécurité. Il faut parler du produit précis."]),
  },
});
add("x-debate-neo-reply", "x", 2, {
  requirement: "general", arc: neoArc, title: "Les raccourcis prennent le dessus", image: "community",
  body: "Le commentaire de Max mélange disponibilité, statut légal et composition. Le raccourci est fréquent, mais les interdictions et les contrôles documentés ne peuvent pas être effacés pour rendre ta colère plus convaincante.",
  audience: "Clients qui se fient à l’étiquette et professionnels qui contestent les contrôles", character: "Max · @max.sansfiltre", replyTo: { scenarioId: "x-debate-neo-post", commentIndex: 0 },
  continuations: replyBranches("x-debate-neo-post", {
    unfair: "Tu avais parlé d’un sentiment de décalage, avec une réserve explicite. Il prend la présence en boutique pour une preuve de légalité.",
    label: "Tu citais justement des contrôles documentés. “Personne ne contrôle” contredit le point de départ de ton post ; cela ne dit toutefois pas si les contrôles sont suffisants.",
    ban: "Tu avais cité des interdictions datées. Il répond par ton intérêt commercial et la distinction naturel/chimique, qui ne suffit pas à décrire un risque ou un statut légal.",
  }),
  choices: {
    sharp: reply("Le piquer sur sa certitude", "Tu ridiculises son raccourci et le traites d’ignare, au risque d’effacer les distinctions.", "reach",
      "Le rayon d’une boutique n’est pas le Journal officiel, champion. Ton assurance ne fait pas une autorisation, pas plus que le mot “naturel” ne fait un certificat de sécurité. On peut détester mon discours sans inventer la règle qui nous arrange.",
      "La formule du rayon circule, mais Max répond sur ton arrogance. Les lecteurs retiennent une bonne réplique plus facilement que le statut des produits.",
      ["skeptic", "Tu prends les gens de haut pour vendre les mêmes sachets avec un autre discours."], ["sam", "La phrase sur le rayon est juste. L’insulte va surtout occuper les réponses."]),
    explain: reply("Citer interdictions et contrôles", "Tu réponds avec des faits datés sans prétendre que tout est sous contrôle.", "craft",
      "Il y a des interdictions : HHC, HHCO, HHCP en 2023 ; notamment H4-CBD, H2-CBD, THCP en 2024. La Douane a aussi documenté en 2025 des contrôles de faux produits CBD. Ça ne prouve pas que les contrôles suffisent, mais “autorisé parce que vendu” et “jamais contrôlé” sont faux. La composition précise compte ; “naturel” ne garantit pas l’absence de risque.",
      "La discussion devient plus précise sur les moyens de contrôle. Max ne retire pas sa méfiance envers la filière, et les lecteurs demandent maintenant comment vérifier une offre particulière.",
      ["skeptic", "Alors pourquoi on voit encore des offres ? Les contrôles n’attrapent manifestement pas tout."], ["ines", "Je retiens que ni l’étiquette ni la présence en boutique ne répondent à toute la question."]),
    ignore: ignore("Tu ne réponds pas. La confusion reste visible sous ton post, sans correction supplémentaire ; tu évites de consacrer ton énergie à une nouvelle bataille de certitudes."),
  },
}, "x-debate-neo-post");

const neoFinish = {
  challenge: choice("Réclamer des moyens cohérents", "Tu portes une demande de contrôle sans affirmer qu’aucun contrôle n’existe.", "reach",
    "Oui, des interdictions et des contrôles existent. La question que je pose, c’est leur cohérence face aux produits de substitution et aux compositions trompeuses. Je veux que le travail sérieux ait une place et que l’étiquette CBD ne serve pas de couverture à n’importe quoi. Ça mérite des moyens et des réponses, pas une guerre entre toutes les boutiques et tous les producteurs.",
    "Le post mobilise une partie du secteur. D’autres lecteurs demandent des propositions concrètes et refusent que “travail sérieux” soit une étiquette que chacun s’attribue.",
    ["jade", "Des moyens et de la traçabilité, oui. Ça oblige aussi notre propre filière."], ["skeptic", "Tout le monde se dit sérieux. Il faut des preuves sur les produits, pas sur les intentions."]),
  document: choice("Donner des repères sur l’étiquetage", "Tu distingues composition, documents, statut et argument naturel.", "craft",
    "Avant le discours rassurant, je veux des réponses : quelle substance, quel lot, quel document ? Un papier qui ne mesure que le THC ne raconte pas tout ce qu’on a pu ajouter derrière. Le statut dépend aussi de la molécule et du cadre applicable. “Naturel”, “nouveau”, “légal en boutique” : ces mots ne remplacent pas les infos. Aux vendeurs de les rendre compréhensibles.",
    "Les lecteurs disposent de meilleures questions. Certains trouvent ces vérifications décourageantes, et le post ne peut pas résoudre le manque d’informations des vendeurs.",
    ["ines", "Je comprends mieux ce qu’un papier ne dit pas. Ça reste compliqué pour quelqu’un qui achète juste un produit."], ["sam", "C’est aussi à nous, vendeurs, de rendre la composition et les documents compréhensibles."]),
  refocus: choice("Refuser le mélange entre tous les produits", "Tu resserres le message sur la transparence sans rouvrir toute la polémique.", "care",
    "Je ne veux ni diaboliser tous les revendeurs, ni défendre toute offre portant trois lettres CBD. Je demande qu’on sache ce qui est réellement vendu. Une fleur, un produit enrichi et une composition trompeuse ne se discutent pas comme si c’était la même chose.",
    "Tu poses une limite lisible avec peu de temps passé. Le sentiment de deux poids, deux mesures demeure et les lecteurs n’obtiennent pas une méthode complète de vérification.",
    ["sam", "Ça laisse une place aux boutiques qui essaient aussi de faire leur travail."], ["noe", "Et ça ne règle pas le problème des offres opaques. Au moins la demande est claire."]),
};
add("x-debate-neo-after", "x", 3, {
  requirement: "general", arc: neoArc, title: "La composition avant le slogan", image: "still-life",
  body: "Le sentiment d’injustice ne suffit pas à dire qui est contrôlé ou ce qui se trouve dans un produit. Tu peux réclamer des moyens, donner des repères ou recentrer ta demande.",
  audience: "Clients et professionnels qui cherchent autre chose qu’un duel", character: "Ton prochain post", choices: neoFinish,
  continuations: finishBranches({
    sharp: { body: "Tu as répondu à Max sur un ton moqueur. La formule sur le rayon s’est partagée ; Sami t’a prévenu que la pique prenait toute la place. Tu n’as pas donné les dates d’interdiction dans cette réponse et tu ne peux pas prétendre que le dossier est désormais expliqué.", lead: "Ma pique sur le rayon a fait réagir. J’aurais pu me passer du “champion”. Ce qui m’énerve derrière, c’est qu’on continue à mélanger disponibilité, composition et autorisation." },
    explain: { body: "Tu as cité les interdictions et les contrôles documentés. Max conteste maintenant leur efficacité, ce qui est une autre question que leur existence. Inès veut comprendre comment vérifier un produit : l’échange a ouvert un travail supplémentaire, pas produit un accord final.", lead: "J’ai cité des interdictions et des contrôles. La question de leur efficacité reste entière, comme celle de l’information réellement accessible aux clients." },
    ignore: { body: "Tu n’as envoyé aucune réponse. L’interprétation de Max est toujours sous ton post et aucune correction supplémentaire n’a été apportée par toi. Tu peux publier des repères maintenant, sans raconter que tu as déjà démonté son argument.", lead: "Je n’ai pas répondu au commentaire précédent. Ce nouveau post remet la composition et la transparence au centre de ce que je demande." },
  }, neoFinish),
}, "x-debate-neo-reply");

const thresholdArc = "Le taux, le lot et le raccourci";
add("x-debate-thc-post", "x", 1, {
  requirement: "general", arc: thresholdArc, title: "Un chiffre ne raconte pas tout un métier", image: "still-life",
  body: "Tu veux parler de la charge des contrôles pour les chanvriers et du seuil de THC souvent résumé à un chiffre. Tu ne disposes ici d’aucun résultat d’analyse de tes lots : le post doit rester une discussion du cadre, sans fabriquer de contrôle personnel ni de dépassement.",
  audience: "Producteurs, clients et lecteurs qui ne connaissent que le 0,3 %", character: "Ton post sur les contrôles",
  choices: {
    burden: choice("Parler du poids des contrôles", "Tu exprimes la fatigue du secteur sans annoncer qu’un de tes lots a dépassé un seuil.", "reach",
      "On nous parle du taux de THC comme si le boulot des chanvriers tenait dans un seul chiffre. Il y a aussi les prélèvements, le coût des analyses, l’attente, les questions sur un lot. Demander une procédure lisible, ce n’est pas réclamer un passe-droit. J’aimerais qu’on puisse le dire sans être aussitôt soupçonné de magouiller.",
      "Des producteurs reconnaissent la charge du suivi. Max transforme ta demande de clarté en suspicion de lot irrégulier.",
      ["skeptic", "Si tu râles autant sur les contrôles, c’est que ton THC dépasse. Les règles sont les mêmes pour tout le monde."], ["jade", "On peut demander une procédure lisible sans demander que le seuil disparaisse."]),
    context: choice("Remettre le 0,3 % dans son contexte", "Tu refuses d’en faire un seuil universel de sécurité ou une permission pour tout produit.", "craft",
      "Le “0,3 % de THC” revient partout dans les discussions sur le chanvre. Il appartient à un cadre réglementaire précis ; ce n’est ni une garantie générale d’innocuité ni un passeport alimentaire pour n’importe quel produit. Parler d’un seuil sans préciser ce qu’on mesure et le cadre applicable, c’est déjà perdre la moitié du sujet.",
      "Le post soulève des questions utiles. Max cherche à ramener la discussion à un verdict simple sur ton activité, alors que tu n’as fourni aucun résultat de lot.",
      ["skeptic", "Du blabla. En dessous c’est légal, au-dessus c’est de la drogue. Pourquoi faire compliqué ?"], ["ines", "Je pensais justement qu’en dessous de 0,3 %, tout produit CBD était forcément OK."]),
    fairness: choice("Demander une égalité de vigilance", "Tu relies la précision exigée des producteurs à celle attendue de toute la filière.", "care",
      "Je ne demande pas que les chanvriers soient dispensés de contrôles. Je demande la même attention à la composition réelle des produits et aux informations qui circulent, à toutes les étapes. Un seuil THC mérite d’être compris ; il ne doit pas devenir le seul mot de toute la discussion.",
      "La demande touche un petit cercle. Max l’interprète comme une diversion sur les autres acteurs, tandis que Sami accepte qu’elle concerne aussi les revendeurs.",
      ["skeptic", "Le classique “et les autres ?” pour éviter de dire si tes propres lots sont conformes."], ["sam", "Oui pour regarder toute la chaîne. Ça ne remplace aucune obligation pour celui qui produit ou qui vend."]),
  },
});
add("x-debate-thc-reply", "x", 2, {
  requirement: "general", arc: thresholdArc, title: "Un seuil n’est pas un verdict sur tes lots", image: "community",
  body: "Max transforme une discussion du cadre en verdict sur tes lots. Aucun résultat d’analyse n’a été présenté. Tu peux répondre à cette inférence sans fabriquer un certificat ni minimiser un éventuel dépassement.",
  audience: "Lecteurs qui veulent un verdict rapide sur la conformité", character: "Max · @max.sansfiltre", replyTo: { scenarioId: "x-debate-thc-post", commentIndex: 0 },
  continuations: replyBranches("x-debate-thc-post", {
    burden: "Tu parlais de la charge des contrôles pour les chanvriers, sans publier de résultat de lot. Sa suspicion repose sur ton agacement, pas sur une analyse.",
    context: "Tu avais justement expliqué que le cadre et le produit comptaient. Il réduit de nouveau tout à une frontière unique entre légal et illégal.",
    fairness: "Tu avais explicitement maintenu les obligations des producteurs. Il considère ta demande sur l’ensemble de la chaîne comme une esquive de ta situation personnelle.",
  }),
  choices: {
    sharp: reply("Le traiter d’expert de comptoir", "Tu attaques sa certitude et sa façon de déduire la conformité d’un commentaire.", "reach",
      "Tu mesures les taux de THC à l’agacement des producteurs, maintenant ? Belle méthode de laboratoire. Tu n’as aucun résultat sous les yeux et tu distribues déjà les verdicts. L’expertise de comptoir a encore de beaux jours devant elle.",
      "La réponse attire des soutiens fatigués des soupçons. Max réclame tes analyses et des lecteurs prennent ta dureté pour une façon d’éviter la question.",
      ["skeptic", "Donc montre les analyses au lieu de m’insulter."], ["ines", "Il ne peut pas inventer un taux, d’accord. Mais ton ton ne m’aide pas à comprendre le seuil."]),
    explain: reply("Séparer soupçon, mesure et règle", "Tu précises ce que le post ne permet pas d’établir, sans déclarer tes lots conformes.", "craft",
      "Tu n’as pas de résultat sur mes lots sous les yeux. Tu ne peux donc pas conclure à leur place. Le fameux 0,3 % s’inscrit dans un cadre précis : il ne rend pas n’importe quel produit autorisé, encore moins automatiquement alimentaire. Pour discuter d’un résultat, il faut le lot, la mesure et la règle. Et je ne vais pas répondre “un peu au-dessus, ce n’est rien” : ce serait un autre raccourci.",
      "La limite des informations devient claire. Max reste sur sa demande de preuve, et les lecteurs comprennent que cette discussion ne certifie aucun produit.",
      ["skeptic", "Très bien, mais si tu vends, les infos sur le lot devront exister. Un débat ne les remplace pas."], ["ines", "Je retiens surtout que ce chiffre ne suffit pas à valider tout ce qu’on met sous l’étiquette CBD."]),
    ignore: ignore("Tu ne réponds pas. Aucun taux ni résultat personnel n’est établi par ce silence ; le soupçon reste visible et tu économises le temps d’une explication."),
  },
}, "x-debate-thc-post");

const thresholdFinish = {
  challenge: choice("Défendre le droit de critiquer le cadre", "Tu refuses qu’une demande de clarté soit présentée comme un aveu.", "reach",
    "Un producteur peut réclamer des procédures compréhensibles sans avouer une fraude. Les contrôles ont leur place, la critique des règles aussi. Je ne demande pas qu’on efface un dépassement éventuel ; je refuse qu’un commentaire agacé devienne un résultat de laboratoire imaginaire.",
    "Le message fait réagir au-delà des habitués. Le ton reste conflictuel et ne répond pas aux demandes d’informations sur des produits précis.",
    ["jade", "Le droit de critiquer reste. Il faut aussi pouvoir répondre aux questions factuelles sans y voir une accusation."], ["skeptic", "Personne n’a dit qu’un post remplaçait les infos que tu dois fournir sur ce que tu vends."]),
  document: choice("Donner les bonnes questions sur une analyse", "Tu expliques les limites d’un chiffre isolé sans inventer un bulletin pour ton exploitation.", "craft",
    "Un pourcentage en gros sur une capture d’écran, ça ne me suffit pas. Quel lot ? Prélevé quand, comment, pour mesurer quoi ? Et quelle règle s’applique au produit dont on parle ? Ce sont les questions qu’on devrait avoir avant de s’écharper. Au passage : le 0,3 % n’est pas un feu vert général pour mettre du CBD dans l’alimentaire.",
    "Les lecteurs acquièrent des repères pour examiner une information. Ce travail est moins spectaculaire et ne dispense jamais de vérifier le document réel d’un produit donné.",
    ["ines", "Je regarderai à quoi le document correspond, pas juste le chiffre mis en gros."], ["sam", "Le lien entre document et lot, c’est une responsabilité concrète pour toute la chaîne."]),
  refocus: choice("Clore sans inventer de verdict", "Tu maintiens ta demande de clarté et tu arrêtes l’échange sur une limite factuelle.", "care",
    "Je vais m’arrêter là. Un fil de commentaires n’est pas un labo, et mon humeur n’est pas un résultat d’analyse. Je reste pour des contrôles cohérents et des procédures qu’on puisse comprendre. On peut être d’accord là-dessus ou pas ; je ne passerai pas ma soirée à défendre un taux que personne n’a présenté ici.",
    "Tu économises du temps et tu ne fabriques aucune preuve. Les lecteurs intéressés par la procédure devront chercher des informations plus détaillées.",
    ["noe", "Au moins le fil ne finit pas avec un taux inventé pour gagner la dispute."], ["skeptic", "Ça ne répond pas à toutes les questions, mais je n’ai pas de résultat à citer non plus."]),
};
add("x-debate-thc-after", "x", 3, {
  requirement: "general", arc: thresholdArc, title: "Un fil de discussion n’est pas une analyse", image: "still-life",
  body: "Le prochain post doit préserver une limite : aucun résultat de tes lots n’a été fourni. Tu peux défendre une position et donner des repères sans fabriquer la preuve que les commentaires réclament.",
  audience: "Professionnels et clients qui attendent une information vérifiable", character: "Ton prochain post", choices: thresholdFinish,
  continuations: finishBranches({
    sharp: { body: "Tu as renvoyé Max à son expertise de comptoir. Il réclame maintenant les analyses et Inès dit ne pas mieux comprendre le seuil. La réplique a attiré des réactions, mais elle n’a produit aucune information sur un lot ni expliqué le cadre.", lead: "Ma vanne sur sa méthode de laboratoire a fait partir le fil de travers. Je suis toujours agacé, mais ça mérite mieux qu’un échange de piques." },
    explain: { body: "Tu as séparé la mesure d’un lot, la règle applicable et le soupçon public. Max maintient sa demande d’informations si tu vends ; Inès a compris que le seuil ne valide pas tout produit CBD. Tu n’as déclaré aucun lot conforme ou irrégulier.", lead: "J’ai répondu sur le seuil et sur ce qu’on peut réellement conclure. Ça n’a pas mis tout le monde d’accord. Au moins, on peut maintenant poser les bonnes questions." },
    ignore: { body: "Tu n’as publié aucune réponse au commentaire. Son soupçon reste visible, sans preuve supplémentaire ; ton silence n’établit aucun taux. Tu peux maintenant donner une limite factuelle dans un nouveau post.", lead: "J’ai laissé le commentaire sans réponse. Inutile de lire un aveu dans mon silence : je n’ai simplement pas répondu. Je reviens au sujet des contrôles." },
  }, thresholdFinish),
}, "x-debate-thc-reply");

export const KQ_SOCIAL_INITIAL_DEBATE_SCENARIOS: KqSocialScenario[] = [...scenarios, ...KQ_SOCIAL_COMMUNITY_DEBATE_SCENARIOS];
export const KQ_SOCIAL_DEBATE_SCENARIOS: KqSocialScenario[] = [...KQ_SOCIAL_INITIAL_DEBATE_SCENARIOS, ...KQ_SOCIAL_GROWER_SCENARIOS, ...KQ_SOCIAL_COMMUNITY_MORE_DEBATE_SCENARIOS];
export const KQ_SOCIAL_DEBATE_NARRATIVES: Record<string, KqSocialProducerNarrative> = { ...narratives, ...KQ_SOCIAL_COMMUNITY_DEBATE_NARRATIVES, ...KQ_SOCIAL_GROWER_NARRATIVES, ...KQ_SOCIAL_COMMUNITY_MORE_DEBATE_NARRATIVES };
