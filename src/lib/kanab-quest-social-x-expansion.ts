import { socialChoice as choice, socialGrowth as growth, type KqSocialContentMessage, type KqSocialContentPerson, type KqSocialStoryContent } from "./kanab-quest-social-content";
import type { KqSocialEffects } from "./kanab-quest-social-types";

type Continuation = { fromScenarioId: string; fromChoiceId: string; body: string; choiceModifiers: Record<string, Partial<KqSocialEffects>>; message: KqSocialContentMessage };
const message = (id: string, person: KqSocialContentPerson, text: string, kind: "reply" | "quote" = "reply"): KqSocialContentMessage => ({ id, person, text, kind });
function after(fromScenarioId: string, fromChoiceId: string, body: string, choiceModifiers: Continuation["choiceModifiers"], person: KqSocialContentPerson, text: string, kind: "reply" | "quote" = "reply"): Continuation {
  return { fromScenarioId, fromChoiceId, body, choiceModifiers, message: message(`branch-${fromScenarioId}-${fromChoiceId}`, person, text, kind) };
}
/** A continuation and its visible reply always share the same saved choice. */
function story(content: KqSocialStoryContent, continuations: Continuation[] = []): KqSocialStoryContent {
  if (!continuations.length) return content;
  return { ...content, scenario: { ...content.scenario, followups: continuations.map(({ fromScenarioId, fromChoiceId, body, choiceModifiers }) => ({ fromScenarioId, fromChoiceId, body, choiceModifiers })) }, branches: continuations.map(({ fromScenarioId, fromChoiceId, message: reply }) => ({ fromScenarioId, fromChoiceId, message: reply })) };
}

