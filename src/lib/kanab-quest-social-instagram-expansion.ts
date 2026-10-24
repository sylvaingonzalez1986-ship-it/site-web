import { socialChoice as choice, socialGrowth as growth, type KqSocialContentMessage, type KqSocialContentPerson, type KqSocialStoryContent } from "./kanab-quest-social-content";
import type { KqSocialEffects } from "./kanab-quest-social-types";

const comment = (id: string, person: KqSocialContentPerson, text: string): KqSocialContentMessage => ({ id, person, text, kind: "reply" });
type Continuation = { choiceId: string; body: string; modifiers: Record<string, Partial<KqSocialEffects>>; person: KqSocialContentPerson; text: string };
/** One authored continuation supplies both the mechanical memory rule and its visible reply. */
function continued(entry: KqSocialStoryContent, previous: string, variants: Continuation[]): KqSocialStoryContent {
  return { ...entry, scenario: { ...entry.scenario, followups: variants.map(item => ({ fromScenarioId: previous, fromChoiceId: item.choiceId, body: item.body, choiceModifiers: item.modifiers })) },
    branches: variants.map(item => ({ fromScenarioId: previous, fromChoiceId: item.choiceId, message: comment(`${entry.scenario.id}:${item.choiceId}`, item.person, item.text) })) };
}