export const KQ_SOCIAL_X_EXPANSION: KqSocialStoryContent[] = [
  story({
    scenario: {
      id: "x-archive-resurfaces", platform: "x", arc: "Le passé dans le fil", episode: 1,
      character: "Noé · voisin à l’humour sec", title: "Une vieille phrase, une nouvelle foule",
      audience: "Des lecteurs récents qui découvrent une ancienne opinion",
      body: "Un ancien message d’atelier ressort dans une capture. Tu y défendais une méthode que tu as depuis abandonnée. La date manque, et le fil traite cette phrase comme ton avis du jour. Noé retrouve l’original : « Ton ancien toi a pris rendez-vous sans te prévenir. » Il faut choisir comment accueillir cette visite.",
      choices: [
        choice("timeline", "Remettre les étapes dans l’ordre", "Tu rapproches l’ancien essai, le problème rencontré et la méthode que tu utilises aujourd’hui.", "Une évolution que les lecteurs peuvent comprendre.", "Retrouver les pièces prend du temps et du mental.", "Le fil retrouve une chronologie. Des curieux viennent pour la façon dont tu as changé de méthode ; quelques comptes préfèrent encore opposer les deux phrases.", "craft", "craft", [9, 17, 2, 6, 0, -24]),
        choice("headline", "Assumer le changement en une phrase", "Tu reprends la capture avec une formule visible sur le droit de changer d’avis.", "Une réponse qui peut dépasser ton cercle.", "La formule relance aussi les jugements sur ta cohérence.", "Ta réponse circule avec l’ancienne capture. Elle fait découvrir ton compte, mais le débat sur ta cohérence passe parfois devant l’histoire de l’essai.", "reach", "dialogue", [17, 25, 12, -3, 0, -20]),
        choice("date", "Ajouter la date puis refermer", "Tu précises que le message est ancien et indiques brièvement que ta pratique a changé.", "Une limite claire sans reprendre chaque discussion.", "Peu de nouveaux lecteurs suivront cette précision.", "Les habitués disposent d’un repère et les relances perdent de la place. La précision voyage peu, mais tu ne passes pas la journée avec ton ancien message.", "care", "community", [0, 2, -11, 2, 0, -7]),
      ],
    },
    feed: { author: "noe", image: "still-life", caption: "{{player}}, ton ancien avis vient d’arriver dans le fil avec une valise et sans date. J’ai retrouvé le message entier.", comments: [message("archive-ines", "ines", "Je découvre la capture. C’est encore ta méthode ou un ancien essai ?"), message("archive-sam", "sam", "Un changement de méthode m’intéresse plus qu’un concours de phrases anciennes.", "quote")], choicePosts: {
      timeline: "Je remets les étapes : je défendais cette méthode, un essai m’en a montré la limite, puis j’ai changé ma pratique. Voici ce qui relie les deux versions de mon avis.",
      headline: "Oui, j’ai changé d’avis. Mon atelier avance justement quand une idée cesse de fonctionner ; une vieille capture ne devrait pas devenir une consigne à vie.",
      date: "Cette capture vient d’un ancien message. Ma pratique a changé depuis ; je précise ce point ici, puis je laisse la discussion sans répondre à chaque reprise.",
    } },
  }),
  story({
    scenario: {
      id: "x-archive-context", platform: "x", arc: "Le passé dans le fil", episode: 2,
      character: "Sami · artisan qui questionne le fond", title: "La pièce qui manque",
      audience: "Des lecteurs qui veulent distinguer évolution et pirouette",
      body: "Sami retrouve un détail : le matériel utilisé à l’époque n’était pas le même. La discussion peut enfin porter sur une contrainte précise. Mais les citations les plus courtes continuent leur tournée. « On remet la pièce dans la machine ou on lui organise une conférence ? » demande Noé.",
      choices: [
        choice("caption", "Une légende de contexte, puis stop", "Tu ajoutes la différence de matériel dans un message bref qui restera accessible.", "Moins de sollicitations et un repère simple.", "Le détail utile attirera peu de nouveaux abonnés.", "La différence de matériel est désormais lisible. Les habitués peuvent y renvoyer les nouveaux venus, tandis que tu laisses s’éteindre les discussions circulaires.", "care", "community", [0, 3, -10, 3, 0, -7]),
        choice("contrast", "Faire circuler le contraste", "Tu opposes les deux configurations dans une formule qui invite le public à réagir.", "Un détail concret donne une prise à la discussion.", "La comparaison peut redevenir un procès de tes anciens choix.", "Le contraste ramène des lecteurs vers ton fil. Certains découvrent la contrainte ; d’autres reviennent surtout distribuer les bons et les mauvais points.", "reach", "dialogue", [16, 24, 11, -2, 0, -19]),
        choice("conditions", "Comparer les conditions de l’essai", "Tu expliques ce que le matériel change et ce qui resterait vrai avec la même installation.", "Un raisonnement vérifiable et davantage de confiance.", "La comparaison demande une préparation attentive.", "Sami peut discuter d’une hypothèse précise. Les lecteurs intéressés suivent ton raisonnement, même si les comptes pressés par le verdict lisent moins loin.", "craft", "craft", [10, 18, 2, 7, 0, -25]),
      ],
    },
    feed: { author: "sam", image: "workshop", caption: "Le matériel n’était pas le même pendant ton ancien essai. Qu’est-ce que cette différence explique, et qu’est-ce qu’elle n’explique pas ?", comments: [message("archive-context-ines", "ines", "Voilà le détail qui manquait à la capture."), message("archive-context-noe", "noe", "Le contexte : cet accessoire qu’on oublie toujours dans le carton.")], choicePosts: {
      caption: "Précision utile : les deux essais n’utilisent pas le même matériel. Cela explique une partie du changement ; je garde ce repère ici et je referme les relances.",
      contrast: "Deux installations différentes, une capture qui les traite comme la même : c’est là que le raccourci commence. Qu’est-ce qui changerait votre choix avec ce détail ?",
      conditions: "Je compare les conditions : ce que le nouveau matériel modifie, ce qui reste identique et la conclusion que je peux raisonnablement en tirer.",
    } },
  }, [
    after("x-archive-resurfaces", "timeline", "Ta chronologie a permis à Sami de repérer le changement de matériel. Tu disposes déjà des notes ; il reste à séparer ce détail des autres causes possibles. Noé regarde la discussion : « On commence à parler de l’atelier. Je n’ose plus bouger. »", { conditions: growth(2, 3, { energy: 2 }), caption: { trust: 1 } }, "sam", "Dans ta chronologie, le matériel change juste avant le résultat. On peut examiner ce point sans repartir de zéro."),
    after("x-archive-resurfaces", "headline", "Ta formule sur le droit de changer d’avis est reprise sans l’histoire de l’essai. Sami retrouve le matériel utilisé à l’époque et propose un point d’appui plus précis. La comparaison profite de l’attention présente, mais expliquer les conditions demandera de ralentir le fil.", { contrast: growth(2, 3, { haters: 2 }), conditions: { trust: 2, energy: -1 } }, "noe", "Ta formule voyage bien. Le changement de matériel voyage moins ; on lui trouve une place à côté ?", "quote"),
    after("x-archive-resurfaces", "date", "Tu avais laissé une date et refermé le fil. Sami revient avec une question précise sur le matériel, sans réclamer de nouvelles réponses à tout le monde. Tu peux compléter ton repère ou rouvrir un échange choisi. La limite que tu as annoncée tient toujours.", { caption: { haters: -2, trust: 1 }, conditions: { energy: 2 } }, "sam", "J’ai vu ta limite. Une seule question utile : est-ce le même matériel dans les deux essais ?"),
  ]),
  story({
    scenario: {
      id: "x-archive-correction", platform: "x", arc: "Le passé dans le fil", episode: 3,
      character: "Inès · lectrice du quartier", title: "Laisser une trace juste",
      audience: "Les personnes qui tomberont sur le sujet après la conversation",
      body: "Inès veut garder un lien vers ta conclusion, mais ne sait pas quelle version choisir. Tu peux transformer cet épisode en prise de position, en note de correction ou en simple repère. Noé a déjà trouvé le titre de son dossier : « Affaire classée, étagère encore en désordre. »",
      choices: [
        choice("lesson", "Défendre le droit de réviser", "Tu tires du sujet une prise de position publique sur l’apprentissage par les erreurs.", "Une idée accessible à un public plus large.", "La discussion repart au-delà du cas d’atelier.", "La prise de position attire de nouveaux regards. Le sujet devient plus général, et certains lecteurs débattent de ta posture plutôt que de la correction elle-même.", "reach", "dialogue", [18, 26, 13, -3, 0, -21]),
        choice("record", "Publier une note de correction", "Tu réunis l’ancien propos, ce qui change et les incertitudes encore ouvertes.", "Un document cohérent auquel revenir.", "La synthèse demande un dernier effort important.", "Inès garde une note qui se suffit à elle-même. Des lecteurs apprécient la correction explicite, pendant que le fil retrouve une discussion plus exigeante et plus lente.", "craft", "craft", [9, 17, 1, 7, 0, -24]),
        choice("close", "Épingler le repère et repartir", "Tu relies la précision au message ancien, puis annonces le retour aux sujets courants.", "Un sujet refermé sans effacer la correction.", "La conclusion offre peu de découverte du compte.", "Les lecteurs tardifs trouvent le repère. Le sujet perd sa place dans tes notifications et tu reprends le rythme de l’atelier sans préparer une grande conclusion.", "care", "community", [0, 2, -12, 2, 0, -6]),
      ],
    },
    feed: { author: "ines", image: "still-life", caption: "Je voudrais garder ta conclusion, {{player}}. Quel message permettra de comprendre sans lire toute la conversation ?", comments: [message("archive-close-noe", "noe", "Je demande un dossier avec une fin. Le carton des affaires toujours ouvertes est plein."), message("archive-close-sam", "sam", "La conclusion peut garder une incertitude. C’est parfois ce qui la rend utile.")], choicePosts: {
      lesson: "Je préfère montrer comment mon avis a changé que défendre une ancienne phrase pour la forme. On devrait pouvoir apprendre en public sans prétendre avoir toujours su.",
      record: "Correction : mon ancien propos était trop large. Les conditions de l’essai expliquent mon changement ; voici ce que je retiens et ce que je n’ai pas encore vérifié.",
      close: "Je relie la précision au message ancien pour les lecteurs qui arriveront plus tard. Le repère reste accessible ; je retourne maintenant aux sujets courants de l’atelier.",
    } },
  }, [
    after("x-archive-context", "caption", "Ta légende de contexte sert déjà de réponse aux questions répétées. Inès demande seulement quel message garder. Une conclusion brève peut suffire ; un document plus complet serait possible sans prétendre que tu avais promis une nouvelle série.", { close: { energy: 1, haters: -1 }, record: { trust: 1 } }, "ines", "Ta précision suffit à comprendre l’essentiel. Dis-moi juste où la retrouver plus tard."),
    after("x-archive-context", "contrast", "Ton contraste entre les deux installations continue d’être cité. Inès veut un repère qui ne dépend pas de la polémique. Une prise de position profiterait de cette circulation, tandis qu’une note complète devrait distinguer soigneusement ce que la formule avait rapproché.", { lesson: growth(2, 3, { haters: 2 }), record: { trust: 2, energy: -1 } }, "noe", "Le contraste circule encore. Pour la conclusion, on peut aussi offrir autre chose qu’un nouveau match.", "quote"),
    after("x-archive-context", "conditions", "Ta comparaison des conditions a clarifié l’essai. Inès souhaite la garder sous une forme autonome ; Sami a déjà relu le point qui le faisait hésiter. La matière est prête pour une note, ou pour une fermeture simple accompagnée de la bonne référence.", { record: growth(2, 3, { energy: 2 }), close: { trust: 1 } }, "sam", "Ta comparaison est claire. La note finale peut reprendre le raisonnement sans ajouter un nouveau débat."),
  ]),
  story({
    scenario: {
      id: "x-number-viral", platform: "x", arc: "Le chiffre qui court", episode: 1,
      character: "Sami · artisan qui questionne le fond", title: "Une statistique sans ses bagages",
      audience: "Des lecteurs attirés par une affirmation simple sur les ateliers",
      body: "Un visuel affirme qu’une méthode réussit presque toujours, sans préciser ce qui a été mesuré. On te demande ton avis parce que cela ressemble à ton métier. Sami cherche la source ; Noé cherche le bas du graphique. « Il a peut-être été coupé avec les nuances. » Tu peux choisir le rythme de ta réponse.",
      choices: [
        choice("question", "Interroger la certitude en public", "Tu contestes la formule trop générale et invites le fil à regarder ce qu’elle cache.", "Un angle clair qui peut être beaucoup repris.", "La critique devient visible avant l’examen de la source.", "La question attire des lecteurs et des objections. Certains restent pour comprendre ; d’autres viennent défendre le chiffre ou ta critique comme deux camps opposés.", "reach", "dialogue", [17, 25, 12, -3, 0, -20]),
        choice("wait", "Dire ce que tu ne sais pas encore", "Tu déclines la conclusion immédiate et annonces que tu attends le document d’origine.", "Une limite honnête avec peu de pression.", "Le sujet circule sans beaucoup mettre ton compte en avant.", "Les habitués savent que tu n’endosses pas le chiffre. La discussion ralentit autour de toi, sans grande arrivée de lecteurs en quête d’un verdict.", "care", "community", [0, 2, -10, 2, 0, -6]),
        choice("trace", "Remonter au document d’origine", "Tu distingues le visuel partagé, sa source déclarée et ce que celle-ci mesure réellement.", "Des lecteurs peuvent suivre ta vérification.", "La recherche coûte du mental avant de donner une conclusion.", "Ton cheminement intéresse les lecteurs du fond. Le chiffre perd son évidence, mais la vérification demande plus d’attention qu’une réponse immédiatement tranchée.", "craft", "craft", [10, 18, 2, 6, 0, -25]),
      ],
    },
    feed: { author: "sam", image: "still-life", caption: "Ce graphique promet beaucoup et précise très peu. Avant d’en faire une règle pour les ateliers : qu’est-ce qui a été mesuré ?", comments: [message("number-ines", "ines", "J’ai partagé l’image pour poser la question, pas pour certifier le résultat."), message("number-noe", "noe", "Le graphique a un grand titre. La source, elle, a pris un congé.", "quote")], choicePosts: {
      question: "Une méthode qui réussirait presque toujours : presque où, pour qui et avec quel critère ? Cette formule ne suffit pas à me convaincre, même si elle tient très bien dans une image.",
      wait: "Je n’ai pas encore le document qui permettrait de juger ce chiffre. Je garde la question ouverte et je ne transforme pas le visuel en conseil pour l’atelier.",
      trace: "Je remonte le chemin du chiffre : le visuel partagé, le document annoncé et la définition du résultat. Je vous montre ce que je peux vérifier, sans combler les trous.",
    } },
  }),
  story({
    scenario: {
      id: "x-number-source", platform: "x", arc: "Le chiffre qui court", episode: 2,
      character: "Inès · lectrice qui veut comprendre", title: "Le tableau raconte autre chose",
      audience: "Des lecteurs qui hésitent entre la formule et le document complet",
      body: "Le document apparaît enfin. Il décrit un groupe d’ateliers volontaires et mesure leur satisfaction, pas la réussite de leur production. Inès regarde le titre du visuel : « Le chiffre est parti en promenade avec le mauvais prénom. » Reste à rendre cette différence compréhensible sans lui faire dire l’inverse de ce qu’il dit.",
      choices: [
        choice("measure", "Expliquer la mesure et ses limites", "Tu sépares satisfaction, résultat technique et choix des ateliers interrogés.", "Un cadre solide pour interpréter le document.", "L’explication exige de ralentir et de préparer un exemple.", "Les lecteurs distinguent enfin les deux questions. Le document garde son intérêt, sans servir de preuve à une promesse qu’il ne testait pas.", "craft", "craft", [9, 17, 1, 7, 0, -24]),
        choice("note", "Corriger l’étiquette simplement", "Tu signales que le chiffre porte sur la satisfaction et laisses le document accessible.", "Une correction précise qui limite les relances.", "Elle attire peu de personnes au-delà du fil existant.", "Inès peut corriger sa présentation. La précision ne transforme pas le sujet en grand débat, et tu gardes de l’énergie pour ton travail.", "care", "community", [0, 3, -11, 3, 0, -7]),
        choice("mislabel", "Faire du mauvais titre le sujet", "Tu formules publiquement l’écart entre la promesse du visuel et la mesure réelle.", "Une différence frappante, facile à transmettre.", "La formule peut entraîner un rejet trop général du document.", "La différence de titre se partage facilement. Des lecteurs découvrent ton compte, mais certains réduisent maintenant tout le document à une tromperie que tu n’as pas démontrée.", "reach", "dialogue", [18, 26, 13, -3, 0, -21]),
      ],
    },
    feed: { author: "ines", image: "still-life", caption: "J’ai le document : il parle de satisfaction déclarée. Le visuel promettait une réussite technique. Ce n’est pas la même question.", comments: [message("number-source-sam", "sam", "Et les ateliers se sont portés volontaires. Cela compte pour interpréter les réponses."), message("number-source-noe", "noe", "Le tableau n’est pas coupable de toutes les ambitions de son titre.")], choicePosts: {
      measure: "Le document mesure une satisfaction déclarée dans des ateliers volontaires. Je sépare cette information du résultat technique qu’on lui fait annoncer : l’une ne prouve pas automatiquement l’autre.",
      note: "Correction de lecture : ce chiffre concerne la satisfaction, pas une garantie de réussite technique. Je garde le document comme repère et je m’arrête à cette précision.",
      mislabel: "Le titre promet un résultat ; le document mesure un ressenti. Voilà le décalage à retenir avant de reprendre cette image comme une règle pour tous les ateliers.",
    } },
  }, [
    after("x-number-viral", "question", "Ta contestation publique a attiré des lecteurs qui attendent une erreur flagrante. Le document montre surtout un changement de question entre la mesure et le visuel. Tu peux rendre cet écart visible, ou prendre le temps de décevoir l’envie d’un verdict trop simple.", { mislabel: growth(2, 3, { haters: 2 }), measure: { trust: 2, energy: -1 } }, "sam", "Ta question sur le critère était la bonne. Attention à ne pas conclure maintenant que le document ne vaut rien."),
    after("x-number-viral", "wait", "Tu avais attendu la source avant de conclure. Inès l’apporte sans exiger un verdict complet : la différence entre satisfaction et réussite suffit déjà à corriger le visuel. Tu peux rester dans ce cadre ou choisir de développer ce que la mesure permet de dire.", { note: { energy: 1, trust: 1 }, measure: { energy: 2 } }, "ines", "Tu attendais le document : le voici. Il permet au moins de nommer correctement ce qui a été mesuré."),
    after("x-number-viral", "trace", "Ton chemin de vérification mène au document d’origine. Les lecteurs savent déjà d’où vient le chiffre ; il reste à expliquer pourquoi satisfaction et réussite ne sont pas interchangeables. Sami retrouve un exemple d’atelier qui rend la différence plus concrète.", { measure: growth(2, 3, { energy: 2 }), note: { trust: 1 } }, "sam", "Ta vérification a fait le plus long trajet. On peut maintenant expliquer la mesure avec un exemple simple."),
  ]),
  story({
    scenario: {
      id: "x-number-nuance", platform: "x", arc: "Le chiffre qui court", episode: 3,
      character: "Noé · voisin qui surveille les raccourcis", title: "Pas de règle magique, même à l’envers",
      audience: "Des lecteurs qui veulent une conclusion utilisable sans faux raccourci",
      body: "Le fil demande maintenant si la méthode est donc inutile. Sami soupire : « On n’a pas vérifié cette question non plus. » Tu peux proposer un autre slogan, construire une façon de lire les chiffres ou laisser une conclusion modeste. Noé prépare une pancarte : « Sortie des certitudes par ici. »",
      choices: [
        choice("limit", "Laisser une conclusion limitée", "Tu résumes ce qu’on a appris et refuses de décider si la méthode est bonne dans tous les cas.", "Moins de pression, une limite reconnue.", "La conclusion fera peu voyager ton compte.", "Le fil dispose d’une conclusion sans promesse générale. Les relances ralentissent, même si les amateurs de réponse définitive passent à une autre discussion.", "care", "community", [0, 2, -12, 3, 0, -7]),
        choice("checklist", "Donner des questions de lecture", "Tu proposes un petit guide : qui répond, qu’est-ce qu’on mesure, et à quoi le résultat s’applique.", "Une ressource qui renforce la confiance.", "La mise en forme demande un vrai dernier effort.", "Les lecteurs repartent avec des questions à poser aux prochains graphiques. Ton travail attire une audience attentive, sans offrir le verdict spectaculaire attendu par d’autres.", "craft", "craft", [10, 18, 2, 7, 0, -26]),
        choice("motto", "Faire circuler une règle de prudence", "Tu proposes une formule mémorable sur les chiffres qui promettent plus que leur mesure.", "Une conclusion facile à reprendre.", "La prudence elle-même risque de devenir un slogan méfiant.", "Ta formule dépasse le fil initial. Elle invite à regarder les sources, mais certains la reprennent pour rejeter des chiffres sans les examiner.", "reach", "dialogue", [17, 25, 11, -2, 0, -20]),
      ],
    },
    feed: { author: "noe", image: "still-life", caption: "Le fil est passé de « ça marche toujours » à « ça ne sert à rien ». Le document n’avait demandé aucun de ces deux emplois.", comments: [message("number-nuance-sam", "sam", "On a corrigé la portée d’un chiffre, pas testé toute la méthode."), message("number-nuance-ines", "ines", "J’aimerais surtout savoir quelles questions poser la prochaine fois.")], choicePosts: {
      limit: "Je conclus seulement ceci : le visuel dépassait ce que le document mesurait. Je n’en déduis ni une garantie de réussite, ni l’inutilité de la méthode.",
      checklist: "Mon petit repère de lecture : qui a répondu, à quelle question et dans quelles conditions ? Je garde ces questions avant d’appliquer un chiffre à mon propre atelier.",
      motto: "Un chiffre ne devient pas une garantie parce que son titre parle fort. Je veux d’abord voir ce qu’il mesure, puis discuter de ce qu’on peut en faire.",
    } },
  }, [
    after("x-number-source", "measure", "Ton explication a séparé satisfaction et résultat technique. Inès veut garder les questions qui t’ont permis de lire le document. Le travail de fond est prêt pour un guide ; tu peux aussi clore sans prolonger un sujet déjà compris.", { checklist: growth(2, 3, { energy: 2 }), limit: { trust: 1 } }, "ines", "La différence entre les mesures est claire. Je garderais volontiers les questions qui t’ont permis de la voir."),
    after("x-number-source", "note", "Ta correction a été ajoutée à la présentation d’Inès. Quelques lecteurs arrivent encore avec une demande de verdict général. Tu n’avais promis qu’une précision : la rappeler suffit, même si tu peux choisir d’en faire un repère plus développé.", { limit: { haters: -1, energy: 1 }, checklist: { trust: 1 } }, "ines", "J’ai corrigé la présentation. Tu n’as pas besoin de transformer cette précision en expertise de toute la méthode."),
    after("x-number-source", "mislabel", "Ta formule sur le mauvais titre circule. Certains lecteurs en ont déduit que tout le document était inutile. Noé te montre la nouvelle version : « Le raccourci vient de faire demi-tour. » Reprendre la nuance demandera davantage d’attention qu’un slogan supplémentaire.", { motto: growth(2, 3, { haters: 2 }), checklist: { trust: 2, energy: -1 }, limit: { haters: -1 } }, "noe", "Ta formule a trouvé son public. Une partie en a fait « tous les chiffres mentent », ce qui n’était pas le programme.", "quote"),
  ]),
  story({
    scenario: {
      id: "x-double-account", platform: "x", arc: "Le compte qui te ressemble", episode: 1,
      character: "Inès · lectrice attentive aux détails", title: "Le mauvais portrait, la bonne confusion",
      audience: "Des habitués qui cherchent à reconnaître ta parole",
      body: "Dans cette scène du jeu, un compte reprend ton nom d’atelier et une présentation ressemblante. Il donne des avis que tu n’as pas publiés. Inès t’apporte la capture sans relayer son adresse. Noé examine le texte : « Il a copié le décor. La ponctuation a pris son indépendance. » Comment rendre ta voix identifiable ?",
      choices: [
        choice("notice", "Poser un avis bref sur ton compte", "Tu précises que les messages de l’autre compte ne viennent pas de toi, sans le mettre en vitrine.", "Un repère calme qui rassure les habitués.", "L’avis dépassera peu ta communauté actuelle.", "Les habitués trouvent la précision sans devoir chercher l’autre compte. La confusion prend moins de place dans tes échanges, avec peu de nouvelles découvertes du tien.", "care", "community", [0, 2, -10, 3, 0, -6]),
        choice("landmark", "Construire un repère de reconnaissance", "Tu expliques où retrouver tes annonces et comment distinguer une citation de ta propre parole.", "Une référence durable qui renforce la confiance.", "La préparation et les questions demandent du mental.", "Les lecteurs disposent d’un repère plus solide qu’une ressemblance visuelle. L’explication attire des curieux attentifs, tout en ouvrant quelques questions de suivi.", "craft", "craft", [8, 16, 2, 7, 0, -24]),
        choice("public", "Prendre la parole bien en vue", "Tu annonces publiquement la confusion et défends ta propre voix sans nommer ni cibler l’autre compte.", "Ta clarification peut toucher les lecteurs extérieurs.", "La visibilité attire aussi spéculations et provocations.", "Ta clarification circule au-delà des habitués. Des personnes découvrent ton compte, mais certaines cherchent désormais une affaire à commenter plutôt que ton travail.", "reach", "dialogue", [16, 24, 13, -3, 0, -21]),
      ],
    },
    feed: { author: "ines", image: "workshop", caption: "{{player}}, cette présentation ressemble à ton atelier, mais le message ne ressemble pas à ta façon de parler. Je te demande ici sans partager l’adresse du compte.", comments: [message("double-sam", "sam", "Un nom proche ne suffit pas à attribuer des propos à quelqu’un."), message("double-noe", "noe", "On peut éclaircir sans envoyer tout le quartier visiter le faux décor.")], choicePosts: {
      notice: "Petite précision : les messages du compte ressemblant au mien ne viennent pas de moi. Mes annonces restent ici ; inutile d’aller lui apporter une nouvelle conversation.",
      landmark: "Je pose un repère : mes annonces d’atelier sont publiées sur ce fil. Une capture ou un nom ressemblant ne vaut pas confirmation ; je distinguerai toujours mes propos des citations.",
      public: "Une présentation ressemblante ne parle pas à ma place. Je reprends la parole ici pour lever la confusion, sans nommer le compte ni inviter quiconque à l’interpeller.",
    } },
  }),
  story({
    scenario: {
      id: "x-double-channel", platform: "x", arc: "Le compte qui te ressemble", episode: 2,
      character: "Noé · voisin qui préfère les repères au bruit", title: "Où chercher la bonne version ?",
      audience: "Des lecteurs qui veulent vérifier une annonce sans nourrir la confusion",
      body: "Les lecteurs demandent maintenant où retrouver une annonce fiable. Certains comparent les photos, d’autres la tournure des phrases. Noé propose un repère simple : « On peut vérifier ce qui est publié ici, sans inventer une science du point-virgule. » Tu dois choisir comment rendre ce repère visible et tenable.",
      choices: [
        choice("guide", "Expliquer le parcours de vérification", "Tu distingues une annonce sur ton fil, une reprise par un tiers et une information encore incertaine.", "Des lecteurs autonomes et davantage de confiance.", "Il faut expliquer le cadre sans promettre une permanence.", "Les questions deviennent plus précises. Le guide donne des repères aux lecteurs qui hésitaient, au prix d’une préparation attentive et de quelques objections de détail.", "craft", "craft", [9, 17, 2, 6, 0, -25]),
        choice("signal", "Faire une annonce reconnaissable", "Tu donnes un titre court à tes annonces et invites le public à revenir au message d’origine.", "Un signal facile à retenir et à transmettre.", "Le titre peut devenir plus visible que ses précautions.", "Le signal est repris et amène de nouveaux lecteurs. Certaines réponses cherchent toutefois une garantie absolue que ton simple repère ne peut pas fournir.", "reach", "dialogue", [17, 25, 11, -2, 0, -20]),
        choice("pinned", "Épingler un repère minimal", "Tu gardes une explication courte au même endroit et limites les réponses aux questions nouvelles.", "Moins de répétitions et une limite lisible.", "Le fil gagnera peu en portée.", "Les habitués savent où renvoyer les questions récurrentes. La pression baisse et le compte reste accessible sans devenir un guichet ouvert en continu.", "care", "community", [0, 3, -12, 2, 0, -7]),
      ],
    },
    feed: { author: "noe", image: "still-life", caption: "On cherche un repère pour les annonces de {{playerAtelier}}, pas une expertise en moustaches de photo de profil. Qu’est-ce qu’on peut vérifier simplement ?", comments: [message("double-channel-ines", "ines", "Revenir au message d’origine me paraît plus utile que comparer des captures."), message("double-channel-sam", "sam", "Et une information non confirmée peut rester non confirmée.")], choicePosts: {
      guide: "Je distingue trois choses : ce que je publie ici, ce qu’un tiers en rapporte et ce que je n’ai pas confirmé. Le retour au message d’origine aide à garder ces différences.",
      signal: "Le repère à retenir : une annonce d’atelier se lit ici, dans son contexte. Avant de reprendre une capture, revenons à la version que j’ai réellement publiée.",
      pinned: "Je garde cette précision épinglée. Je répondrai aux questions nouvelles, pas à chaque copie de la même capture ; le repère reste disponible entre deux passages.",
    } },
  }, [
    after("x-double-account", "notice", "Ton avis bref a calmé les habitués, qui demandent maintenant où renvoyer les prochaines questions. Tu peux prolonger ce format léger sans rouvrir l’affaire. Noé apprécie : « Le bon repère n’a pas besoin d’une bande-annonce quotidienne. »", { pinned: { energy: 1, trust: 1 }, guide: { energy: 1 } }, "ines", "Ton avis a suffi pour moi. Un emplacement stable aiderait les personnes qui arriveront après."),
    after("x-double-account", "landmark", "Ton premier repère a distingué tes messages des reprises. Les questions portent désormais sur les annonces qui ne sont pas encore confirmées. Tu as déjà la matière pour un guide court ; tu peux aussi garder une version minimale et laisser le compte retrouver son rythme.", { guide: growth(2, 3, { energy: 2 }), pinned: { trust: 1 } }, "sam", "Le repère est utile. Il manque juste une place claire pour les informations que tu n’as pas confirmées."),
    after("x-double-account", "public", "Ta prise de parole a atteint des lecteurs extérieurs. Plusieurs demandent une méthode infaillible pour reconnaître chaque reprise ; tu ne peux pas la promettre. Un signal bref profiterait de l’attention, tandis qu’un guide devrait remettre des limites dans cette attente.", { signal: growth(2, 3, { haters: 2 }), guide: { trust: 2, energy: -1 } }, "noe", "Ta clarification a voyagé. Certains en attendent maintenant un détecteur universel ; on va garder des ambitions d’atelier.", "quote"),
  ]),
  story({
    scenario: {
      id: "x-double-clarification", platform: "x", arc: "Le compte qui te ressemble", episode: 3,
      character: "Jade · voisine qui veut reprendre le travail", title: "Une identité ne se réduit pas à un démenti",
      audience: "Des abonnés qui veulent retrouver ton travail après les clarifications",
      body: "Jade vient lire une nouvelle d’atelier et tombe encore sur la confusion de comptes. « Je veux savoir ce que tu fabriques, pas suivre la carrière de ton démenti. » La précision doit rester accessible, mais elle n’a pas à occuper tout ton récit. Tu choisis la place qu’elle gardera dans la suite.",
      choices: [
        choice("voice", "Réaffirmer ta voix devant tout le fil", "Tu expliques ce qui caractérise ton compte et invites les nouveaux venus à découvrir ton travail.", "Une transition visible vers ton propre univers.", "L’affirmation peut relancer les comparaisons avec l’autre compte.", "Des lecteurs restent pour découvrir ton univers. La transition est remarquée, mais quelques réponses reviennent encore comparer les présentations au lieu de parler du métier.", "reach", "dialogue", [18, 26, 12, -3, 0, -21]),
        choice("return", "Laisser le repère et reprendre", "Tu gardes la clarification accessible et reviens à une petite nouvelle d’atelier.", "Une pression moindre et un rythme ordinaire retrouvé.", "La transition apporte peu de nouveaux abonnés.", "Jade retrouve une nouvelle de travail. La clarification reste présente pour les retardataires, tandis que le fil cesse peu à peu de tourner autour de la confusion.", "care", "community", [0, 2, -13, 2, 0, -7]),
        choice("signature", "Montrer ce qui signe ton travail", "Tu présentes un choix concret d’atelier et sa logique, sans faire de la ressemblance un nouveau sujet.", "Une raison de te suivre qui dépasse le démenti.", "Le retour au fond demande une préparation soutenue.", "Les lecteurs intéressés trouvent un exemple qui t’appartient. Le compte gagne en cohérence, même si les amateurs d’affaire passent à une autre discussion.", "craft", "craft", [10, 18, 1, 7, 0, -25]),
      ],
    },
    feed: { author: "jade", image: "workshop", caption: "La clarification est utile. Maintenant, {{player}}, j’aimerais retrouver ce qui se fabrique chez toi. Je ne peux pas poser un démenti sur mon étagère.", comments: [message("double-end-noe", "noe", "Le repère peut rester. Le feuilleton peut prendre sa retraite."), message("double-end-ines", "ines", "Une nouvelle de travail m’aiderait justement à reconnaître la voix du compte.")], choicePosts: {
      voice: "Ce compte raconte mes essais, mes choix et leurs limites. Le repère reste accessible ; si vous êtes arrivés par la confusion, voilà maintenant le travail que j’ai envie de partager.",
      return: "Je laisse la clarification à sa place et je reprends les nouvelles d’atelier. Aujourd’hui, je reviens à un petit essai en cours, sans prolonger le sujet des comptes ressemblants.",
      signature: "Je reprends par un choix d’atelier : ce que j’ai voulu obtenir, la contrainte rencontrée et la solution retenue. C’est ce raisonnement que je veux rendre reconnaissable ici.",
    } },
  }, [
    after("x-double-channel", "guide", "Ton guide permet aux habitués de se repérer sans attendre une réponse personnelle. Jade te propose de revenir au travail : le cadre est installé. Tu peux construire un exemple détaillé avec moins d’explications préalables, ou reprendre simplement les nouvelles ordinaires.", { signature: growth(2, 3, { energy: 2 }), return: { trust: 1 } }, "jade", "Le guide remplit son rôle. Tu as maintenant de la place pour raconter quelque chose qui vient de l’atelier."),
    after("x-double-channel", "signal", "Le titre de tes annonces est devenu reconnaissable, mais continue d’attirer des demandes de garanties. Jade souhaite voir ce qui le suit concrètement. Une affirmation visible profiterait de l’attention ; un retour au métier devrait montrer que le signal n’est pas toute ton identité.", { voice: growth(2, 3, { haters: 2 }), signature: { trust: 2, energy: -1 } }, "ines", "Je reconnais ton titre. J’aimerais maintenant voir le travail qu’il annonce, sans refaire la comparaison des comptes."),
    after("x-double-channel", "pinned", "Ta précision épinglée évite déjà des réponses répétées. Jade retrouve le compte au moment où le bruit retombe. Une nouvelle simple prolongerait ce calme ; un exemple détaillé peut aussi rouvrir une conversation choisie, sans transformer le retour en événement.", { return: { haters: -1, energy: 1 }, signature: { energy: 1 } }, "noe", "Le repère est à sa place. Tu peux reprendre sans demander une autorisation au feuilleton."),
  ]),
  story({
    scenario: {
      id: "x-live-invitation", platform: "x", arc: "Le micro ne fait pas le dialogue", episode: 1,
      character: "Inès · hôte d’un échange du quartier", title: "Tu viens avec une idée ou avec un duel ?",
      audience: "Des auditeurs curieux d’un désaccord entre artisans",
      body: "Inès prépare un échange en direct dans cette histoire. Sami et toi défendez deux façons d’organiser un atelier ; elle veut entendre les raisons, pas choisir un vainqueur. Noé propose de surveiller le temps de parole : « J’ai un minuteur et aucune ambition de devenir arbitre de catch. » Il faut annoncer ta participation.",
      choices: [
        choice("opening", "Annoncer le désaccord franchement", "Tu présentes le point qui vous oppose pour donner envie d’écouter l’échange.", "Une accroche claire qui peut attirer du monde.", "Une partie du public attendra un duel plutôt qu’une discussion.", "L’annonce fait circuler le rendez-vous et ton compte. Des lecteurs veulent comprendre votre désaccord ; d’autres arrivent déjà avec une préférence pour le vainqueur.", "reach", "dialogue", [17, 25, 12, -3, 0, -20]),
        choice("brief", "Préparer un exemple contradictoire", "Tu annonces un cas concret et une question sur la limite de ta propre méthode.", "Un échange mieux préparé et une confiance renforcée.", "Il faut travailler le cas avant de prendre la parole.", "Le cas attire des lecteurs intéressés par les raisons du désaccord. Le rendez-vous gagne en substance, au prix d’une préparation exigeante pour toi.", "craft", "craft", [9, 17, 2, 6, 0, -25]),
        choice("listener", "Venir pour une question choisie", "Tu annonces une intervention courte, puis laisses davantage de place aux autres voix.", "Une participation tenable avec moins de pression.", "Tu occupes peu le devant de la conversation.", "Les habitués savent ce que tu viens apporter. La participation reste discrète et tu gardes de l’énergie, sans transformer l’annonce en grande opération de visibilité.", "care", "community", [0, 3, -10, 2, 0, -7]),
      ],
    },
    feed: { author: "ines", image: "community", caption: "Pour notre échange du quartier : un désaccord, des exemples et de la place pour écouter. {{player}} et Sami, vous voulez annoncer ce que vous apportez ?", comments: [message("live-invite-sam", "sam", "Je veux bien discuter d’une méthode. Je ne me suis pas entraîné pour un duel de micros."), message("live-invite-noe", "noe", "Je surveille les tours de parole. Le minuteur refuse déjà de prendre parti.")], choicePosts: {
      opening: "Avec Sami, on ne place pas la même priorité dans l’organisation de l’atelier. Je défendrai mon choix pendant l’échange ; venez entendre ce qui nous fait réellement diverger.",
      brief: "J’apporte un cas précis et une limite de ma méthode. J’aimerais comprendre ce que Sami ferait autrement dans cette situation, avant de défendre ma solution.",
      listener: "Je viens avec une question courte, puis je prendrai le temps d’écouter les autres. Je préfère une intervention choisie à une présence au micro pendant tout l’échange.",
    } },
  }),
  story({
    scenario: {
      id: "x-live-turns", platform: "x", arc: "Le micro ne fait pas le dialogue", episode: 2,
      character: "Noé · gardien provisoire du minuteur", title: "Tout le monde répond en même temps",
      audience: "Des auditeurs partagés entre le spectacle et l’envie de comprendre",
      body: "Pendant l’échange, les réponses se chevauchent. Une remarque utile de Jade disparaît sous deux reformulations de la même objection. Noé lève son minuteur : « Il mesure le temps, pas la taille des convictions. » Tu peux recadrer fortement, organiser le passage de parole ou laisser l’animation respirer sans toi.",
      choices: [
        choice("round", "Proposer un tour de parole précis", "Tu reprends la question de Jade et demandes une réponse de chacun, sans interruption.", "Un débat plus compréhensible et de la confiance.", "Tenir ce cadre demande de l’attention et du mental.", "La question de Jade redevient audible. Les désaccords gagnent en précision ; faire respecter le cadre te coûte pourtant plus qu’une simple intervention.", "craft", "dialogue", [10, 18, 3, 7, 0, -26]),
        choice("stepback", "Laisser Noé reprendre l’animation", "Tu annonces une pause dans tes réponses et laisses la place aux autres interventions.", "Moins de pression et un temps de retrait clair.", "Tu seras moins visible dans la suite de l’échange.", "Noé reprend le rythme des interventions pendant que tu écoutes. Le fil se calme autour de toi, mais les nouveaux auditeurs te découvrent moins.", "care", "community", [0, 2, -12, 2, 0, -7]),
        choice("reframe", "Recadrer le débat à voix haute", "Tu énonces nettement le vrai désaccord et demandes aux interlocuteurs de s’y tenir.", "Une intervention marquante qui recentre l’attention.", "Le ton ferme peut être reçu comme une volonté de dominer.", "Ton recadrage est repris dans les réactions. Il rend le désaccord visible, mais certains lecteurs discutent surtout de la place que tu as prise pour le formuler.", "reach", "dialogue", [18, 26, 14, -4, 0, -22]),
      ],
    },
    feed: { author: "noe", image: "community", caption: "On a perdu la question de Jade entre deux réponses simultanées. Je propose de la retrouver avant d’inventer une quatrième façon de parler par-dessus.", comments: [message("live-turns-jade", "jade", "Je demandais ce que vous changeriez si vous travailliez sans aide. La question tient toujours."), message("live-turns-ines", "ines", "Je veux comprendre les réponses, pas choisir la voix qui couvre les autres.")], choicePosts: {
      round: "Je reprends la question de Jade : que changerait le fait de travailler sans aide ? Je propose une réponse de chacun, puis les objections, pour qu’on puisse réellement comparer.",
      stepback: "Je fais une pause dans mes réponses et je laisse Noé reprendre l’animation. J’ai envie d’entendre la question de Jade et ce que les autres en font.",
      reframe: "Le désaccord n’est pas de savoir qui travaille le plus : il porte sur la manière de choisir les priorités. Je propose qu’on revienne à ce point au lieu de se couper.",
    } },
  }, [
    after("x-live-invitation", "opening", "Ton annonce franche du désaccord a attiré des auditeurs qui attendent un face-à-face. Les réponses se chevauchent et la question de Jade se perd. Un recadrage fort trouverait ce public ; organiser une comparaison demanderait de déplacer son attente.", { reframe: growth(2, 3, { haters: 1 }), round: { trust: 2, energy: -1 } }, "ines", "Ton annonce m’avait donné envie d’entendre le désaccord. Maintenant, j’aimerais aussi entendre une phrase jusqu’au bout.", "quote"),
    after("x-live-invitation", "brief", "Le cas préparé dans ton annonce donne un point commun aux interventions. Jade y ajoute la contrainte d’un atelier sans aide, mais les réponses s’empilent. Tu peux organiser la comparaison à partir d’une matière déjà claire, ou laisser Noé distribuer les prises de parole.", { round: growth(2, 3, { energy: 2 }), stepback: { trust: 1 } }, "jade", "Ton exemple m’a permis de poser ma question. On peut lui ajouter la contrainte de travailler seul ?"),
    after("x-live-invitation", "listener", "Tu avais annoncé une intervention courte. La conversation s’emballe après ta question, sans t’obliger à devenir l’animateur permanent. Noé est prêt à reprendre le cadre ; tu peux aussi choisir d’aider à organiser une seule séquence.", { stepback: { energy: 1, haters: -1 }, round: { trust: 1 } }, "noe", "Tu avais promis une question, pas le service après-vente du micro. Je peux reprendre les tours de parole."),
  ]),
  story({
    scenario: {
      id: "x-live-summary", platform: "x", arc: "Le micro ne fait pas le dialogue", episode: 3,
      character: "Inès · hôte qui prépare le compte rendu", title: "On n’est pas d’accord, et après ?",
      audience: "Les auditeurs tardifs et les participants qui veulent garder une trace juste",
      body: "L’échange se termine sans méthode gagnante. Inès prépare un résumé ; Sami veut éviter que le dernier mot soit pris pour une conclusion commune. Jade a noté une idée qu’elle essaiera autrement. Tu peux publier ta position, restituer les désaccords ou laisser une trace brève qui ne réclame pas un nouvel épisode.",
      choices: [
        choice("minutes", "Restituer l’accord et le désaccord", "Tu sépares les points partagés, les contraintes différentes et les questions restées ouvertes.", "Une synthèse fidèle qui inspire confiance.", "Relire les interventions demande un effort conséquent.", "Les participants reconnaissent leur place dans le résumé. De nouveaux lecteurs viennent pour cette restitution, sans que le désaccord soit effacé pour fabriquer une belle fin.", "craft", "craft", [9, 17, 1, 7, 0, -25]),
        choice("thanks", "Remercier sans promettre de suite", "Tu gardes une question utile de l’échange, remercies les participants et refermes la conversation.", "Un lien préservé et moins de sollicitations.", "La clôture attirera peu de nouveaux lecteurs.", "La conversation se ferme sans obliger tout le monde à revenir au micro. Les habitués gardent une question de travail, et tu retrouves du temps hors du fil.", "care", "community", [0, 3, -11, 3, 0, -7]),
        choice("position", "Assumer ce que tu défends encore", "Tu publies ta conclusion personnelle en précisant qu’elle ne représente pas tous les participants.", "Une position mémorable qui peut être discutée ailleurs.", "Elle peut rouvrir la compétition entre les deux approches.", "Ta position circule et attire des lecteurs vers le compte. Malgré la précision sur son caractère personnel, certains relancent le match entre vos méthodes.", "reach", "dialogue", [17, 25, 12, -2, 0, -20]),
      ],
    },
    feed: { author: "ines", image: "still-life", caption: "Je prépare la trace de l’échange. Je peux écrire « désaccord mieux compris » ; je préfère éviter « tout le monde est finalement d’accord » si personne ne l’a dit.", comments: [message("live-summary-sam", "sam", "J’ai mieux compris ta contrainte, {{player}}. Je ne choisirais pas encore la même méthode."), message("live-summary-jade", "jade", "J’emporte une question à tester dans mon atelier. Pas besoin d’un podium pour ça.")], choicePosts: {
      minutes: "Voici les points communs, puis le désaccord qui reste entre nos méthodes. Les contraintes ne sont pas les mêmes ; je garde aussi les questions auxquelles nous n’avons pas répondu.",
      thanks: "Merci pour l’échange. Je garde la question du travail sans aide et je laisse chacun reprendre ses essais ; je ne promets pas une nouvelle discussion dans chaque réponse.",
      position: "Ma conclusion personnelle reste la même sur ce point, mais je comprends mieux la contrainte de Sami. Je défends mon choix sans en faire l’avis collectif de la rencontre.",
    } },
  }, [
    after("x-live-turns", "round", "Le tour de parole a permis à chacun de préciser sa contrainte. Inès dispose de notes comparables, et Sami retrouve ce qu’il voulait dire. La synthèse est préparée ; tu peux la publier ou fermer plus simplement sans effacer les différences.", { minutes: growth(2, 3, { energy: 2 }), thanks: { trust: 1 } }, "ines", "Le tour de parole me donne des notes utilisables. Je peux distinguer vos réponses sans deviner qui parlait."),
    after("x-live-turns", "stepback", "En laissant Noé reprendre l’animation, tu as entendu des arguments que tu n’aurais pas pu relever en répondant sans arrêt. Inès prépare la trace commune. Tu peux contribuer avec une conclusion modeste, ou prendre le temps de remettre les différentes positions côte à côte.", { thanks: { haters: -1, energy: 1 }, minutes: { energy: 1 } }, "noe", "Tu as laissé de la place, et on a fini par entendre les réponses. Tu peux conclure sans reprendre tout le micro."),
    after("x-live-turns", "reframe", "Ton recadrage est devenu le passage le plus cité de l’échange. Sami rappelle qu’il ne résume pas toute sa position. Une conclusion personnelle profiterait de cette attention ; une restitution commune devrait rendre de la place aux voix passées derrière la tienne.", { position: growth(2, 3, { haters: 2 }), minutes: { trust: 2, energy: -1 } }, "sam", "Ton recadrage était clair. Dans le compte rendu, il faudra aussi garder ce que nous avons ajouté après.", "quote"),
  ]),
  story({
    scenario: {
      id: "x-growth-shortcut", platform: "x", arc: "Être lu ou faire du nombre", episode: 1,
      character: "Noé · voisin peu convaincu par les miracles", title: "La promesse d’un public en kit",
      audience: "Des artisans tentés par une visibilité plus rapide",
      body: "Une proposition fictive vante des relais automatiques et des abonnements de façade pour grossir un compte. Tu n’as rien accepté. Noé lit le message : « Un public livré sans la curiosité. Il manque peut-être l’essentiel. » Tu refuses le procédé ; reste à choisir ce que ce refus raconte de ton propre travail.",
      choices: [
        choice("public-refusal", "Défendre ton refus publiquement", "Tu fais du refus des abonnements artificiels une prise de position visible, sans exposer l’expéditeur.", "Un sujet qui peut toucher les artisans au-delà du quartier.", "La discussion attire des jugements sur les comptes des autres.", "Ton refus est remarqué et attire des lecteurs. Certains discutent de ce qu’ils attendent d’un compte ; d’autres préfèrent soupçonner leurs voisins sans preuve.", "reach", "dialogue", [17, 25, 13, -3, 0, -21]),
        choice("fit", "Définir les lecteurs que tu veux aider", "Tu transformes la proposition en réflexion concrète sur les questions auxquelles ton compte répond.", "Une direction éditoriale plus cohérente et davantage de confiance.", "Le travail de réflexion est moins spectaculaire et demande du mental.", "Les lecteurs comprennent mieux pourquoi suivre ton travail. Le compte attire une curiosité plus précise, au prix d’une préparation que la promesse de facilité évitait soigneusement.", "craft", "craft", [9, 17, 2, 6, 0, -24]),
        choice("decline", "Refuser brièvement et retourner travailler", "Tu annonces que tu ne participes pas au procédé, puis laisses le sujet sans débat prolongé.", "Une décision claire avec peu de pression.", "Le refus produit peu de découverte du compte.", "Les habitués connaissent ta limite. La proposition ne devient pas le sujet permanent de ton compte, et tu conserves l’énergie pour les échanges que tu choisis.", "care", "community", [0, 2, -11, 2, 0, -6]),
      ],
    },
    feed: { author: "noe", image: "still-life", caption: "On propose des relais automatiques à {{playerAtelier}}. J’ai cherché l’option « personnes vraiment curieuses ». Elle n’apparaît pas dans la promesse.", comments: [message("growth-shortcut-ines", "ines", "Je préfère savoir ce qu’un compte va m’apporter que voir un nombre impressionnant."), message("growth-shortcut-sam", "sam", "Refuser le procédé n’oblige pas à accuser d’autres ateliers d’y participer.")], choicePosts: {
      "public-refusal": "Je refuse les abonnements de façade et les relais automatiques. Je veux des lecteurs qui viennent pour le travail ; je ne transformerai pas ce refus en accusation contre d’autres comptes.",
      fit: "La proposition me rappelle une meilleure question : à qui mon compte est-il utile ? Je choisis de travailler les questions d’atelier auxquelles je peux répondre avec des exemples.",
      decline: "Je ne participe pas à cette proposition d’amplification artificielle. Ma limite est posée ; je retourne au travail et aux échanges que j’ai réellement envie de tenir.",
    } },
  }),
  story({
    scenario: {
      id: "x-growth-proof", platform: "x", arc: "Être lu ou faire du nombre", episode: 2,
      character: "Sami · artisan attentif aux preuves", title: "Une capture ne mesure pas l’intérêt",
      audience: "Des lecteurs qui confondent visibilité affichée et relation avec un public",
      body: "Un récit promotionnel présente maintenant une capture de compte comme preuve que le procédé fonctionne. Rien ne montre pourquoi les personnes resteraient lire. Sami insiste : « Un compteur ne raconte pas une conversation. » Tu peux remettre cette limite en avant, expliquer ce que tu observes dans tes échanges ou garder ta décision sans la justifier partout.",
      choices: [
        choice("audit", "Décrire les signes d’un échange utile", "Tu prends un exemple de question suivie d’une réponse et expliques ce qu’il t’apprend sur ton public.", "Un raisonnement concret qui renforce la confiance.", "Il faut choisir l’exemple et en préciser les limites.", "Les lecteurs discutent de la qualité d’une rencontre avec le compte. Le raisonnement attire un public attentif, sans prétendre transformer une conversation en mesure universelle.", "craft", "craft", [10, 18, 2, 7, 0, -25]),
        choice("boundary", "Rappeler que ton refus suffit", "Tu confirmes ta décision sans commenter la capture ni réclamer de preuve à chaque personne.", "Moins de sollicitations et un cadre stable.", "Le message ne lance pas de grande conversation.", "La décision reste lisible. Les demandes de justification occupent moins de place, tandis que tu laisses le sujet circuler sans chercher à l’accompagner partout.", "care", "community", [0, 2, -12, 2, 0, -7]),
        choice("counterpoint", "Opposer compteur et conversation", "Tu formules nettement pourquoi une capture ne suffit pas à démontrer un intérêt réel.", "Une distinction facile à reprendre.", "Le débat peut glisser vers le procès des gros comptes.", "La distinction attire des lecteurs et des réactions. Certains reprennent l’idée utile ; d’autres en font un jugement sur les comptes visibles, ce qui augmente le bruit autour du tien.", "reach", "dialogue", [18, 26, 14, -3, 0, -22]),
      ],
    },
    feed: { author: "sam", image: "still-life", caption: "La capture montre un compteur, pas ce que les lecteurs ont compris ni pourquoi ils reviendraient. On peut laisser cette différence visible.", comments: [message("growth-proof-ines", "ines", "Je peux être intéressée par une réponse sans être impressionnée par le compteur du compte."), message("growth-proof-noe", "noe", "Le compteur est très photogénique. Pour la conversation, il faut encore lui poser une question.", "quote")], choicePosts: {
      audit: "Je regarde surtout les questions qui permettent de mieux comprendre le travail. Un échange précis m’apprend quelque chose sur mon public ; il ne prouve pas que tous les autres lecteurs pensent pareil.",
      boundary: "Je maintiens mon refus. Je n’ai pas besoin de juger chaque capture ni chaque compte pour choisir la manière dont je veux construire le mien.",
      counterpoint: "Un compteur peut être photographié ; l’intérêt d’un lecteur ne se résume pas à cette image. Je veux distinguer une visibilité affichée d’une vraie raison de revenir lire.",
    } },
  }, [
    after("x-growth-shortcut", "public-refusal", "Ton refus visible a lancé un débat sur les comptes qui progressent vite. La capture arrive comme une réponse à ta position, et certains voudraient te voir accuser des personnes. Tu peux discuter de ce qu’elle ne prouve pas sans entrer dans cette chasse aux soupçons.", { counterpoint: growth(2, 3, { haters: 1 }), audit: { trust: 2, energy: -1 }, boundary: { haters: -1 } }, "sam", "Ton refus a été entendu. Le débat n’a pas besoin d’une liste de comptes suspects pour avancer."),
    after("x-growth-shortcut", "fit", "Ta réflexion a donné aux lecteurs une idée des questions que ton compte veut traiter. La capture promotionnelle ne répond à aucune d’elles. Tu disposes déjà d’un exemple pour expliquer ce qui rend un échange utile, sans promettre de mesurer toutes les intentions de ton public.", { audit: growth(2, 3, { energy: 2 }), boundary: { trust: 1 } }, "ines", "Les questions que tu as choisies m’intéressent davantage que la capture. Un exemple de réponse serait concret."),
    after("x-growth-shortcut", "decline", "Tu avais refusé sans prolonger le sujet. La nouvelle capture ne change pas ton engagement et ne t’oblige pas à ouvrir une enquête. Tu peux simplement garder la limite, ou choisir une seule explication utile sur ce que signifie lire un compte.", { boundary: { energy: 1, haters: -1 }, audit: { energy: 1 } }, "noe", "La capture est nouvelle, pas ta décision. Tu peux refuser une deuxième réunion avec la même promesse."),
  ]),
  story({
    scenario: {
      id: "x-growth-peers", platform: "x", arc: "Être lu ou faire du nombre", episode: 3,
      character: "Jade · voisine qui propose une autre rencontre", title: "Des collègues, pas un cercle de relais",
      audience: "Des artisans intéressés par des échanges sans publication obligatoire",
      body: "Jade propose un échange entre ateliers : chacun apporte un problème réel, sans obligation de relayer les comptes des autres. « Si on n’a rien à se dire, on n’invente pas un enthousiasme de groupe. » Tu peux inviter largement, préparer un cas de travail ou présenter sobrement des personnes qui pourraient s’entraider.",
      choices: [
        choice("introduce", "Présenter deux voix utiles", "Tu recommandes des interlocuteurs avec leur accord, sans promettre de relai en retour.", "Une relation simple qui respecte la disponibilité de chacun.", "Tu occupes peu la place centrale de la rencontre.", "Des lecteurs découvrent des voix de métier sans échange obligé de visibilité. Ton geste reste discret et laisse de la place aux autres, avec une pression moindre sur toi.", "care", "community", [0, 3, -10, 3, 0, -7]),
        choice("invitation", "Ouvrir une invitation publique", "Tu invites les artisans à venir avec une difficulté concrète et annonces l’absence de relais obligatoires.", "Une rencontre qui peut dépasser le quartier.", "L’appel large amène aussi des demandes et des attentes dispersées.", "L’invitation attire des curieux et fait circuler ton compte. Il faut aussi accueillir des attentes hétérogènes, dont certaines portent davantage sur la visibilité que sur le travail.", "reach", "dialogue", [17, 25, 11, -2, 0, -20]),
        choice("case-circle", "Préparer un échange sur un cas", "Tu apportes un problème documenté, une limite de ta solution et une question à discuter entre collègues.", "Une raison concrète de se lire et de se faire confiance.", "La préparation coûte davantage qu’une simple invitation.", "Le cas donne un point de départ solide à la rencontre. Les lecteurs intéressés trouvent une raison de rester, sans transformer les échanges en promesse de soutien automatique.", "craft", "craft", [10, 18, 1, 7, 0, -25]),
      ],
    },
    feed: { author: "jade", image: "community", caption: "Et si on échangeait entre ateliers autour d’un vrai problème ? Rien à relayer obligatoirement. Même mon bol préféré n’impose pas qu’on le recommande.", comments: [message("growth-peers-sam", "sam", "Un problème précis me va. Je peux aider sans signer un contrat d’enthousiasme."), message("growth-peers-ines", "ines", "Je lirais volontiers ce que chacun apprend, y compris quand les solutions diffèrent.")], choicePosts: {
      introduce: "Avec leur accord, je vous présente deux voix de métier qui pourraient enrichir cette question. Aucune recommandation n’est due en retour ; je vous laisse découvrir leurs approches.",
      invitation: "Artisans du fil, quel problème concret aimeriez-vous discuter entre collègues ? Je propose un échange sans relais obligatoires ni promesse de visibilité en retour.",
      "case-circle": "J’apporte un cas de travail avec ma solution, sa limite et une question ouverte. Je cherche des regards de collègues, sans demander que chacun partage mon compte.",
    } },
  }, [
    after("x-growth-proof", "audit", "Ton exemple d’échange utile a donné à Jade l’idée d’une rencontre autour d’un cas. Tu as déjà une matière que les collègues comprennent. La discussion peut prolonger le fond, ou laisser la place à des recommandations plus discrètes sans promesse de retour.", { "case-circle": growth(2, 3, { energy: 2 }), introduce: { trust: 1 } }, "jade", "Ton exemple donne un bon point de départ. On pourrait l’examiner entre ateliers, sans demander un relai à qui que ce soit."),
    after("x-growth-proof", "boundary", "Tu as gardé ta limite sans multiplier les justifications. Jade propose une rencontre qui respecte justement le droit de ne pas tout relayer. Tu peux présenter quelques voix, ou préparer un cas à ton rythme sans devenir l’organisateur permanent du quartier.", { introduce: { energy: 1, haters: -1 }, "case-circle": { energy: 1 } }, "jade", "Ta limite me convient. Une rencontre entre collègues peut rester ponctuelle et ne rien exiger de ton fil ensuite."),
    after("x-growth-proof", "counterpoint", "Ta distinction entre compteur et conversation a attiré des artisans curieux. Jade propose de leur donner un sujet concret. L’invitation profiterait de cette attention, mais il faudra éviter que la rencontre devienne un nouveau rassemblement autour des métriques.", { invitation: growth(2, 3, { haters: 2 }), "case-circle": { trust: 2, energy: -1 } }, "sam", "Tu as expliqué ce que le compteur ne dit pas. On peut maintenant choisir un problème sur lequel parler réellement.", "quote"),
  ]),
  story({
    scenario: {
      id: "x-help-boundaries", platform: "x", arc: "Aider sans tout porter", episode: 1,
      character: "Inès · lectrice qui demande avant de solliciter", title: "Ton atelier n’est pas un guichet",
      audience: "Des lecteurs qui cherchent un conseil et des habitués attentifs à ton rythme",
      body: "Inès te demande si tu peux relire une présentation d’atelier. Une autre question arrive sur le choix d’un outil, puis une demande de suivi complet. Rien de malveillant, mais les attentes s’additionnent. Noé regarde ton carnet : « Il reste une page pour ton travail, ou on l’a donnée au courrier ? » Tu peux définir ton cadre.",
      choices: [
        choice("hours", "Annoncer une disponibilité limitée", "Tu précises que tu réponds dans des créneaux choisis, sans suivi individuel ni délai garanti.", "Un cadre tenable et moins de pression.", "Les personnes pressées chercheront ailleurs et le fil restera discret.", "Les habitués comprennent mieux ta disponibilité. Certaines demandes passent leur chemin ; le compte attire peu de nouveaux lecteurs, mais tu gardes une place pour ton atelier.", "care", "community", [0, 2, -12, 3, 0, -6]),
        choice("office", "Choisir un thème d’entraide précis", "Tu prépares un repère sur une question de ton domaine et annonces clairement ce qu’il ne couvre pas.", "Une aide utile qui renforce la confiance.", "La préparation exige du mental même si le cadre est limité.", "Les lecteurs savent sur quoi tu peux réellement aider. Le repère attire des questions plus adaptées, tout en demandant un travail attentif avant sa publication.", "craft", "craft", [9, 17, 2, 7, 0, -24]),
        choice("call", "Ouvrir un appel public aux questions", "Tu invites le fil à proposer des sujets, sans promettre de répondre à chaque demande.", "Une occasion de rencontrer de nouveaux lecteurs.", "L’appel augmente les attentes et le tri nécessaire.", "Les propositions font circuler ton compte. La précision sur l’absence de réponse garantie n’empêche pas certaines attentes insistantes, qui ajoutent de la pression autour du fil.", "reach", "dialogue", [18, 26, 13, -3, 0, -21]),
      ],
    },
    feed: { author: "ines", image: "workshop", caption: "{{player}}, est-ce que tu acceptes de regarder une présentation d’atelier, ou ce n’est pas le cadre de ton compte ? Je préfère demander avant de déposer tout un dossier.", comments: [message("help-boundaries-sam", "sam", "Une réponse utile ne crée pas une disponibilité permanente."), message("help-boundaries-noe", "noe", "Le carnet de l’atelier a demandé à récupérer sa page d’accueil.")], choicePosts: {
      hours: "Je réponds dans des créneaux que je choisis, sans suivi individuel ni délai garanti. J’aime les échanges du fil ; je dois aussi garder du temps pour mon propre travail.",
      office: "Je peux aider sur un thème précis de mon expérience d’atelier. Je prépare un repère avec son cadre et ses limites, pour éviter de promettre un accompagnement que je ne peux pas tenir.",
      call: "Quelles questions d’atelier aimeriez-vous voir discutées ici ? Je choisirai quelques sujets à traiter, sans promettre une réponse à chaque demande ni un suivi personnel.",
    } },
  }),
  story({
    scenario: {
      id: "x-help-requests", platform: "x", arc: "Aider sans tout porter", episode: 2,
      character: "Sami · artisan qui propose un exemple partageable", title: "Une réponse pour qui, au juste ?",
      audience: "Des personnes qui ont une question proche mais des besoins différents",
      body: "Plusieurs demandes se ressemblent sans être identiques. Sami propose de prendre son propre exemple, qu’il accepte de rendre public, plutôt que d’exposer le dossier d’une autre personne. Tu peux préparer une réponse partagée, ouvrir une question au fil ou rappeler que toutes les demandes n’entrent pas dans ton cadre.",
      choices: [
        choice("topic", "Faire de la difficulté une question publique", "Tu poses le problème général et invites les lecteurs à donner leur contexte, sans exposer les demandes reçues.", "Une conversation qui peut élargir ton audience.", "Le fil peut accumuler davantage de sollicitations que de réponses.", "La question attire des expériences variées et de nouveaux lecteurs. Elle fait aussi arriver d’autres demandes, dont certaines dépassent encore le cadre que tu peux tenir.", "reach", "dialogue", [17, 25, 12, -3, 0, -21]),
        choice("shared-answer", "Travailler l’exemple autorisé de Sami", "Tu construis une réponse précise avec son accord, puis expliques ce qui change selon les situations.", "Une aide réutilisable sans exposer les autres personnes.", "Préparer une réponse nuancée prend beaucoup de mental.", "L’exemple de Sami devient un repère utile. Les lecteurs peuvent comparer leur situation sans croire recevoir une solution individuelle, tandis que la préparation mobilise ton attention.", "craft", "craft", [10, 18, 1, 7, 0, -26]),
        choice("decline", "Refuser les suivis hors de ton cadre", "Tu précises les demandes que tu ne prendras pas et laisses aux personnes le choix de chercher ailleurs.", "Des limites claires qui réduisent la pression.", "Tu renonces à prolonger une partie des conversations.", "Certaines demandes s’arrêtent sans promesse abandonnée. Les habitués comprennent ton cadre et la pression baisse, même si le geste attire peu de nouveaux lecteurs.", "care", "community", [0, 2, -13, 2, 0, -7]),
      ],
    },
    feed: { author: "sam", image: "still-life", caption: "On peut utiliser mon exemple, je suis d’accord pour qu’il soit discuté ici. Les demandes des autres personnes n’ont pas besoin de devenir des captures dans le fil.", comments: [message("help-requests-ines", "ines", "Merci de distinguer un exemple public d’une réponse à mon propre dossier."), message("help-requests-noe", "noe", "Une bonne réponse commune peut éviter de fabriquer une petite permanence clandestine.")], choicePosts: {
      topic: "Sans reprendre les demandes personnelles, je pose la question commune : qu’est-ce qui vous bloque dans ce choix d’atelier ? Donnez le contexte de votre difficulté, sans attendre un suivi individuel.",
      "shared-answer": "Avec l’accord de Sami, je prends son exemple pour expliquer une démarche. Je précise les conditions et les limites : vous pourrez comparer votre situation, pas appliquer une réponse sur mesure qui ne vous était pas destinée.",
      decline: "Je ne prendrai pas les demandes de suivi qui dépassent mon cadre. Je préfère le dire clairement et laisser chacun chercher une aide adaptée, plutôt que promettre de revenir sans pouvoir le faire.",
    } },
  }, [
    after("x-help-boundaries", "hours", "Tu avais annoncé des créneaux choisis et l’absence de suivi individuel. Les nouvelles demandes ne changent pas cette limite. Sami offre un exemple public pour une réponse commune ; tu peux le travailler ponctuellement ou simplement refuser ce qui sortirait du cadre annoncé.", { decline: { energy: 1, haters: -1 }, "shared-answer": { energy: 1 } }, "ines", "J’ai compris tes créneaux. Ma demande peut rester sans réponse individuelle ; un exemple public serait déjà utile."),
    after("x-help-boundaries", "office", "Le thème que tu as préparé permet déjà de trier les demandes. L’exemple de Sami entre dans ce cadre, contrairement à plusieurs sollicitations de suivi. Tu peux prolonger ton repère sans repartir de zéro, ou rendre plus nette la limite que certains lecteurs n’avaient pas vue.", { "shared-answer": growth(2, 3, { energy: 2 }), decline: { trust: 1 } }, "sam", "Mon exemple entre dans le thème que tu as choisi. Je suis d’accord pour qu’il serve, avec ses limites."),
    after("x-help-boundaries", "call", "Ton appel public a amené des propositions utiles et des attentes de réponses personnelles. Tu avais prévenu que tout ne serait pas traité, mais certaines relances insistent. L’exemple de Sami peut recentrer l’aide, tandis qu’une nouvelle question publique prolongerait l’afflux.", { topic: growth(2, 3, { haters: 2 }), "shared-answer": { trust: 2, energy: -1 }, decline: { haters: -1 } }, "noe", "Ton appel a été entendu. La phrase sur l’absence de suivi individuel, un peu moins ; on peut la remettre devant.", "quote"),
  ]),
  story({
    scenario: {
      id: "x-help-relay", platform: "x", arc: "Aider sans tout porter", episode: 3,
      character: "Jade · voisine qui connaît ses propres limites", title: "Le quartier peut répondre à plusieurs voix",
      audience: "Des lecteurs prêts à aider sans devenir disponibles en permanence",
      body: "Jade et Sami acceptent d’apporter ponctuellement leur regard dans le fil, chacun sur son domaine. Ils ne promettent ni permanence ni réponse à tout. Noé sourit : « On peut être un quartier sans ouvrir un standard. » Tu peux présenter ce relais, en construire le cadre ou simplement passer la parole pour une question choisie.",
      choices: [
        choice("directory", "Clarifier les rôles et les limites", "Tu présentes les volontaires, leurs sujets et le droit de ne pas prendre chaque demande.", "Un relais compréhensible qui nourrit la confiance.", "Il faut accorder les limites de plusieurs personnes.", "Les lecteurs savent mieux à qui une question peut s’adresser. Le cadre évite de promettre une disponibilité collective sans fin, au prix d’un travail de coordination attentif.", "craft", "community", [9, 17, 2, 7, 0, -25]),
        choice("spotlight", "Faire connaître les voix volontaires", "Avec leur accord, tu annonces la rencontre et invites le public à découvrir les approches du quartier.", "Une visibilité partagée qui peut attirer des lecteurs.", "L’annonce peut créer des attentes plus larges que l’engagement réel.", "Les volontaires rencontrent de nouveaux regards, et ton compte bénéficie de la présentation. Certaines demandes dépassent pourtant le caractère ponctuel de l’invitation.", "reach", "dialogue", [18, 26, 12, -2, 0, -21]),
        choice("handoff", "Passer la parole sur une seule question", "Tu présentes un relais ponctuel avec son accord, puis annonces ton retour au travail.", "Une entraide concrète qui laisse chacun respirer.", "Le geste est discret et n’installe pas de grand rendez-vous.", "La question trouve une autre voix sans engagement permanent. Tu gardes le lien avec le quartier tout en quittant le centre de l’échange et ses relances.", "care", "community", [0, 3, -12, 3, 0, -7]),
      ],
    },
    feed: { author: "jade", image: "community", caption: "Sami et moi pouvons apporter un regard sur certains sujets. Ponctuellement. Mon atelier et le sien n’ont pas secrètement recruté une équipe de permanence.", comments: [message("help-relay-sam", "sam", "Je peux répondre sur mon domaine et dire quand je ne sais pas. Les deux font partie de la proposition."), message("help-relay-noe", "noe", "Un quartier avec plusieurs voix, oui. Un standard tenu par la personne la plus polie, non.")], choicePosts: {
      directory: "Avec leur accord, je présente les sujets sur lesquels Jade et Sami peuvent intervenir. Chacun reste libre de répondre ou non ; ce relais ponctuel ne promet ni permanence ni solution à tout.",
      spotlight: "Des voix du quartier proposent de partager ponctuellement leur expérience. Je vous invite à découvrir leurs approches, en gardant leurs limites : ce n’est pas un service ouvert à toutes les demandes.",
      handoff: "Pour cette question précise, je passe la parole à une personne du quartier qui a accepté d’apporter son regard. Je retourne au travail ; le relais ne devient pas un engagement permanent.",
    } },
  }, [
    after("x-help-requests", "topic", "Ta question publique a montré la diversité des besoins et amené de nouvelles demandes. Jade et Sami proposent un relais ponctuel, sans vouloir absorber tout l’afflux. Une annonce large profiterait de l’attention ; un cadre précis devrait rendre leurs limites particulièrement visibles.", { spotlight: growth(2, 3, { haters: 2 }), directory: { trust: 2, energy: -1 }, handoff: { haters: -1 } }, "jade", "La question a intéressé du monde. Avant de nous présenter, garde bien le mot « ponctuellement » dans l’annonce."),
    after("x-help-requests", "shared-answer", "L’exemple autorisé de Sami a montré comment aider sans exposer les demandes personnelles. Jade souhaite rejoindre ce format sur son domaine. Tu as déjà un cadre à adapter ; tu peux le rendre lisible pour plusieurs voix ou passer la parole sur une question seulement.", { directory: growth(2, 3, { energy: 2 }), handoff: { trust: 1 } }, "jade", "L’exemple de Sami donne un cadre qui me convient. Je peux participer sur mon domaine, avec les mêmes limites."),
    after("x-help-requests", "decline", "Tu as refusé les suivis qui dépassaient ta disponibilité. Jade et Sami proposent un regard ponctuel, sans annuler cette limite ni te rendre responsable de toutes les réponses. Tu peux passer une question choisie, ou préparer un repère collectif qui respecte aussi leur droit de refuser.", { handoff: { energy: 1, haters: -1 }, directory: { trust: 1 } }, "sam", "Notre proposition ne remplace pas une permanence que tu aurais dû assurer. C’est juste une autre voix, quand nous sommes disponibles."),
  ]),
];