export const KQ_SOCIAL_INSTAGRAM_EXPANSION: KqSocialStoryContent[] = [
  {
    scenario: {
      id: "ig-credit-source", platform: "instagram", arc: "Qui tient l’appareil ?", episode: 1, character: "Mila · derrière l’objectif",
      title: "L’image est partie sans sa signature", audience: "Des lecteurs qui découvrent le travail par les partages",
      body: "Un compte de découvertes reprend une photo de ton atelier sans mentionner Mila, qui l’a réalisée. Il te demande maintenant une légende. Mila pose l’appareil : « J’aime voyager. Mon nom aussi. » Vous devez décider comment remettre le travail et son autrice dans le cadre.",
      choices: [
        choice("public", "Raconter le trajet de la photo", "Avec Mila, tu publies l’origine de l’image et demandes un crédit visible.", "L’histoire peut toucher les lecteurs du partage.", "Le débat peut éclipser la photo et attirer des accusations.", "L’origine de l’image devient le sujet de la discussion. Les curieux découvrent le travail de Mila ; des commentaires cherchent aussi un responsable à afficher.", "reach", "dialogue", [29, 41, 9, -2, 0, -15]),
        choice("caption", "Écrire une légende avec Mila", "Vous préparez ensemble les crédits et le contexte à joindre à l’image.", "Le travail de chacun devient lisible.", "Mettre les informations au propre prend du temps.", "La légende explique qui a fait quoi. Les lecteurs attentifs comprennent mieux la collaboration, même si le texte circule moins vite que l’image seule.", "craft", "craft", [17, 26, 2, 5, 0, -19]),
        choice("note", "Publier un crédit bref", "Tu nommes Mila sur ton fil et lui laisses contacter directement le compte.", "Une correction simple sans longue discussion.", "Tu renonces à exploiter l’attention autour de la reprise.", "Le nom de Mila retrouve sa place sur ton fil. Tu laisses la question de la reprise entre les personnes concernées et les échanges restent limités.", "care", "community", [0, 3, -8, 2, 0, -5]),
      ],
    },
    feed: { author: "mila", image: "workshop", caption: "Ma photo de {{playerAtelier}} se promène sans mon nom. Je lui ai pourtant appris à se présenter.", comments: [comment("credit-source-ines", "ines", "Je l’ai découverte par un partage. Je me demandais justement qui avait fait l’image."), comment("credit-source-jade", "jade", "Un crédit, ça prend moins de place que mon nom sur mes cartons.")], choicePosts: {
      public: "Avec Mila, on retrace le chemin de cette photo. Elle a réalisé l’image ; merci de garder son nom et le contexte quand vous la partagez.",
      caption: "Une image, plusieurs gestes : la photo est de @mila.cadre, le travail se passe à l’atelier. Nous avons écrit la légende ensemble pour rendre les deux visibles.",
      note: "Petit crédit à remettre au bon endroit : cette photo est signée @mila.cadre. Je vous laisse découvrir son regard directement sur son compte.",
    } },
  },
  continued({
    scenario: {
      id: "ig-credit-repair", platform: "instagram", arc: "Qui tient l’appareil ?", episode: 2, character: "Mila · derrière l’objectif",
      title: "Le crédit tient-il dans la légende ?", audience: "Des visiteurs qui cherchent la source de l’image",
      body: "Le compte propose une nouvelle légende, mais réduit le nom de Mila à une mention difficile à trouver. Elle te montre son écran : « Je suis entre une virgule et un parapluie. » Tu peux rendre la correction très visible, expliquer la collaboration ou simplement remettre le lien en place.",
      choices: [
        choice("link", "Remettre le lien en évidence", "Une note épinglée mène vers le compte de Mila, sans rouvrir tout le débat.", "La source devient facile à retrouver.", "Cette correction discrète attire peu de nouveaux regards.", "Les lecteurs disposent d’un chemin clair vers Mila. La discussion se tasse et la correction occupe moins de place que l’incident initial.", "care", "community", [1, 3, -9, 2, 0, -5]),
        choice("breakdown", "Montrer comment l’image a été faite", "Mila raconte le cadrage ; tu expliques ce que vous vouliez montrer du travail.", "Les crédits prennent un sens concret.", "La démonstration demande une préparation commune.", "La fabrication de l’image intéresse les lecteurs du métier. La signature apparaît comme une partie du travail, pas seulement une ligne à ajouter.", "craft", "craft", [18, 27, 2, 6, 0, -20]),
        choice("compare", "Comparer les deux légendes", "Tu montres comment une légende claire change la lecture, avec l’accord de Mila.", "Un exemple visuel facile à comprendre et à relayer.", "Certains lecteurs voudront relancer le procès du compte.", "La comparaison rend le problème visible d’un coup d’œil. Elle entretient aussi une discussion où quelques personnes préfèrent chercher un fautif plutôt qu’une correction.", "reach", "visual", [30, 42, 10, -2, 0, -16]),
      ],
    },
    feed: { author: "mila", image: "still-life", caption: "La légende corrigée me place entre une virgule et un parapluie. Je voudrais surtout qu’on comprenne ce que j’ai fait.", comments: [comment("credit-repair-ines", "ines", "J’aime quand un crédit explique la collaboration, sans avoir besoin de jouer au détective."), comment("credit-repair-sam", "sam", "Le lien vers la source devrait se trouver sans loupe.")], choicePosts: {
      link: "Pour retrouver la photo et les autres images de Mila, le lien utile est ici : @mila.cadre. Je laisse ce repère accessible.",
      breakdown: "Mila explique son cadrage, je raconte le travail qu’il fallait montrer. Voilà comment cette image s’est construite à deux.",
      compare: "Même image, deux légendes : dans l’une on perd son autrice ; dans l’autre on comprend qui a travaillé. Avec Mila, on montre la différence.",
    } },
  }, "ig-credit-source", [
    { choiceId: "public", body: "Ton récit public du trajet de l’image a attiré des questions sur la signature. La nouvelle légende proposée reste peu lisible. Mila préfère maintenant un exemple clair à une bataille de commentaires.", modifiers: { compare: growth(4, 7, { haters: 2 }), breakdown: { trust: 2 } }, person: "ines", text: "Après ton récit du partage, j’aimerais voir une légende qui règle vraiment le problème." },
    { choiceId: "caption", body: "Vous avez déjà préparé une légende commune. La version proposée raccourcit justement le passage qui explique le rôle de Mila. Vos notes permettent de montrer la différence sans repartir de zéro.", modifiers: { breakdown: growth(4, 6, { energy: 3 }), link: { trust: 1 } }, person: "mila", text: "Notre légende disait qui faisait quoi. Le passage le plus utile a eu droit à une coupe très sportive." },
    { choiceId: "note", body: "Ton crédit bref a remis Mila en évidence sur ton fil, mais des visiteurs cherchent encore le chemin vers sa photo. Elle propose de garder une réponse simple, ou de profiter de la question pour expliquer la collaboration.", modifiers: { link: growth(1, 2, { haters: -2 }), breakdown: { energy: 2 } }, person: "jade", text: "Ta petite note aide déjà. Un lien bien placé évitera aux suivants le jeu de piste." },
  ]),
  continued({
    scenario: {
      id: "ig-credit-license", platform: "instagram", arc: "Qui tient l’appareil ?", episode: 3, character: "Mila · derrière l’objectif",
      title: "La prochaine image a sa notice", audience: "Des comptes qui souhaitent relayer ton univers",
      body: "Mila propose de préparer la prochaine publication avec une consigne de reprise claire. Rien de solennel : savoir qui contacter, qui créditer et quelles images vous acceptez de voir circuler. Elle écrit « demander avant » sur une feuille trop petite, puis recommence.",
      choices: [
        choice("guide", "Créer une fiche de partage", "Vous préparez un repère simple avec auteur, contexte et demande d’accord avant reprise.", "Une méthode réutilisable pour vos prochaines images.", "La fiche demande du travail pour une portée mesurée.", "Les lecteurs trouvent un cadre concret pour parler de vos images. La méthode renforce la confiance, même si elle intéresse surtout les personnes déjà attentives au travail.", "craft", "craft", [17, 25, 1, 5, 0, -18]),
        choice("invitation", "Inviter à un partage accompagné", "Vous proposez une image choisie, sa légende complète et une invitation à expliquer son intérêt.", "Des relais peuvent faire découvrir votre collaboration.", "Le grand appel ramène des discussions difficiles à suivre.", "L’invitation donne un point d’entrée aux comptes curieux. Les échanges s’élargissent, avec des demandes pertinentes et d’autres qui veulent surtout profiter du mouvement.", "reach", "visual", [28, 40, 8, -1, 0, -14]),
        choice("contact", "Garder un point de contact", "Tu épingles une phrase : demander aux auteurs avant de reprendre leurs images.", "Une limite lisible, facile à maintenir.", "Tu ne lances pas de nouvelle vague de partage.", "Le repère pose une frontière sans transformer le compte en mode d’emploi permanent. Les conversations reviennent doucement aux images et au travail.", "care", "community", [0, 3, -8, 3, 0, -6]),
      ],
    },
    feed: { author: "mila", image: "still-life", caption: "Pour les prochaines photos, je prépare une notice qui tient sans loupe. Mon premier brouillon tenait surtout du timbre-poste.", comments: [comment("credit-license-jade", "jade", "Une personne à contacter, une signature lisible : on tient déjà quelque chose."), comment("credit-license-ines", "ines", "Et garder le contexte. Une belle image toute seule peut raconter autre chose.")], choicePosts: {
      guide: "Notre repère pour partager une image : retrouver son auteur, garder son contexte et demander l’accord avant reprise. Mila et moi le gardons avec nos prochaines publications.",
      invitation: "Avec Mila, on propose une image à partager avec notre accord et sa légende complète. Si elle vous parle, racontez aussi ce que vous y voyez.",
      contact: "Pour reprendre une image de l’atelier, contactez ses auteurs avant de publier. Un petit message permet de savoir ce qui peut circuler et comment le présenter.",
    } },
  }, "ig-credit-repair", [
    { choiceId: "link", body: "Ton lien épinglé a simplifié le chemin vers Mila. Elle te propose d’en faire le point de départ d’une consigne pour les prochaines images, sans rallumer la discussion sur l’ancienne reprise.", modifiers: { contact: { energy: 1, haters: -2 }, guide: { trust: 1 } }, person: "mila", text: "Le lien est enfin facile à trouver. On peut garder cette simplicité pour la suite." },
    { choiceId: "breakdown", body: "Votre démonstration a montré le travail derrière l’image. Mila veut maintenant que les prochaines reprises gardent cette information. Vous disposez déjà d’une bonne base pour préparer un repère commun.", modifiers: { guide: growth(4, 6, { energy: 3 }), invitation: { trust: 1 } }, person: "ines", text: "Depuis votre explication du cadrage, la signature raconte vraiment quelque chose pour moi." },
    { choiceId: "compare", body: "Ta comparaison des légendes a mis le sujet en pleine lumière. Les demandes de précision se mélangent aux commentaires sur le compte initial. Mila propose de transformer cette attention en consigne tournée vers les prochaines images.", modifiers: { invitation: growth(4, 7, { haters: 2 }), contact: { haters: -3 } }, person: "jade", text: "La comparaison était parlante. Une suite pratique nous évitera de camper sous les deux légendes." },
  ]),
  {
    scenario: {
      id: "ig-live-glitch", platform: "instagram", arc: "Le direct a pris un détour", episode: 1, character: "Mila · caméra en main",
      title: "Le gel de l’image, pas de l’atelier", audience: "Des curieux d’une visite en direct",
      body: "Pendant votre essai de direct, l’image se fige sur une expression que Mila juge « très conceptuelle ». Le son fonctionne encore. Vous pouvez improviser, préparer une version plus propre ou annoncer la fin du test avant que l’écran immobile ne devienne le personnage principal.",
      choices: [
        choice("improvise", "Continuer en jouant de l’imprévu", "Tu commentes le test raté avec Mila et transformes l’incident en courte conversation.", "L’improvisation donne une scène vivante à partager.", "La plaisanterie peut prendre toute la place du travail.", "L’incident devient un moment de spectacle. Certains apprécient l’improvisation ; d’autres restent sur l’image figée et relancent les moqueries.", "reach", "dialogue", [29, 42, 9, -2, 0, -15]),
        choice("retake", "Préparer une visite enregistrée", "Tu arrêtes le test pour montrer une étape de l’atelier avec un son et un contexte vérifiables.", "Une visite claire pour les lecteurs du métier.", "Tout reprendre demande un effort de préparation.", "La visite devient compréhensible malgré le problème de départ. Le fond prend sa place, au prix d’un tournage et d’un montage plus exigeants.", "craft", "craft", [18, 27, 2, 5, 0, -20]),
        choice("close", "Fermer le test avec un mot", "Tu signales le problème, remercies les présents et reprends ton travail.", "Tu limites la fatigue et les attentes.", "Tu laisses passer l’attention du direct.", "Le test se termine avec une explication simple. La conversation retombe sans grand rebond, et tu ne passes pas la séance à lutter contre la connexion.", "care", "community", [0, 2, -9, 2, 0, -5]),
      ],
    },
    feed: { author: "mila", image: "workshop", caption: "Essai de direct chez les ateliers : l’image s’est figée, le son continue. J’appelle ça un portrait avec commentaire audio.", comments: [comment("live-glitch-noe", "noe", "L’expression immobile apporte une gravité inattendue au branchement de la caméra."), comment("live-glitch-ines", "ines", "On peut encore poser une question ou vous préférez reprendre plus tard ?")], choicePosts: {
      improvise: "L’image du test a décidé de faire une pause. Avec Mila, on garde le son quelques instants pour raconter l’imprévu ; le portrait immobile n’était pas dans le programme.",
      retake: "Le test de direct n’était pas lisible. Je reprends la visite en version enregistrée, avec une étape de l’atelier et le contexte nécessaire pour la comprendre.",
      close: "La connexion ne suit pas, on ferme le test ici. Merci d’avoir essayé avec nous ; je retourne à l’atelier plutôt que de vous promettre un direct qui ne tient pas.",
    } },
  },
  continued({
    scenario: {
      id: "ig-live-queue", platform: "instagram", arc: "Le direct a pris un détour", episode: 2, character: "Inès · curieuse du quartier",
      title: "Les questions n’attendent pas leur tour", audience: "Des lecteurs qui veulent entrer dans la visite",
      body: "Inès a regroupé les questions arrivées autour du test. Il y a celles sur le travail, celles sur la caméra et celle qui demande si le tabouret est disponible pour un portrait. Tu dois choisir quelle conversation ouvrir sans promettre une réponse individuelle à tout le monde.",
      choices: [
        choice("select", "Répondre à une question choisie", "Tu prends une question utile et annonces clairement que tu t’en tiens à celle-ci.", "Un échange possible sans te disperser.", "Les autres questions restent de côté.", "La réponse donne un petit point d’entrée aux lecteurs. Le cadre calme les sollicitations, mais une partie des curieux repart sans le développement qu’elle attendait.", "care", "dialogue", [1, 3, -8, 3, 0, -6]),
        choice("questionbox", "Ouvrir une question collective", "Tu demandes au public de choisir le thème d’une prochaine réponse, avec une fin annoncée.", "La participation peut attirer de nouveaux curieux.", "Les propositions multiplient aussi les attentes.", "Les lecteurs se projettent dans la suite. Les idées se croisent, avec des demandes incompatibles et des remarques qui sollicitent davantage ton attention.", "reach", "community", [28, 40, 8, -1, 0, -14]),
        choice("sequence", "Construire une réponse en étapes", "Tu relies quelques questions proches dans un récit de travail avec des limites explicites.", "Les lecteurs comprennent le fil entre leurs questions.", "Trier et préparer les exemples coûte de l’énergie.", "Les questions cessent de former une liste sans fin. Le récit intéresse les personnes attentives au métier, même s’il demande plus d’effort à suivre.", "craft", "craft", [17, 26, 2, 5, 0, -19]),
      ],
    },
    feed: { author: "ines", image: "still-life", caption: "J’ai regroupé les questions du test. Une parle du travail, une de la caméra, une du tabouret. Je soupçonne Noé pour la dernière.", comments: [comment("live-queue-noe", "noe", "Le tabouret n’a toujours pas donné sa version."), comment("live-queue-sam", "sam", "Une réponse bien cadrée vaut mieux qu’une promesse de répondre à tout.")], choicePosts: {
      select: "Je prends une question de la visite et je m’arrête à celle-ci aujourd’hui. Merci pour les autres ; je ne vais pas faire semblant de pouvoir toutes les traiter.",
      questionbox: "Quel thème vous aiderait le plus à comprendre l’atelier ? Je recueille vos idées pour choisir une réponse, pas pour ouvrir une permanence.",
      sequence: "Plusieurs de vos questions parlent de la même étape. Je les rassemble dans un récit : le point de départ, le choix de travail et ses limites.",
    } },
  }, "ig-live-glitch", [
    { choiceId: "improvise", body: "Ton improvisation avec Mila a mélangé les questions de métier aux plaisanteries sur le direct. Inès fait le tri : tu peux prolonger la participation ou donner une place plus nette au travail.", modifiers: { questionbox: growth(4, 7, { haters: 2 }), sequence: { trust: 2 } }, person: "ines", text: "Après votre improvisation, je garde les questions de métier à côté des blagues. Les deux piles sont très différentes." },
    { choiceId: "retake", body: "Tu as choisi de préparer une visite enregistrée. Inès retrouve des questions qui peuvent servir de fil conducteur : elles t’évitent d’inventer un programme sans savoir ce que les lecteurs cherchent.", modifiers: { sequence: growth(4, 6, { energy: 3 }), select: { trust: 1 } }, person: "sam", text: "Pour ta version enregistrée, les questions donnent déjà un ordre de visite assez clair." },
    { choiceId: "close", body: "Tu as fermé le test sans promettre de revenir immédiatement. Les questions utiles sont restées disponibles. Inès te propose d’en choisir une, ou de préparer une réponse plus longue quand tu veux reprendre le fil.", modifiers: { select: { energy: 1, haters: -2 }, sequence: { energy: 2 } }, person: "ines", text: "Tu avais fermé le test proprement. Les questions sont toujours là, elles ne sont pas vexées d’attendre." },
  ]),
  continued({
    scenario: {
      id: "ig-live-edit", platform: "instagram", arc: "Le direct a pris un détour", episode: 3, character: "Mila · au montage",
      title: "Que garde-t-on au montage ?", audience: "Des lecteurs qui n’ont pas suivi le test",
      body: "Mila pose les notes de la visite à côté de celles des questions. « On peut garder l’idée, les ratés ou les deux. Le grésillement, je le laisse partir. » La version finale doit avoir un sens pour quelqu’un qui n’était pas là au début.",
      choices: [
        choice("recap", "Monter un résumé explicatif", "Tu gardes les étapes utiles, les questions et les précisions qui rendent le récit compréhensible.", "Un contenu qui reste utile après le direct.", "Le montage demande une attention soutenue.", "Le résumé permet de comprendre la visite sans avoir suivi le test. Il donne du fond au compte, avec moins d’effet immédiat qu’un montage d’imprévus.", "craft", "craft", [19, 28, 2, 6, 0, -21]),
        choice("bloopers", "Faire un bêtisier commenté", "Tu choisis des ratés que vous assumez et ajoutes ce qu’ils racontent de la préparation.", "Un format vivant qui peut sortir du cercle habituel.", "Les gags peuvent devenir la seule attente du public.", "Les imprévus rendent la préparation accessible. Ils attirent aussi des lecteurs venus surtout pour le prochain raté, et les plaisanteries occupent davantage le fil.", "reach", "visual", [30, 43, 9, -2, 0, -16]),
        choice("text", "Garder une réponse écrite", "Tu publies la précision la plus utile et tu remercies les personnes qui ont aidé.", "Un résultat simple sans nouvelle séance de montage.", "Tu utilises peu du potentiel visuel de la visite.", "La réponse donne une conclusion lisible à l’échange. Elle entretient le lien sans transformer tout le matériel en nouvelle série de publications.", "care", "dialogue", [1, 4, -8, 3, 0, -6]),
      ],
    },
    feed: { author: "mila", image: "still-life", caption: "J’ai les notes, les questions et le souvenir du grésillement. On peut garder le meilleur des trois, mais je vote contre le grésillement.", comments: [comment("live-edit-ines", "ines", "Pensez aux gens qui arrivent maintenant : ils n’ont pas vécu l’épisode du portrait figé."), comment("live-edit-jade", "jade", "Je soutiens une conclusion qui ne nécessite pas six autres conclusions.")], choicePosts: {
      recap: "Je reprends la visite depuis le début : l’étape montrée, vos questions et les précisions utiles. Ce résumé se lit sans avoir suivi notre test mouvementé.",
      bloopers: "Les imprévus de notre préparation, avec ce qu’on en a appris. On assume nos ratés ; Mila garde le droit de retirer le grésillement du générique.",
      text: "Je garde une précision utile de notre échange et un merci à celles et ceux qui ont posé les questions. La visite trouve sa conclusion ici.",
    } },
  }, "ig-live-queue", [
    { choiceId: "select", body: "Tu avais limité ta réponse à une question précise. Mila te propose de garder ce petit format comme conclusion, ou de lui donner plus d’ampleur sans faire croire que tu as répondu à tout.", modifiers: { text: growth(1, 2, { haters: -2 }), recap: { energy: 2 } }, person: "ines", text: "Ta réponse à une seule question avait un cadre clair. Le montage peut garder cette simplicité." },
    { choiceId: "questionbox", body: "Ta question collective a rassemblé des idées très différentes. Mila te demande de choisir le fil du montage : une conclusion utile ou le récit drôle de cette préparation qui déborde.", modifiers: { bloopers: growth(4, 7, { haters: 2 }), recap: { trust: 2 } }, person: "mila", text: "Ta boîte à idées déborde. Pour le montage, je garde une ligne ; le reste ne rentre pas même en tassant." },
    { choiceId: "sequence", body: "Ta réponse en étapes fournit déjà la structure d’un résumé. Mila peut monter ce fil sans reconstruire la visite ; un bêtisier, lui, déplacerait l’attention vers les coulisses de la préparation.", modifiers: { recap: growth(4, 6, { energy: 3 }), text: { trust: 1 } }, person: "sam", text: "Les questions que tu as reliées forment déjà un bon résumé. Je garderais le raisonnement visible." },
  ]),
  {
    scenario: {
      id: "ig-filter-doubt", platform: "instagram", arc: "La couleur du récit", episode: 1, character: "Mila · œil sur les couleurs",
      title: "Le filtre a pris les commandes", audience: "Des amateurs d’images et des lecteurs attentifs au produit",
      body: "Un réglage donne à ton image une ambiance superbe, mais change aussi les couleurs des fleurs en arrière-plan. Mila compare les versions : « L’atelier a l’air d’avoir déménagé sur une autre planète. » Tu dois décider ce que l’image prétend montrer.",
      choices: [
        choice("plain", "Choisir une image simple", "Tu gardes une vue sans effet marqué et une légende courte sur l’atelier.", "Peu de préparation et une attente sobre.", "L’image attire moins l’œil dans le fil.", "L’image reste discrète et lisible. Les lecteurs trouvent une présence régulière, sans grand effet visuel ni promesse de transformation spectaculaire.", "care", "visual", [1, 3, -7, 2, 0, -5]),
        choice("stylized", "Assumer une ambiance stylisée", "Tu publies une interprétation colorée en précisant qu’elle ne décrit pas fidèlement le produit.", "Un univers visuel qui peut se remarquer.", "Le style peut brouiller la lecture malgré la précision.", "L’ambiance attire les amateurs d’images. Des lecteurs discutent surtout du filtre, et certains regrettent de ne plus savoir ce que la couleur leur apprend.", "reach", "visual", [29, 42, 8, -2, 0, -14]),
        choice("calibrate", "Montrer le choix des couleurs", "Tu expliques le réglage retenu et ce qu’il change dans la lecture de l’image.", "Une démarche compréhensible pour les lecteurs exigeants.", "Comparer et expliquer les versions prend du temps.", "Le choix visuel devient une décision de travail. Les lecteurs comprennent mieux sa limite, avec moins d’effet immédiat qu’un filtre spectaculaire.", "craft", "craft", [17, 26, 2, 5, 0, -19]),
      ],
    },
    feed: { author: "mila", image: "still-life", caption: "Un filtre vient de transporter {{playerAtelier}} sur une autre planète. Très belle planète. Couleurs assez peu fiables.", comments: [comment("filter-doubt-sam", "sam", "Pour une ambiance, pourquoi pas. Pour comprendre les fleurs, j’ai besoin d’un autre repère."), comment("filter-doubt-jade", "jade", "Mes bols ont déjà vécu une période orange fluo. Ils ont demandé à rentrer.")], choicePosts: {
      plain: "Une vue simple de l’atelier, sans grand effet de couleur. Aujourd’hui, je garde le fil proche de ce que je cherche à raconter.",
      stylized: "Une interprétation colorée de l’atelier : je cherche une ambiance, pas une référence fidèle pour les couleurs du produit. Le filtre fait partie de l’image.",
      calibrate: "Je vous montre pourquoi j’ai retenu ce réglage : ce qu’il met en valeur, ce qu’il modifie et ce qu’on ne devrait pas déduire d’une image seule.",
    } }, publishedImages: { plain: "workshop", stylized: "workshop", calibrate: "still-life" },
  },
  continued({
    scenario: {
      id: "ig-filter-proof", platform: "instagram", arc: "La couleur du récit", episode: 2, character: "Inès · le regard du public",
      title: "« C’est la lumière ou le produit ? »", audience: "Des personnes qui comparent les images",
      body: "Inès remarque qu’une couleur ne se lit pas de la même façon selon le fond et l’éclairage. Elle demande ce qu’elle peut réellement comparer dans tes publications. Mila pose deux feuilles de papier sur la table : « Même l’arrière-plan peut jouer les premiers rôles. »",
      choices: [
        choice("demo", "Expliquer avec deux éclairages", "Tu prépares un exemple sur l’effet de la lumière et les limites d’une comparaison visuelle.", "Le public apprend à lire tes images avec plus de recul.", "La démonstration demande des prises et des explications.", "L’exemple déplace la conversation vers la manière de regarder. Les lecteurs comprennent mieux ce qui reste comparable, sans obtenir une promesse de fidélité parfaite.", "craft", "craft", [18, 27, 2, 6, 0, -20]),
        choice("split", "Faire un contraste spectaculaire", "Tu mets en scène deux ambiances très différentes, en indiquant clairement le rôle de la lumière.", "Le contraste rend le sujet immédiat.", "Les réactions peuvent se fixer sur l’effet avant de lire la légende.", "Le contraste accroche le regard. Il ouvre la discussion sur les images, tout en attirant des commentaires qui jugent surtout le spectacle des couleurs.", "reach", "visual", [30, 43, 9, -2, 0, -16]),
        choice("caption", "Ajouter un repère en légende", "Tu précises l’éclairage et rappelles qu’une photo ne suffit pas à comparer deux produits.", "Une limite simple à rendre visible.", "Le repère circule peu hors de la publication.", "La précision aide les lecteurs qui prennent le temps de lire. La discussion reste courte et la publication ne devient pas une nouvelle séance de démonstration.", "care", "dialogue", [0, 3, -8, 3, 0, -6]),
      ],
    },
    feed: { author: "ines", image: "still-life", caption: "Quand je compare les images, je ne sais plus si je regarde le produit, le fond ou la lumière. Il me manque un petit repère.", comments: [comment("filter-proof-mila", "mila", "Le fond peut raconter beaucoup de choses. Il faut juste éviter de lui faire rédiger toute la fiche produit."), comment("filter-proof-sam", "sam", "Dire ce qu’une image ne prouve pas m’aide déjà à la lire.")], choicePosts: {
      demo: "Même sujet, éclairages différents : je montre ce qui change et ce qui limite la comparaison. Une photo donne un point de vue, pas une mesure universelle.",
      split: "Deux ambiances très éloignées pour montrer le rôle de la lumière. Le contraste est volontaire ; ne le lisez pas comme une différence entre deux produits.",
      caption: "Repère de lecture : l’éclairage et le fond influencent cette image. Je ne vous propose pas de comparer deux produits sur la seule base de leur couleur à l’écran.",
    } },
  }, "ig-filter-doubt", [
    { choiceId: "plain", body: "Tu as choisi une image sobre. Inès cherche maintenant un petit repère pour la comparer aux autres photos du fil. Mila propose une précision rapide ou un exemple plus construit, sans te demander de tout refaire.", modifiers: { caption: { energy: 1, haters: -2 }, demo: { energy: 2 } }, person: "ines", text: "Ton image simple me plaît. Je cherche juste à comprendre ce que je peux comparer avec les précédentes." },
    { choiceId: "stylized", body: "Ton ambiance stylisée a mis la couleur au centre des commentaires. Inès a lu ta précision, mais d’autres regardent surtout l’effet. Mila suggère de montrer le rôle de l’éclairage plutôt que de défendre le filtre indéfiniment.", modifiers: { split: growth(4, 7, { haters: 2 }), demo: { trust: 2 } }, person: "sam", text: "Tu avais annoncé le filtre comme une interprétation. Un exemple de lumière rendrait cette limite encore plus concrète." },
    { choiceId: "calibrate", body: "Tu as déjà expliqué ton choix de couleurs. Inès te demande un exemple pour voir ce qu’il change. Mila retrouve tes notes : vous avez la base d’une démonstration, sans repartir dans un débat abstrait sur les filtres.", modifiers: { demo: growth(4, 6, { energy: 3 }), caption: { trust: 1 } }, person: "mila", text: "Ton explication du réglage est prête. Il reste à lui donner un exemple que tout le monde peut regarder." },
  ]),
  continued({
    scenario: {
      id: "ig-filter-style", platform: "instagram", arc: "La couleur du récit", episode: 3, character: "Mila · l’identité en images",
      title: "Une signature sans déguisement", audience: "Des lecteurs qui commencent à reconnaître tes publications",
      body: "Mila te propose de fixer quelques repères pour les prochaines images : une lumière, un cadrage, une façon de légender. « Une signature, pas un uniforme obligatoire pour les pots. » Tu peux construire une série, affirmer une ambiance ou garder un cadre très simple.",
      choices: [
        choice("signature", "Lancer une ambiance reconnaissable", "Tu choisis une direction visuelle marquée et rappelles quand elle relève de l’interprétation.", "Un compte que les curieux peuvent reconnaître rapidement.", "Le style attire des attentes de spectacle et de renouvellement.", "L’ambiance donne une forme identifiable au compte. Les réactions portent davantage sur le style, avec des lecteurs qui attendent désormais un effet visuel régulier.", "reach", "visual", [29, 41, 8, -1, 0, -15]),
        choice("rule", "Garder un repère sobre", "Tu annonces une règle simple de légende et un cadrage facile à retrouver.", "Un cadre lisible sans longue préparation.", "La signature visuelle restera peu spectaculaire.", "Le repère simplifie la lecture des prochaines images. Il laisse de l’air dans le travail, sans donner au compte une nouvelle identité tapageuse.", "care", "community", [1, 4, -8, 3, 0, -6]),
        choice("guide", "Préparer un carnet visuel", "Tu relies exemples, cadrages et limites pour montrer comment tu veux raconter l’atelier.", "Une cohérence fondée sur le travail et ses contraintes.", "La préparation exige plus qu’un simple choix de filtre.", "Le carnet rend la démarche visuelle compréhensible. Les lecteurs intéressés par le fond trouvent des repères, au prix d’un vrai travail de mise en forme.", "craft", "craft", [18, 27, 2, 6, 0, -20]),
      ],
    },
    feed: { author: "mila", image: "still-life", caption: "Je propose une signature visuelle à {{playerAtelier}}. Une signature, pas un uniforme obligatoire pour les pots.", comments: [comment("filter-style-jade", "jade", "Les pots préfèrent les tenues faciles à entretenir."), comment("filter-style-ines", "ines", "J’aime reconnaître un compte sans que toutes les images racontent exactement la même chose.")], choicePosts: {
      signature: "Je choisis une ambiance visuelle pour ce carnet d’atelier. Quand l’image interprète les couleurs, je le précise : le style ne remplace pas le contexte.",
      rule: "Mon repère pour la suite : un cadrage simple et une légende qui dit ce qu’on regarde. Je garde la place pour le travail, même les jours sans grand effet visuel.",
      guide: "Je prépare mon carnet visuel : des exemples, des cadrages et leurs limites. L’idée est de reconnaître l’atelier sans lui faire porter un déguisement différent à chaque image.",
    } },
  }, "ig-filter-proof", [
    { choiceId: "demo", body: "Ta démonstration des éclairages a fourni des repères concrets. Mila propose de les garder dans un carnet visuel : vos prochaines images pourront s’appuyer dessus au lieu de tout réexpliquer.", modifiers: { guide: growth(4, 6, { energy: 3 }), rule: { trust: 1 } }, person: "ines", text: "Avec ton exemple des éclairages, je comprends mieux les repères que tu veux garder." },
    { choiceId: "split", body: "Ton contraste spectaculaire a attiré des regards sur le style. Mila te demande maintenant si cette intensité doit devenir la signature du compte ou rester un exemple ponctuel. La question engage surtout ton rythme de création.", modifiers: { signature: growth(4, 7, { haters: 2 }), rule: { haters: -3 } }, person: "jade", text: "Ton contraste se remarque. Les pots demandent si ce sera leur tenue quotidienne ou celle des grandes occasions." },
    { choiceId: "caption", body: "Ton repère en légende a posé une limite claire sans longue démonstration. Mila suggère de conserver cette simplicité, ou de la développer dans un carnet d’exemples quand tu as envie d’approfondir.", modifiers: { rule: growth(1, 2, { energy: 1 }), guide: { energy: 2 } }, person: "sam", text: "La précision en légende suffit déjà à éviter un raccourci. Garder ce réflexe serait utile." },
  ]),
  {
    scenario: {
      id: "ig-brand-brief", platform: "instagram", arc: "La marque ne tient pas le crayon", episode: 1, character: "Mila · relecture d’un brief",
      title: "Le brief veut parler à ta place", audience: "Des abonnés attentifs à ta liberté de ton",
      body: "Un contact de marque demande tes principes avant d’étudier une collaboration. Il joint un exemple de brief très enthousiaste ; aucun contrat ni paiement n’est proposé. Mila compte les points d’exclamation : « Ils ont recruté toute la ponctuation. » À toi de poser les critères qui comptent pour ton atelier.",
      choices: [
        choice("annotate", "Décortiquer un exemple de brief", "Tu anonymises l’exemple et expliques ce que tu pourrais montrer, vérifier ou refuser.", "Tes critères deviennent compréhensibles.", "La relecture demande une attention réelle.", "Les lecteurs voient comment tu distingues une demande de marque d’un avis personnel. Tes annotations rendent cette indépendance concrète et nourrissent la confiance.", "craft", "craft", [17, 26, 2, 6, 0, -19]),
        choice("principle", "Épingler ta règle en une phrase", "Tu rappelles que les partenariats seront annoncés et que ton avis ne sera pas dicté.", "Un cadre simple sans grande mise en scène.", "La phrase laisse peu de place aux exemples.", "Le repère rend ton intention lisible. Les habitués comprennent la limite sans lancer une longue discussion sur chaque phrase du brief.", "care", "community", [0, 3, -8, 3, 0, -5]),
        choice("pitch", "Mettre les excès du brief en scène", "Tu joues les formulations trop enthousiastes, sans nommer ni exposer le contact.", "Un format drôle peut toucher les curieux.", "Le spectacle peut passer avant tes critères de fond.", "La parodie attire des réactions sur le langage publicitaire. Certains lecteurs cherchent surtout la prochaine pique, pendant que ton cadre de collaboration reste à préciser.", "reach", "visual", [29, 42, 8, -2, 0, -15]),
      ],
    },
    feed: { author: "mila", image: "still-life", caption: "Je relis un exemple de brief pour {{playerAtelier}}. Toute la ponctuation a été embauchée ; maintenant, il faudrait laisser une place à ton avis.", comments: [comment("brand-brief-ines", "ines", "Je veux surtout savoir ce qui restera ton avis quand une marque sera dans le cadre."), comment("brand-brief-noe", "noe", "Les points d’exclamation ont-ils un contrat collectif ?")], choicePosts: {
      annotate: "Je prends un exemple de brief, sans nom de marque, pour expliquer mes critères : ce que je peux montrer, ce que je dois vérifier et ce que je refuse de promettre.",
      principle: "Mon repère : un partenariat sera annoncé comme tel, et mon avis restera le mien. Le brief peut proposer un sujet, pas décider de ma conclusion.",
      pitch: "Lecture d’un brief beaucoup trop enthousiaste : aujourd’hui, les points d’exclamation passent le casting. J’ai anonymisé l’exemple ; le rôle principal reste tenu par la ponctuation.",
    } },
  },
  continued({
    scenario: {
      id: "ig-brand-claim", platform: "instagram", arc: "La marque ne tient pas le crayon", episode: 2, character: "Mila · les mots à vérifier",
      title: "« Une photo parfaite à tous les coups »", audience: "Des lecteurs qui distinguent avis et promesse",
      body: "Dans l’exemple de brief, un fond photo devrait garantir des images « parfaites à tous les coups ». Mila regarde la phrase puis son appareil : « Il faudrait prévenir la lumière. » Tu peux expliquer pourquoi cette promesse ne tient pas, la transformer en gag ou poser une limite brève.",
      choices: [
        choice("parody", "Jouer la promesse impossible", "Tu mets en scène le décalage entre le slogan et les imprévus ordinaires d’une prise de vue.", "Le contraste rend le problème facile à saisir.", "Le gag peut nourrir le cynisme plutôt que la compréhension.", "La promesse devient un sujet de plaisanterie. Des lecteurs reconnaissent le problème, tandis que d’autres généralisent la critique à toute parole de marque.", "reach", "visual", [30, 43, 9, -2, 0, -16]),
        choice("conditions", "Décrire ce que le fond peut changer", "Tu distingues son usage concret des limites liées à la lumière, au sujet et au cadrage.", "Une critique précise sans promesse de résultat magique.", "Construire un exemple honnête demande du travail.", "Les lecteurs disposent d’un raisonnement sur l’usage du matériel. La nuance rend ton avis plus solide et donne une place aux limites que le slogan effaçait.", "craft", "craft", [18, 27, 2, 6, 0, -20]),
        choice("refuse", "Écarter la formule en une phrase", "Tu expliques que tu ne reprendras pas une garantie que tu ne peux pas étayer.", "Une limite nette, peu coûteuse en énergie.", "Tu ne développes pas les usages possibles du produit.", "La phrase pose une frontière claire. Elle calme les attentes autour d’une promesse absolue et te laisse refermer le brief sans prolonger le débat.", "care", "dialogue", [0, 3, -9, 3, 0, -6]),
      ],
    },
    feed: { author: "mila", image: "still-life", caption: "Le fond photo devrait garantir une image parfaite à tous les coups. Quelqu’un a prévenu la lumière ? Elle ne répond jamais aux briefs.", comments: [comment("brand-claim-sam", "sam", "Un usage précis m’intéresse. Une garantie universelle, beaucoup moins."), comment("brand-claim-jade", "jade", "Mon atelier contient un contre-exemple pour presque toutes les promesses parfaites.")], choicePosts: {
      parody: "Une photo parfaite à tous les coups ? Je laisse la lumière, le cadrage et les imprévus répondre au slogan. Cette petite scène parle d’une promesse impossible, pas d’une marque à viser.",
      conditions: "Un fond peut aider à composer une image ; il ne décide pas seul de la lumière ou du cadrage. Je précise ce qu’un exemple permet de dire, sans promettre un résultat universel.",
      refuse: "Je ne reprendrai pas une promesse de photo parfaite à tous les coups. Je peux décrire un usage et ses limites, pas garantir ce que je ne peux pas vérifier.",
    } },
  }, "ig-brand-brief", [
    { choiceId: "annotate", body: "Tu as déjà détaillé tes critères de relecture. La promesse de photo parfaite te fournit un cas concret : montrer où la phrase dépasse ce qu’un usage du matériel permet d’affirmer.", modifiers: { conditions: growth(4, 6, { energy: 3 }), refuse: { trust: 1 } }, person: "sam", text: "Tes annotations donnent un cadre. Cette garantie absolue est un bon exemple de phrase à reprendre." },
    { choiceId: "principle", body: "Tu avais posé une règle courte sur ton indépendance. La promesse absolue lui donne un cas concret : rappeler une limite, ou prendre le temps de montrer pourquoi elle compte.", modifiers: { refuse: { energy: 1, haters: -2 }, conditions: { energy: 2 } }, person: "ines", text: "Ta règle était claire. Ici, je vois exactement le genre de formulation qu’elle peut écarter." },
    { choiceId: "pitch", body: "Ta parodie du brief a mis le ton publicitaire au centre des réactions. La phrase sur les photos parfaites offre un nouveau gag, mais Mila te propose aussi de montrer ce qui distingue une critique utile d’une moquerie en boucle.", modifiers: { parody: growth(4, 7, { haters: 2 }), conditions: { trust: 2 } }, person: "noe", text: "Après les points d’exclamation, la lumière refuse la garantie universelle. Le brief perd du personnel." },
  ]),
  continued({
    scenario: {
      id: "ig-brand-editorial", platform: "instagram", arc: "La marque ne tient pas le crayon", episode: 3, character: "Inès · lectrice du compte",
      title: "La place d’une marque dans ton fil", audience: "Des abonnés qui veulent comprendre tes choix éditoriaux",
      body: "Inès te demande comment une éventuelle publication partenaire trouverait sa place parmi les autres. Elle ne te demande pas une promesse d’absence de publicité, mais un cadre lisible. Mila dessine une case sur le carnet : « On peut réserver une place sans donner tout le cahier. »",
      choices: [
        choice("frame", "Écrire ton cadre de collaboration", "Tu expliques les sujets acceptés, la mention de partenariat et les limites de ton avis.", "Le public comprend ce que tu souhaites préserver.", "Écrire un cadre précis demande du recul.", "Le cadre rend ta ligne éditoriale plus claire. Les lecteurs disposent de repères pour comprendre la place d’une marque parmi tes prochaines publications.", "craft", "craft", [18, 27, 2, 6, 0, -20]),
        choice("short", "Garder une note facile à trouver", "Tu résumes ton indépendance et l’annonce des partenariats dans un repère court.", "Une règle accessible sans alourdir le fil.", "Les cas particuliers resteront à expliquer.", "La note rend le principe visible et laisse respirer le compte. Les habitués peuvent retrouver ta règle sans reprendre toute la discussion.", "care", "community", [1, 4, -8, 3, 0, -6]),
        choice("manifesto", "Présenter tes limites en images", "Tu mets en scène les demandes que tu accepterais ou refuserais dans un format affirmé.", "Une position visuelle qui peut circuler.", "Le public pourra attendre de toi une posture toujours aussi tranchée.", "La présentation rend ta ligne identifiable. Elle attire aussi des réactions très polarisées sur la publicité, au-delà des situations que tu voulais expliquer.", "reach", "visual", [29, 41, 9, -1, 0, -15]),
      ],
    },
    feed: { author: "ines", image: "still-life", caption: "Si une marque entre un jour dans le fil, j’aimerais comprendre la place qu’elle prend. Pas forcément qu’on me promette un monde sans publicité.", comments: [comment("brand-editorial-mila", "mila", "On peut réserver une page sans donner tout le cahier."), comment("brand-editorial-sam", "sam", "Je veux surtout retrouver ta façon d’expliquer les choses, même quand le sujet vient d’une marque.")], choicePosts: {
      frame: "Mon cadre pour une future collaboration : un sujet cohérent, une mention claire et un avis qui garde ses limites. Je partage les critères que je veux défendre.",
      short: "Repère du compte : les partenariats seront annoncés et mon avis restera indépendant. Mon avis garde ses limites, même avec une marque dans le cadre.",
      manifesto: "Ce que je souhaite laisser entrer dans le fil, et ce que je garderai dehors : je présente mes limites en images. Le compte garde sa voix, même quand une marque propose le sujet.",
    } },
  }, "ig-brand-claim", [
    { choiceId: "parody", body: "Ta mise en scène de la promesse impossible a fait du ton publicitaire un sujet à part entière. Inès veut maintenant connaître le cadre que tu garderas au-delà de la plaisanterie.", modifiers: { manifesto: growth(4, 7, { haters: 2 }), frame: { trust: 2 } }, person: "ines", text: "Le gag sur la promesse était clair. J’aimerais savoir quelle règle tu en tires pour le compte." },
    { choiceId: "conditions", body: "Tu as distingué les usages du matériel de ses promesses excessives. Inès propose de conserver cette précision dans ton cadre éditorial, afin que les prochains exemples n’aient pas à repartir de zéro.", modifiers: { frame: growth(4, 6, { energy: 3 }), short: { trust: 1 } }, person: "sam", text: "Ton exemple sépare déjà ce qu’on peut montrer de ce qu’on ne peut pas promettre. C’est une bonne base de cadre." },
    { choiceId: "refuse", body: "Tu as écarté la formule absolue sans allonger la discussion. Inès cherche un repère durable qui explique cette frontière, avec la même simplicité ou avec davantage d’exemples.", modifiers: { short: growth(1, 2, { energy: 1 }), frame: { energy: 2 } }, person: "mila", text: "Ta limite tenait en une phrase. On peut lui garder une place visible dans le carnet." },
  ]),
  {
    scenario: {
      id: "ig-creative-call", platform: "instagram", arc: "Le défi sans gros lot", episode: 1, character: "Jade · idées de quartier",
      title: "Créer avec ce qu’on a déjà", audience: "Des curieux qui aiment participer plutôt que seulement regarder",
      body: "Jade propose un défi : raconter un atelier avec un objet du quotidien. Aucun achat, aucune inscription payante et aucun lot promis ; seulement le plaisir de montrer un regard. Elle choisit une cuillère tordue, puis refuse d’expliquer immédiatement. À toi de donner une forme à l’invitation.",
      choices: [
        choice("open", "Lancer un appel visuel ouvert", "Tu montres le thème avec une image forte et invites le public à proposer sa lecture.", "Une invitation simple à faire circuler.", "Les interprétations peuvent dépasser ce que tu imaginais.", "L’appel donne envie de jouer avec le thème. Il amène aussi des propositions disparates et des débats sur ce qui compte vraiment comme participation.", "reach", "visual", [30, 43, 9, -2, 0, -15]),
        choice("brief", "Préparer un petit brief créatif", "Tu expliques le thème, un exemple et les limites, sans classement annoncé ni récompense.", "Les participants savent quel jeu tu proposes.", "Rendre la consigne claire demande de la préparation.", "Le brief aide les lecteurs à entrer dans le défi. Le cadre limite les malentendus et met l’attention sur la création plutôt que sur une récompense inexistante.", "craft", "craft", [18, 27, 2, 5, 0, -19]),
        choice("circle", "Inviter un petit cercle", "Tu proposes aux habitués de raconter un objet en commentaire, sans organiser une grande collecte.", "Une participation facile à accueillir.", "L’invitation dépasse peu la communauté existante.", "Les habitués trouvent une place pour leur anecdote. Le défi reste modeste et tu n’as pas à animer une avalanche de propositions.", "care", "community", [1, 3, -7, 2, 0, -5]),
      ],
    },
    feed: { author: "jade", image: "community", caption: "Un atelier raconté par un objet du quotidien. Pas de gros lot, pas d’achat, pas de podium : j’arrive avec une cuillère tordue et une histoire.", comments: [comment("creative-call-mila", "mila", "Je peux montrer le thème. Pour redresser la cuillère, je n’ai pas le matériel."), comment("creative-call-ines", "ines", "J’aime bien un défi où mon vieux carnet peut entrer sans avoir à devenir un produit.")], choicePosts: {
      open: "Défi créatif : racontez un atelier avec un objet que vous avez déjà. Rien à acheter et aucun lot promis ; je lance le thème pour voir vos regards.",
      brief: "Notre petit brief : un objet du quotidien, une image ou un récit, et ce qu’il raconte du travail. Aucun paiement ni récompense ; on vient pour créer et échanger.",
      circle: "Les habitués, quel objet raconte un bout de votre atelier ? Une anecdote en commentaire suffit ; on garde ce petit défi à une taille qu’on peut vraiment accueillir.",
    } },
  },
  continued({
    scenario: {
      id: "ig-creative-rules", platform: "instagram", arc: "Le défi sans gros lot", episode: 2, character: "Jade · garder le jeu lisible",
      title: "On gagne quoi, déjà ?", audience: "Des participants qui n’ont pas tous compris le même défi",
      body: "Une personne réclame un classement, une autre veut publier une création faite par quelqu’un d’autre. Jade relit l’invitation : « J’avais pourtant laissé le podium au grenier. » Tu dois préciser le cadre sans transformer ce rendez-vous gratuit en règlement interminable.",
      choices: [
        choice("clarify", "Préciser le cadre avec des exemples", "Tu expliques création personnelle, accord avant reprise et absence de prix ou de classement.", "Les participants comprennent les mêmes limites.", "La mise au point demande de l’attention.", "Les exemples rendent le défi plus clair. Les échanges reviennent aux créations, même si certains espéraient un autre type de concours.", "craft", "craft", [17, 26, 1, 6, 0, -19]),
        choice("show", "Mettre deux approches en regard", "Avec l’accord des personnes, tu montres deux façons de répondre au thème sans désigner de gagnant.", "Une explication visuelle qui peut élargir la participation.", "Les lecteurs peuvent quand même chercher à départager les créations.", "Le contraste rend le défi plus accessible. Il attire aussi des comparaisons et des prises de parti, malgré l’absence de classement.", "reach", "visual", [29, 42, 9, -1, 0, -15]),
        choice("pin", "Épingler les trois repères essentiels", "Tu rappelles participation libre, création attribuée et aucun lot à gagner.", "Une clarification rapide qui calme les attentes.", "Les situations particulières restent peu développées.", "Le repère corrige l’idée d’une récompense à remporter. La conversation ralentit et le défi garde une taille plus facile à suivre.", "care", "community", [0, 3, -9, 3, 0, -5]),
      ],
    },
    feed: { author: "jade", image: "still-life", caption: "On me demande déjà où est le podium du défi. Je l’avais pourtant laissé au grenier : ici, on échange des créations, pas des places.", comments: [comment("creative-rules-sam", "sam", "Dire clairement à qui appartient chaque création aidera aussi."), comment("creative-rules-noe", "noe", "Je retire donc ma candidature au prix du plus beau grenier.")], choicePosts: {
      clarify: "Je précise notre défi avec des exemples : chacun présente sa création, on demande avant de la reprendre et il n’y a ni lot ni classement. Le but reste l’échange.",
      show: "Deux réponses différentes au même thème, présentées avec l’accord de leurs auteurs. Regardez les choix qu’elles racontent ; je ne vous demande pas de désigner un gagnant.",
      pin: "Repères du défi : participation libre, créations attribuées à leurs auteurs, aucun lot à gagner. On peut apprécier les idées sans leur distribuer des places.",
    } },
  }, "ig-creative-call", [
    { choiceId: "open", body: "Ton appel ouvert a fait voyager le thème sans tous ses détails. Jade voit arriver des questions sur un éventuel classement. Tu peux remettre le cadre en avant ou l’expliquer par des créations contrastées.", modifiers: { show: growth(4, 7, { haters: 2 }), clarify: { trust: 2 } }, person: "ines", text: "J’ai vu passer l’image de l’appel avant de lire les détails. Un repère sur le but du défi aiderait." },
    { choiceId: "brief", body: "Tu avais préparé un brief clair. Certaines personnes ont pourtant sauté directement au thème. Jade te propose de reprendre tes exemples : ils peuvent servir de réponse sans transformer les règles en nouvelle compétition.", modifiers: { clarify: growth(4, 6, { energy: 3 }), pin: { trust: 1 } }, person: "sam", text: "Ton brief disait déjà qu’il n’y avait pas de prix. Un exemple rendra le principe plus difficile à manquer." },
    { choiceId: "circle", body: "Tu avais invité un petit cercle à raconter ses objets. Les habitués n’attendent pas un événement, mais une question sur le classement s’est glissée dans l’échange. Un rappel bref peut préserver l’esprit de départ.", modifiers: { pin: { energy: 1, haters: -2 }, clarify: { energy: 2 } }, person: "jade", text: "Pour le petit cercle que tu as invité, je garderais la règle aussi légère que la participation." },
  ]),
  continued({
    scenario: {
      id: "ig-creative-spotlight", platform: "instagram", arc: "Le défi sans gros lot", episode: 3, character: "Jade · partager la lumière",
      title: "Les créations ont un nom", audience: "Les participants et les curieux de leurs univers",
      body: "Le défi a maintenant matière à une conclusion. Jade veut que les personnes qui acceptent une reprise restent identifiables, sans faire croire à un palmarès. La cuillère tordue aura peut-être une explication ; elle exige surtout que le compte ne prenne pas toute la lumière.",
      choices: [
        choice("thanks", "Remercier et passer les liens", "Tu cites les personnes volontaires et invites à découvrir leurs créations directement chez elles.", "La lumière circule sans gros travail de montage.", "Tu restes moins au centre de la publication.", "Les lecteurs peuvent poursuivre chez les participants. Le défi trouve une fin paisible, sans te placer comme propriétaire de toutes les idées présentées.", "care", "community", [1, 4, -8, 3, 0, -6]),
        choice("mosaic", "Composer une mosaïque de regards", "Avec les accords nécessaires, tu réunis des approches contrastées en gardant leurs auteurs visibles.", "Une conclusion visuelle qui peut voyager.", "Le public peut lire une sélection comme un classement.", "La mosaïque rend la diversité du défi visible. Elle suscite aussi des comparaisons sur les choix de présentation, même sans gagnant annoncé.", "reach", "visual", [30, 44, 9, -1, 0, -16]),
        choice("stories", "Raconter les choix des créateurs", "Tu relies les images aux explications de leurs auteurs et à ce qu’ils voulaient montrer.", "Les créations gardent leur contexte.", "Recueillir et mettre en forme les récits prend du temps.", "Les lecteurs comprennent les intentions derrière les objets. La conclusion donne de la place aux participants, avec un travail éditorial plus long à préparer.", "craft", "craft", [19, 28, 2, 6, 0, -21]),
      ],
    },
    feed: { author: "jade", image: "community", caption: "Pour conclure le défi, je veux qu’on retrouve les personnes derrière les créations. La cuillère accepte enfin d’expliquer son parcours.", comments: [comment("creative-spotlight-ines", "ines", "Les liens vers les auteurs m’intéressent autant que la sélection."), comment("creative-spotlight-mila", "mila", "On peut faire une belle conclusion sans coller des médailles sur les objets.")], choicePosts: {
      thanks: "Merci aux personnes qui ont partagé un objet et son histoire. Avec leur accord, je passe leurs liens pour continuer la découverte directement chez elles.",
      mosaic: "Une mosaïque des regards du défi, avec l’accord des personnes présentées et leurs noms bien visibles. Une sélection pour montrer des contrastes, pas un palmarès.",
      stories: "Je laisse les créateurs raconter leurs choix : pourquoi cet objet, pourquoi cette image, et ce qu’ils voulaient partager. Le contexte reste avec chaque création.",
    } },
  }, "ig-creative-rules", [
    { choiceId: "clarify", body: "Tes exemples ont précisé le cadre du défi. Jade propose une conclusion qui garde cette attention au contexte : les personnes ont des choix à raconter, pas seulement une image à prêter.", modifiers: { stories: growth(4, 6, { energy: 3 }), thanks: { trust: 1 } }, person: "ines", text: "Après tes exemples sur le cadre, j’aimerais entendre les choix des auteurs eux-mêmes." },
    { choiceId: "show", body: "Tu as mis deux approches en regard. Certaines réponses comparent encore les créations comme un duel. Jade suggère une conclusion qui rende la diversité visible sans transformer le défi en classement tardif.", modifiers: { mosaic: growth(4, 7, { haters: 2 }), thanks: { haters: -3 } }, person: "mila", text: "Les approches que tu as montrées contrastent bien. Pour la conclusion, gardons les noms aussi visibles que les différences." },
    { choiceId: "pin", body: "Ton rappel épinglé a gardé les règles faciles à retrouver. Jade te propose de conclure sur les personnes plutôt que de rallonger le défi : un relais de liens peut suffire, ou des récits plus développés.", modifiers: { thanks: growth(1, 2, { energy: 1 }), stories: { energy: 2 } }, person: "jade", text: "Tes repères sont posés. On peut maintenant rendre la lumière aux gens qui ont participé." },
  ]),
  {
    scenario: {
      id: "ig-feed-overload", platform: "instagram", arc: "L’atelier hors du téléphone", episode: 1, character: "Mila · le regard qui décroche",
      title: "Trois brouillons, le même coin de table", audience: "Des habitués qui reconnaissent déjà ton décor",
      body: "Mila étale tes prochaines idées : elles montrent toutes le même coin de table, avec un objet déplacé de quelques centimètres. « On a inventé le voyage immobile du carnet. » Tu peux chercher une surprise, changer de question ou garder une publication modeste qui ne te monopolise pas.",
      choices: [
        choice("angle", "Changer franchement de point de vue", "Tu prépares une image inattendue de l’atelier, avec une mise en scène qui assume son effet.", "Une rupture visuelle peut réveiller la curiosité.", "Le public peut attendre une nouvelle surprise à chaque fois.", "Le changement de point de vue attire l’attention sur la mise en scène. Il renouvelle le regard, tout en augmentant les attentes de nouveauté autour du compte.", "reach", "visual", [29, 42, 8, -2, 0, -15]),
        choice("question", "Changer ce que l’image explique", "Tu pars d’une vraie question de métier et construis les images autour de sa réponse.", "La variété vient du fond plutôt que du décor.", "Trouver et préparer le bon exemple demande de l’énergie.", "L’image retrouve une raison d’exister au-delà du cadrage. Les lecteurs intéressés par le travail disposent d’une nouvelle question à explorer.", "craft", "craft", [18, 27, 2, 5, 0, -19]),
        choice("small", "Publier un petit signe de présence", "Tu gardes une image simple et renonces à transformer ce moment en grande séance de contenu.", "Une présence facile à soutenir.", "Tu ne relances pas fortement la découverte du compte.", "Le signe entretient le lien avec les habitués. Il laisse du temps pour l’atelier, sans promettre que chaque passage sur le fil sera un événement.", "care", "community", [0, 3, -8, 2, 0, -5]),
      ],
    },
    feed: { author: "mila", image: "still-life", caption: "Je regarde les prochains brouillons de {{playerAtelier}}. Le carnet a changé de place de quelques centimètres : un grand voyage immobile.", comments: [comment("feed-overload-ines", "ines", "Le décor peut rester. C’est surtout la question derrière l’image que j’aime découvrir."), comment("feed-overload-noe", "noe", "Le carnet demande quand même une indemnité de déplacement.")], choicePosts: {
      angle: "Je regarde l’atelier depuis un angle que je ne vous montre pas d’habitude. La mise en scène change ; le travail reste le point de départ.",
      question: "Plutôt que déplacer encore le carnet, je change de question : quelle décision mérite une explication aujourd’hui ? Je construis les images autour de cet exemple.",
      small: "Un petit signe depuis l’atelier. Pas de grand dispositif aujourd’hui : je garde cette image et je retourne au travail qu’elle raconte.",
    } }, publishedImages: { angle: "workshop", question: "workshop", small: "still-life" },
  },
  continued({
    scenario: {
      id: "ig-feed-calendar", platform: "instagram", arc: "L’atelier hors du téléphone", episode: 2, character: "Mila · un rythme possible",
      title: "Le calendrier veut aussi une pause", audience: "Des lecteurs qui aiment savoir à quoi s’attendre",
      body: "Mila te demande quel rythme tu souhaites annoncer. Le carnet propose beaucoup de sujets ; la journée, moins de place. Tu peux promettre un format ponctuel ambitieux, expliquer comment tu prépares les contenus ou poser une limite courte sans programmer automatiquement de publication.",
      choices: [
        choice("window", "Annoncer des nouvelles quand elles sont prêtes", "Tu poses une limite simple sans promettre une présence permanente ni une cadence automatique.", "Moins d’attente à porter au quotidien.", "Les curieux n’ont pas de grand rendez-vous à anticiper.", "Le message rend ton rythme plus lisible. Une partie de l’attention retombe, mais tu ne transformes pas chaque silence en promesse manquée.", "care", "community", [1, 3, -9, 3, 0, -6]),
        choice("notebook", "Montrer comment tu prépares les sujets", "Tu expliques le passage d’une question au brouillon et la place que cela prend dans l’atelier.", "Le public comprend le travail éditorial réel.", "Documenter ce processus demande une préparation de plus.", "Les lecteurs voient pourquoi les contenus ne sortent pas tous au même rythme. La démarche nourrit la confiance sans créer une programmation automatique.", "craft", "craft", [17, 26, 2, 6, 0, -19]),
        choice("special", "Présenter un format exceptionnel", "Tu annonces l’idée d’un épisode plus ambitieux, sans date ni disponibilité produit promises.", "Une perspective visuelle qui peut susciter la curiosité.", "Le format annoncé crée de nouvelles attentes.", "La présentation attire des questions sur ce futur format. Elle donne de l’élan au récit, mais demande davantage d’attention pour garder les attentes à leur juste place.", "reach", "visual", [28, 40, 8, -2, 0, -14]),
      ],
    },
    feed: { author: "mila", image: "still-life", caption: "Le carnet a beaucoup d’idées. La journée demande à consulter le planning avant de toutes les accueillir.", comments: [comment("feed-calendar-jade", "jade", "Un rythme possible vaut mieux qu’un calendrier qui joue un rôle de fiction."), comment("feed-calendar-ines", "ines", "Je préfère savoir comment ça avance que guetter une publication promise à toute heure.")], choicePosts: {
      window: "Je publierai des nouvelles quand j’aurai quelque chose de prêt à partager. Le compte reste ouvert, mais je ne promets ni présence permanente ni cadence automatique.",
      notebook: "Une question, un brouillon, un exemple à préparer : je vous montre comment un sujet prend forme entre les tâches de l’atelier. Le temps de création fait partie de l’histoire.",
      special: "Je prépare l’idée d’un format plus ambitieux pour raconter l’atelier autrement. Je vous montre la direction, sans promettre de date ni annoncer une disponibilité produit.",
    } },
  }, "ig-feed-overload", [
    { choiceId: "angle", body: "Ton changement de point de vue a placé la surprise au centre de l’image. Mila te demande si tu veux entretenir cette attente ou expliquer ce qu’un tel format demande à préparer. Le calendrier n’a pas gagné de cases supplémentaires.", modifiers: { special: growth(4, 7, { haters: 2 }), window: { haters: -3 } }, person: "ines", text: "Ton angle inhabituel m’a surprise. Je n’attends pas forcément un grand retournement de décor à chaque publication." },
    { choiceId: "question", body: "Tu as construit les images autour d’une question de métier. Le brouillon garde les traces de ce travail. Mila propose de montrer cette préparation pour expliquer ton rythme, plutôt que de faire croire que chaque sujet apparaît tout seul.", modifiers: { notebook: growth(4, 6, { energy: 3 }), window: { trust: 1 } }, person: "sam", text: "L’exemple que tu as préparé a forcément demandé du temps. Montrer ce chemin serait aussi intéressant." },
    { choiceId: "small", body: "Ton petit signe de présence a laissé de la place à l’atelier. Mila te propose d’assumer ce rythme ouvert, ou d’expliquer comment tu choisis les sujets qui méritent un format plus long.", modifiers: { window: { energy: 1, haters: -2 }, notebook: { energy: 2 } }, person: "jade", text: "Le petit signe suffisait. Tu peux garder un rythme qui laisse aussi des journées entières au travail." },
  ]),
  continued({
    scenario: {
      id: "ig-feed-offline", platform: "instagram", arc: "L’atelier hors du téléphone", episode: 3, character: "Jade · rendez-vous sans écran",
      title: "Le téléphone reste sur la patère", audience: "Des voisins qui existent aussi hors du fil",
      body: "Jade propose une discussion entre voisins pour échanger des idées d’atelier, téléphones rangés. Tu peux en garder une trace préparée avec les participants ou simplement annoncer que tu prends ce temps. Mila désigne une patère : « Pour une fois, l’appareil aura une vue sur les manteaux. »",
      choices: [
        choice("portrait", "Préparer un portrait collectif volontaire", "Avant la discussion, les personnes qui le souhaitent participent à une image qui présente la rencontre.", "Le quartier peut se découvrir à travers ses visages.", "Une publication visible ramène aussi des demandes de contenu.", "Le portrait donne une porte d’entrée vers le quartier. Il attire de la curiosité sur les participants, avec de nouvelles sollicitations autour de la rencontre.", "reach", "community", [29, 42, 8, -1, 0, -15]),
        choice("ideas", "Restituer une idée avec son contexte", "Après l’échange, tu choisis une idée dont les participants acceptent la publication et tu l’expliques.", "Le fil reçoit quelque chose d’utile de la rencontre.", "Écouter puis restituer fidèlement demande de l’attention.", "L’idée garde le contexte de la discussion et les limites que vous avez posées. Le compte s’enrichit sans transformer chaque voisin en personnage à exposer.", "craft", "craft", [18, 28, 2, 6, 0, -21]),
        choice("away", "Laisser un mot et ranger le téléphone", "Tu annonces une parenthèse hors du fil, sans promettre de reportage ni de réponse immédiate.", "La rencontre reste un temps choisi pour les voisins.", "Tu ne cherches pas à en tirer une nouvelle visibilité.", "Le mot ferme la boucle sans transformer la rencontre en obligation de publication. Les sollicitations retombent et tu gardes ce temps hors du téléphone.", "care", "community", [0, 3, -10, 3, 0, -5]),
      ],
    },
    feed: { author: "jade", image: "community", caption: "On se retrouve dans {{playerQuartier}} pour parler atelier, téléphones rangés. La patère accueille aussi les appareils qui ne savent pas décrocher.", comments: [comment("feed-offline-mila", "mila", "Mon appareil aura enfin le temps d’étudier les manteaux."), comment("feed-offline-noe", "noe", "Je viendrai avec une idée. Elle peut survivre sans être publiée immédiatement.")], choicePosts: {
      portrait: "Avant de ranger les téléphones, un portrait avec les voisins qui souhaitent apparaître. Cette image ouvre la rencontre ; le reste de la discussion n’a pas besoin d’être filmé.",
      ideas: "Je garde une idée de notre échange de quartier, avec l’accord des personnes concernées et le contexte qui lui donne du sens. Tout n’a pas vocation à devenir du contenu.",
      away: "Je prends un moment avec les voisins et je range le téléphone. Pas de reportage promis ni de réponse immédiate : cette rencontre peut aussi rester hors du fil.",
    } }, publishedImages: { portrait: "community", ideas: "community", away: "still-life" },
  }, "ig-feed-calendar", [
    { choiceId: "window", body: "Tu as annoncé des nouvelles quand elles sont prêtes, sans permanence. La rencontre de Jade tient naturellement dans ce cadre. Tu peux laisser un mot, ou décider d’une trace limitée avec les voisins qui la souhaitent.", modifiers: { away: { energy: 1, haters: -2 }, ideas: { energy: 2 } }, person: "jade", text: "Ton rythme annoncé laisse justement de la place à un moment comme celui-ci, sans écran entre les chaises." },
    { choiceId: "notebook", body: "Tu as expliqué comment tes sujets se préparent. La discussion de quartier peut nourrir une idée avec son contexte, sans devoir devenir un tournage. Jade préfère que vous décidiez ensemble ce qui peut sortir de l’échange.", modifiers: { ideas: growth(4, 6, { energy: 3 }), away: { trust: 1 } }, person: "ines", text: "Après ton carnet de préparation, je comprends mieux qu’une rencontre puisse nourrir une idée sans être filmée du début à la fin." },
    { choiceId: "special", body: "Ton annonce d’un format exceptionnel a créé une attente. La rencontre de Jade pourrait offrir une image collective, mais elle ne constitue pas une commande de contenu. Mila te rappelle que chaque participant peut préférer rester hors cadre.", modifiers: { portrait: growth(4, 7, { haters: 2 }), away: { haters: -3 } }, person: "mila", text: "Ton futur grand format n’oblige pas cette rencontre à devenir son tournage. On décide avec les gens présents." },
  ]),
];
