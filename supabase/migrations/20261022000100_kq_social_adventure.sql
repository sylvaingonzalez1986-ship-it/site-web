BEGIN;

-- Fictional Instagram/X adventure. Only the server RPC may change choices,
-- progression, mental energy, or the followers used by the existing shop.
CREATE TABLE public.kq_social_accounts (
 user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0),
 energy INTEGER NOT NULL DEFAULT 100 CHECK(energy BETWEEN 0 AND 100),
 energy_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 recover_ready_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.kq_social_platforms (
 user_id UUID NOT NULL REFERENCES public.kq_social_accounts(user_id) ON DELETE CASCADE,
 platform TEXT NOT NULL CHECK(platform IN ('instagram','x')),
 followers INTEGER NOT NULL DEFAULT 0 CHECK(followers BETWEEN 0 AND 50000),
 haters INTEGER NOT NULL DEFAULT 0 CHECK(haters BETWEEN 0 AND 100),
 moderation INTEGER NOT NULL DEFAULT 0 CHECK(moderation BETWEEN 0 AND 5),
 chapter INTEGER NOT NULL DEFAULT 0 CHECK(chapter>=0),
 next_post_at TIMESTAMPTZ,
 PRIMARY KEY(user_id,platform)
);
CREATE TABLE public.kq_social_requests (
 user_id UUID NOT NULL REFERENCES public.kq_social_accounts(user_id) ON DELETE CASCADE,
 request_key UUID NOT NULL,
 command JSONB NOT NULL CHECK(jsonb_typeof(command)='object'),
 result JSONB NOT NULL CHECK(jsonb_typeof(result)='object'),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,request_key)
);
CREATE INDEX kq_social_requests_history ON public.kq_social_requests(user_id,created_at DESC,request_key);
ALTER TABLE public.kq_social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_social_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_social_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kq_social_accounts,public.kq_social_platforms,public.kq_social_requests FROM PUBLIC,anon,authenticated,service_role;

-- Catalog is server-owned. The fixture and TypeScript catalog are checked
-- against this literal by scripts/test-placard-social.mjs.
CREATE FUNCTION public.kq_social_catalog() RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $catalog_function$
 SELECT $social_catalog$[
  {
    "id": "ig-first-frame",
    "platform": "instagram",
    "title": "Ton premier cadre",
    "audience": "Des curieux qui découvrent ton atelier",
    "body": "Mila, la photographe du quartier, te propose de présenter ton univers. Sur la table : un carnet, tes outils et un bocal. Quelle image raconterait le mieux ton aventure ?",
    "choices": [
      {
        "id": "workshop",
        "label": "Raconter l’atelier",
        "description": "Un carrousel soigné : les mains, les outils, le travail quotidien.",
        "upside": "Une entrée accueillante pour les curieux.",
        "downside": "Préparer les images demande de l’énergie.",
        "outcome": "Les visiteurs retiennent tes gestes et ton univers. Le carrousel circule et les premiers abonnés s’installent.",
        "effects": {
          "followers": 32,
          "haters": 1,
          "moderation": 0,
          "energy": -10
        }
      },
      {
        "id": "flower",
        "label": "Montrer le gros plan de cannabis",
        "description": "Tu mises tout sur une fleur en plein écran.",
        "upside": "Les connaisseurs reconnaissent ton sujet.",
        "downside": "La modération du jeu limite sa diffusion.",
        "outcome": "La photo plaît à quelques passionnés, puis sa diffusion est limitée. Un avertissement s’ajoute à ton compte.",
        "effects": {
          "followers": 10,
          "haters": 3,
          "moderation": 1,
          "energy": -12
        }
      },
      {
        "id": "sale",
        "label": "Publier une affiche de vente",
        "description": "Un prix énorme, un lien et « achetez maintenant ».",
        "upside": "Un message immédiatement commercial.",
        "downside": "Cette audience n’a pas encore de raison de te faire confiance.",
        "outcome": "L’affiche est signalée. Des visiteurs se détournent du compte avant même de découvrir ton histoire.",
        "effects": {
          "followers": -8,
          "haters": 7,
          "moderation": 2,
          "energy": -8
        }
      }
    ]
  },
  {
    "id": "ig-comment",
    "platform": "instagram",
    "title": "Le commentaire qui pique",
    "audience": "Des abonnés qui observent ta réaction",
    "body": "Sous tes images, un compte écrit : « Encore une marque qui ne montre que du décor. » Ta communauté attend de voir ce que tu vas en faire.",
    "choices": [
      {
        "id": "explain",
        "label": "Montrer le travail derrière l’image",
        "description": "Une courte histoire sur ce que tu fais vraiment, sans attaquer personne.",
        "upside": "Tu transformes la critique en curiosité.",
        "downside": "Expliquer calmement coûte de l’énergie.",
        "outcome": "Ton explication remet le travail au centre. Plusieurs curieux s’abonnent et la tension retombe.",
        "effects": {
          "followers": 24,
          "haters": -6,
          "moderation": 0,
          "energy": -12
        }
      },
      {
        "id": "mock",
        "label": "Tourner le critique en ridicule",
        "description": "Tu l’affiches en story avec une pique bien sentie.",
        "upside": "La polémique attire quelques regards.",
        "downside": "Les critiques reviennent plus nombreuses.",
        "outcome": "La story fait du bruit, mais les commentaires se durcissent. Tu gagnes un peu d’audience et beaucoup de tension.",
        "effects": {
          "followers": 8,
          "haters": 15,
          "moderation": 0,
          "energy": -18
        }
      },
      {
        "id": "mute",
        "label": "Modérer et passer à autre chose",
        "description": "Tu poses une limite aux attaques et reprends ton fil.",
        "upside": "Moins de tension pour la communauté.",
        "downside": "Cette réponse n’attire pas de nouvelle audience.",
        "outcome": "Le fil retrouve son calme. Aucun abonné gagné cette fois, mais les attaques diminuent.",
        "effects": {
          "followers": 0,
          "haters": -10,
          "moderation": 0,
          "energy": -3
        }
      }
    ]
  },
  {
    "id": "ig-collab",
    "platform": "instagram",
    "title": "Une place dans le cadre",
    "audience": "Les amateurs de créations locales",
    "body": "Une céramiste du quartier propose une publication commune. Ses objets et ton atelier partagent un public. Un autre compte te promet aussi une avalanche de visibilité.",
    "choices": [
      {
        "id": "local",
        "label": "Créer avec la céramiste",
        "description": "Vous racontez vos matières, vos gestes et votre quartier.",
        "upside": "Une rencontre cohérente avec ton univers.",
        "downside": "Une collaboration se prépare.",
        "outcome": "Les deux communautés découvrent un univers proche du leur. La collaboration t’apporte des abonnés intéressés.",
        "effects": {
          "followers": 40,
          "haters": 2,
          "moderation": 0,
          "energy": -16
        }
      },
      {
        "id": "shoutout",
        "label": "Choisir le compte qui promet tout",
        "description": "Tu reprends sa publication tapageuse sans vérifier son public.",
        "upside": "Une exposition immédiate.",
        "downside": "Son audience s’intéresse surtout au spectacle.",
        "outcome": "Quelques visiteurs restent, mais la plupart ne comprennent pas ton projet. Les remarques moqueuses affluent.",
        "effects": {
          "followers": 6,
          "haters": 12,
          "moderation": 0,
          "energy": -10
        }
      },
      {
        "id": "solo",
        "label": "Garder une publication simple",
        "description": "Tu remercies la céramiste et publies un détail de ton atelier.",
        "upside": "Un petit rendez-vous facile à tenir.",
        "downside": "Tu laisses passer la rencontre des communautés.",
        "outcome": "Ton image plaît à quelques habitués. La progression reste modeste et régulière.",
        "effects": {
          "followers": 14,
          "haters": 0,
          "moderation": 0,
          "energy": -5
        }
      }
    ]
  },
  {
    "id": "ig-moderation",
    "platform": "instagram",
    "title": "La limite du cadre",
    "audience": "Une communauté qui veut garder le contact",
    "body": "Une nouvelle publication sur le cannabis s’annonce délicate. Mila te rappelle qu’un beau visuel ne protège pas d’une restriction de diffusion dans cette aventure.",
    "choices": [
      {
        "id": "editorial",
        "label": "Recentrer sur le savoir-faire",
        "description": "Tu prépares un récit d’atelier et retires les appels commerciaux sensibles.",
        "upside": "Un signal de modération peut être levé.",
        "downside": "La progression sera plus lente que celle d’une collaboration.",
        "outcome": "Ton fil retrouve une ligne éditoriale claire. La pression de modération baisse et quelques curieux te rejoignent.",
        "effects": {
          "followers": 18,
          "haters": -3,
          "moderation": -1,
          "energy": -10
        }
      },
      {
        "id": "repeat",
        "label": "Republier le visuel signalé",
        "description": "Tu remets exactement la même image en espérant passer cette fois.",
        "upside": "Tu défends ton choix visuel.",
        "downside": "La répétition aggrave la modération.",
        "outcome": "La republication reçoit un nouvel avertissement. Plusieurs abonnés quittent ce fil devenu répétitif.",
        "effects": {
          "followers": -12,
          "haters": 5,
          "moderation": 2,
          "energy": -12
        }
      },
      {
        "id": "archive",
        "label": "Faire le ménage dans le fil",
        "description": "Tu archives les contenus sensibles et annonces une prochaine série d’atelier.",
        "upside": "Deux signaux de modération peuvent être retirés.",
        "downside": "Aucune acquisition d’abonnés aujourd’hui.",
        "outcome": "Le compte retrouve de la marge. Ton audience reste stable pendant que tu prépares la suite.",
        "effects": {
          "followers": 0,
          "haters": -2,
          "moderation": -2,
          "energy": -5
        }
      }
    ]
  },
  {
    "id": "ig-demand",
    "platform": "instagram",
    "title": "Tout le monde veut la suite",
    "audience": "Des visiteurs curieux de ta boutique",
    "body": "Tes publications commencent à être partagées. On te demande quand sortira la prochaine série. Tu peux raconter la suite ou promettre plus que ce que ton atelier sait tenir.",
    "choices": [
      {
        "id": "honest",
        "label": "Montrer les coulisses sans promesse",
        "description": "Tu racontes le rythme de l’atelier et invites chacun à suivre l’aventure.",
        "upside": "Une audience qui comprend ton rythme.",
        "downside": "Pas d’annonce spectaculaire.",
        "outcome": "La transparence plaît. De nouveaux abonnés découvrent ton univers sans attendre une livraison imaginaire.",
        "effects": {
          "followers": 30,
          "haters": -4,
          "moderation": 0,
          "energy": -12
        }
      },
      {
        "id": "hype",
        "label": "Promettre une sortie énorme",
        "description": "Tu annonces que tout sera disponible, sans regarder ce que tu peux proposer.",
        "upside": "Le suspense apporte un pic d’attention.",
        "downside": "Les attentes et les haters montent ensemble.",
        "outcome": "L’annonce attire des abonnés, mais les commentaires réclament déjà ce que tu as promis. La pression grimpe.",
        "effects": {
          "followers": 38,
          "haters": 20,
          "moderation": 0,
          "energy": -20
        }
      },
      {
        "id": "silent",
        "label": "Laisser les messages sans réponse",
        "description": "Tu continues à publier sans répondre aux questions.",
        "upside": "Peu de préparation.",
        "downside": "Les curieux ont l’impression de parler dans le vide.",
        "outcome": "L’élan retombe. Quelques personnes se désabonnent, faute de comprendre la suite.",
        "effects": {
          "followers": -8,
          "haters": 6,
          "moderation": 0,
          "energy": -4
        }
      }
    ]
  },
  {
    "id": "ig-identity",
    "platform": "instagram",
    "title": "Le visage de ta marque",
    "audience": "Ceux qui te suivent pour ton univers",
    "body": "Une tendance visuelle envahit le fil. Mila te demande : « Si tout le monde publie la même chose, comment reconnaîtra-t-on ton atelier ? »",
    "choices": [
      {
        "id": "signature",
        "label": "Créer ta propre série",
        "description": "Tu déclines une idée qui raconte ton parcours en plusieurs images.",
        "upside": "Une identité que l’on retient.",
        "downside": "La création demande un vrai effort mental.",
        "outcome": "La série est partagée pour ce qu’elle raconte de toi. Ton univers gagne une nouvelle vague d’abonnés.",
        "effects": {
          "followers": 36,
          "haters": 2,
          "moderation": 0,
          "energy": -16
        }
      },
      {
        "id": "copy",
        "label": "Copier la tendance mot pour mot",
        "description": "Tu reprends une publication populaire jusque dans sa légende.",
        "upside": "C’est rapide à préparer.",
        "downside": "Les habitués reconnaissent la copie.",
        "outcome": "La publication passe presque inaperçue. Quelques critiques soulignent le manque de personnalité.",
        "effects": {
          "followers": 4,
          "haters": 8,
          "moderation": 0,
          "energy": -6
        }
      },
      {
        "id": "thanks",
        "label": "Remercier la communauté",
        "description": "Un message simple avec un détail de ton quotidien.",
        "upside": "Un rendez-vous chaleureux et peu fatigant.",
        "downside": "La croissance reste modeste.",
        "outcome": "Les habitués apprécient l’attention. Quelques amis les rejoignent et l’ambiance s’apaise.",
        "effects": {
          "followers": 16,
          "haters": -5,
          "moderation": 0,
          "energy": -5
        }
      }
    ]
  },
  {
    "id": "x-first-thread",
    "platform": "x",
    "title": "Prendre la parole",
    "audience": "Des connaisseurs qui demandent des arguments",
    "body": "Noé t’invite dans une discussion sur le travail artisanal. Ici, une jolie image ne suffit pas : on attend ton point de vue, et parfois on le conteste sèchement.",
    "choices": [
      {
        "id": "thread",
        "label": "Écrire un fil concret",
        "description": "Tu racontes un apprentissage, ses limites et ce que tu ferais autrement.",
        "upside": "Les passionnés apprécient la précision.",
        "downside": "Argumenter coûte plus d’énergie que publier une image.",
        "outcome": "Le fil trouve un petit public attentif. Quelques contradicteurs arrivent aussi : sur X, la croissance se gagne.",
        "effects": {
          "followers": 14,
          "haters": 4,
          "moderation": 0,
          "energy": -18
        }
      },
      {
        "id": "slogan",
        "label": "Lancer une certitude provocante",
        "description": "Tu simplifies tout en une phrase qui cherche la réaction.",
        "upside": "La formule attire immédiatement des réponses.",
        "downside": "Les haters pèsent vite sur ton moral.",
        "outcome": "La phrase circule, mais la discussion tourne à l’affrontement. Peu d’abonnés restent face au bruit.",
        "effects": {
          "followers": 5,
          "haters": 18,
          "moderation": 0,
          "energy": -24
        }
      },
      {
        "id": "listen",
        "label": "Poser une vraie question",
        "description": "Tu demandes comment les autres abordent le même problème.",
        "upside": "Un échange accessible et moins fatigant.",
        "downside": "L’audience se construit lentement.",
        "outcome": "Quelques passionnés répondent. Une petite conversation commence sans te mettre au centre d’une polémique.",
        "effects": {
          "followers": 7,
          "haters": 1,
          "moderation": 0,
          "energy": -10
        }
      }
    ]
  },
  {
    "id": "x-pile-on",
    "platform": "x",
    "title": "Le fil s’échauffe",
    "audience": "Des lecteurs partagés entre curiosité et conflit",
    "body": "Un compte cite ton message hors contexte. Les notifications s’empilent. Noé te prévient : répondre à tout risque de dévorer l’énergie qu’il te reste.",
    "choices": [
      {
        "id": "clarify",
        "label": "Clarifier une fois, puis couper",
        "description": "Tu redonnes le contexte et annonces que tu quittes la discussion.",
        "upside": "Tu défends ton propos sans entretenir le conflit.",
        "downside": "La clarification demande du recul.",
        "outcome": "Des lecteurs retrouvent le sens de ton message. Quelques-uns s’abonnent et une partie des attaques s’éteint.",
        "effects": {
          "followers": 10,
          "haters": -10,
          "moderation": 0,
          "energy": -18
        }
      },
      {
        "id": "fight",
        "label": "Répondre à chaque attaque",
        "description": "Tu t’installes pour gagner le dernier mot, réponse après réponse.",
        "upside": "Tu occupes toute la conversation.",
        "downside": "Très forte dépense mentale et nouveaux haters.",
        "outcome": "Le fil ne s’arrête plus. L’épuisement se voit dans tes réponses ; des abonnés partent et les attaques se multiplient.",
        "effects": {
          "followers": -10,
          "haters": 25,
          "moderation": 0,
          "energy": -32
        }
      },
      {
        "id": "mute",
        "label": "Couper les notifications",
        "description": "Tu poses une limite et laisses retomber le fil.",
        "upside": "Les haters perdent une occasion de relancer.",
        "downside": "Aucun nouvel abonné gagné.",
        "outcome": "Le bruit décroît. Ton audience ne progresse pas, mais tu as évité une longue escalade.",
        "effects": {
          "followers": 0,
          "haters": -15,
          "moderation": 0,
          "energy": -4
        }
      }
    ]
  },
  {
    "id": "x-proof",
    "platform": "x",
    "title": "« Tu peux expliquer ? »",
    "audience": "Des lecteurs qui vérifient les grandes affirmations",
    "body": "Ton dernier message a suscité une question précise. Tu connais une partie de la réponse, mais pas tout. La manière de reconnaître cette limite peut changer la discussion.",
    "choices": [
      {
        "id": "nuance",
        "label": "Partager ce que tu sais, avec ses limites",
        "description": "Tu distingues ton expérience des points qui restent incertains.",
        "upside": "Les lecteurs exigeants apprécient la nuance.",
        "downside": "Une réponse soignée prend de l’énergie.",
        "outcome": "Ton honnêteté nourrit un échange utile. Une poignée de passionnés rejoint le compte et la tension baisse.",
        "effects": {
          "followers": 16,
          "haters": -6,
          "moderation": 0,
          "energy": -20
        }
      },
      {
        "id": "bluff",
        "label": "Faire comme si tu savais tout",
        "description": "Tu ajoutes une explication péremptoire pour garder la face.",
        "upside": "Une réponse rapide et assurée.",
        "downside": "La contradiction peut coûter des abonnés.",
        "outcome": "Une réponse démonte ton affirmation. Plusieurs abonnés partent, et le fil attire de nouveaux haters.",
        "effects": {
          "followers": -14,
          "haters": 18,
          "moderation": 0,
          "energy": -22
        }
      },
      {
        "id": "admit",
        "label": "Dire que tu dois vérifier",
        "description": "Tu remercies la personne sans inventer de réponse.",
        "upside": "Tu désamorces la confrontation.",
        "downside": "Peu de visibilité supplémentaire.",
        "outcome": "Les lecteurs apprécient la franchise. Tu gagnes une petite audience sans prolonger inutilement le débat.",
        "effects": {
          "followers": 6,
          "haters": -5,
          "moderation": 0,
          "energy": -8
        }
      }
    ]
  },
  {
    "id": "x-rival",
    "platform": "x",
    "title": "Le rival te mentionne",
    "audience": "Deux communautés prêtes à se comparer",
    "body": "Un autre artisan affirme que sa méthode vaut mieux que la tienne. Sa communauté est déjà dans les réponses. Tu peux nourrir la rivalité ou ouvrir une discussion.",
    "choices": [
      {
        "id": "exchange",
        "label": "Comparer vos expériences",
        "description": "Tu proposes d’expliquer vos choix et leurs contraintes respectives.",
        "upside": "Des lecteurs découvrent ton point de vue.",
        "downside": "Même un échange courtois attire des contradicteurs.",
        "outcome": "La comparaison devient intéressante. Quelques membres de l’autre communauté te suivent, avec leur lot de critiques.",
        "effects": {
          "followers": 18,
          "haters": 5,
          "moderation": 0,
          "energy": -22
        }
      },
      {
        "id": "attack",
        "label": "Attaquer sa compétence",
        "description": "Tu transformes la différence de méthode en affaire personnelle.",
        "upside": "La rivalité fait parler.",
        "downside": "Le coût mental et les haters explosent.",
        "outcome": "Le clash prend toute la place. Un peu d’audience arrive, surtout pour voir la dispute continuer.",
        "effects": {
          "followers": 4,
          "haters": 24,
          "moderation": 0,
          "energy": -30
        }
      },
      {
        "id": "decline",
        "label": "Refuser le concours d’ego",
        "description": "Tu remercies pour l’échange et retournes à ton travail.",
        "upside": "La tension retombe.",
        "downside": "Tu laisses passer une occasion de visibilité.",
        "outcome": "La discussion s’arrête sans duel public. Quelques lecteurs apprécient ta retenue.",
        "effects": {
          "followers": 3,
          "haters": -8,
          "moderation": 0,
          "energy": -6
        }
      }
    ]
  },
  {
    "id": "x-spotlight",
    "platform": "x",
    "title": "Sous les projecteurs",
    "audience": "Des curieux arrivés par un compte influent",
    "body": "Un compte suivi partage ton travail. Les questions arrivent plus vite que tes réponses. Cette visibilité peut devenir une communauté ou une course aux promesses.",
    "choices": [
      {
        "id": "welcome",
        "label": "Accueillir avec un fil de présentation",
        "description": "Tu expliques ton projet, ton rythme et ce que les visiteurs peuvent découvrir.",
        "upside": "Les nouveaux venus savent pourquoi te suivre.",
        "downside": "Accueillir ce public demande de l’attention.",
        "outcome": "Une partie des visiteurs reste pour ton projet. Tu gagnes des abonnés et quelques nouveaux contradicteurs.",
        "effects": {
          "followers": 18,
          "haters": 6,
          "moderation": 0,
          "energy": -24
        }
      },
      {
        "id": "promise",
        "label": "Promettre de répondre à tout le monde",
        "description": "Tu annonces une disponibilité permanente pour entretenir l’élan.",
        "upside": "Un peu d’audience supplémentaire.",
        "downside": "La promesse entretient la pression mentale.",
        "outcome": "Les sollicitations s’accumulent. Les attentes déçues prennent le dessus sur les nouvelles rencontres.",
        "effects": {
          "followers": 8,
          "haters": 18,
          "moderation": 0,
          "energy": -30
        }
      },
      {
        "id": "boundaries",
        "label": "Annoncer un rythme raisonnable",
        "description": "Tu regroupes les questions et gardes du temps pour l’atelier.",
        "upside": "Un cadre qui apaise les échanges.",
        "downside": "Une croissance moins rapide.",
        "outcome": "La communauté comprend ton rythme. Moins de monde s’abonne, mais la pression diminue.",
        "effects": {
          "followers": 9,
          "haters": -8,
          "moderation": 0,
          "energy": -12
        }
      }
    ]
  },
  {
    "id": "x-community",
    "platform": "x",
    "title": "Une communauté, pas une arène",
    "audience": "Les habitués qui reviennent discuter",
    "body": "Noé te propose un rendez-vous pour partager vos erreurs et vos découvertes. Tu peux en faire un échange utile, un nouveau classement ou simplement passer le micro.",
    "choices": [
      {
        "id": "roundtable",
        "label": "Organiser un échange d’expériences",
        "description": "Chacun raconte une réussite, une erreur et une question encore ouverte.",
        "upside": "Les passionnés ont une raison de revenir.",
        "downside": "Animer l’échange demande de l’énergie.",
        "outcome": "Les participants recommandent la discussion. Ton audience progresse et l’ambiance se détend.",
        "effects": {
          "followers": 16,
          "haters": -10,
          "moderation": 0,
          "energy": -20
        }
      },
      {
        "id": "ranking",
        "label": "Classer publiquement les autres",
        "description": "Tu publies un podium des artisans et soulignes les derniers.",
        "upside": "Le classement déclenche des réactions.",
        "downside": "Les rivalités attirent surtout les haters.",
        "outcome": "La discussion se réduit aux places du classement. Tu perds des abonnés et ravives les tensions.",
        "effects": {
          "followers": -6,
          "haters": 20,
          "moderation": 0,
          "energy": -24
        }
      },
      {
        "id": "share",
        "label": "Mettre en avant un autre artisan",
        "description": "Tu partages un travail que tu apprécies en expliquant pourquoi.",
        "upside": "Un lien utile entre communautés.",
        "downside": "Tu n’es pas le centre de la publication.",
        "outcome": "Le geste est apprécié. Quelques lecteurs curieux te rejoignent et les échanges gagnent en calme.",
        "effects": {
          "followers": 8,
          "haters": -6,
          "moderation": 0,
          "energy": -10
        }
      }
    ]
  }
]$social_catalog$::JSONB;
$catalog_function$;

CREATE FUNCTION public.kq_social_scenario(p_platform TEXT,p_chapter INTEGER) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT (jsonb_agg(item ORDER BY ordinal))->(p_chapter%6)
 FROM jsonb_array_elements(public.kq_social_catalog()) WITH ORDINALITY entries(item,ordinal)
 WHERE item->>'platform'=p_platform;
$$;

CREATE FUNCTION public.kq_social_snapshot(p_user UUID,p_replayed BOOLEAN DEFAULT false) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object('version',1,'serverNow',now(),'revision',s.revision,
  'energy',s.energy,'energyUpdatedAt',s.energy_updated_at,'recoverReadyAt',s.recover_ready_at,
  'audienceFollowers',o.followers,'socialFollowers',totals.followers,'replayed',p_replayed,
  'siteActive',COALESCE(a.computer_owned AND a.shop_created_at IS NOT NULL
   AND (o.site_tier='basic' OR (NOT a.shop_suspended AND a.shop_paid_until>now())),false),
  'additionalVisitsPerDay',round((LEAST(o.followers,5000)-LEAST(GREATEST(0,o.followers-totals.followers),5000))*.12
   *(1+GREATEST(0,LEAST(.25,w.reputation::NUMERIC/6000))),6),
  'platforms',(SELECT jsonb_object_agg(p.platform,jsonb_build_object('followers',p.followers,'haters',p.haters,
   'moderation',p.moderation,'chapter',p.chapter,'nextPostAt',p.next_post_at)) FROM public.kq_social_platforms p WHERE p.user_id=p_user),
  'history',COALESCE((SELECT jsonb_agg(h.result ORDER BY h.created_at DESC,h.request_key)
   FROM (SELECT result,created_at,request_key FROM public.kq_social_requests WHERE user_id=p_user
    ORDER BY created_at DESC,request_key LIMIT 20) h),'[]'::JSONB))
 FROM public.kq_social_accounts s JOIN public.kq_online_accounts o USING(user_id)
 JOIN public.kq_commerce_accounts a USING(user_id) JOIN public.kq_equipment_wallets w USING(user_id)
 CROSS JOIN LATERAL (SELECT COALESCE(sum(p.followers),0)::INTEGER followers FROM public.kq_social_platforms p WHERE p.user_id=p_user) totals
 WHERE s.user_id=p_user;
$$;

CREATE FUNCTION public.rpc_kq_social(p_user_id UUID,p_command JSONB DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE account public.kq_social_accounts%ROWTYPE; network public.kq_social_platforms%ROWTYPE;
 previous public.kq_social_requests%ROWTYPE; v_request_key UUID; action TEXT; platform_code TEXT; expected_revision INTEGER;
 scenario JSONB; choice JSONB; effect JSONB; entry JSONB; steps INTEGER; online_followers INTEGER;
 follower_delta INTEGER:=0; hater_delta INTEGER:=0; moderation_delta INTEGER:=0; energy_delta INTEGER:=0;
BEGIN
 IF p_user_id IS NULL THEN RAISE EXCEPTION 'social_invalid'; END IF;
 -- Use the same equipment lock as commerce before touching its wallet/accounts.
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 IF NOT EXISTS(SELECT 1 FROM public.kq_equipment_wallets WHERE user_id=p_user_id) THEN RAISE EXCEPTION 'social_profile'; END IF;
 IF p_command IS NOT NULL THEN
  IF jsonb_typeof(p_command) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'social_invalid'; END IF;
  action:=p_command->>'action';
  IF action IS NULL OR action NOT IN ('choose','recover')
   OR jsonb_typeof(p_command->'requestKey') IS DISTINCT FROM 'string'
   OR COALESCE(p_command->>'requestKey','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
   OR jsonb_typeof(p_command->'expectedRevision') IS DISTINCT FROM 'number'
   OR COALESCE(p_command->>'expectedRevision','') !~ '^[0-9]{1,10}$'
   OR (p_command->>'expectedRevision')::NUMERIC>2147483646
   OR (action='recover' AND p_command-ARRAY['action','requestKey','expectedRevision']<>'{}'::JSONB)
   OR (action='choose' AND p_command-ARRAY['action','requestKey','expectedRevision','platform','scenarioId','choiceId']<>'{}'::JSONB)
   THEN RAISE EXCEPTION 'social_invalid'; END IF;
  v_request_key:=(p_command->>'requestKey')::UUID;
  expected_revision:=(p_command->>'expectedRevision')::INTEGER;
  IF action='choose' AND (jsonb_typeof(p_command->'platform') IS DISTINCT FROM 'string'
   OR p_command->>'platform' NOT IN ('instagram','x')
   OR jsonb_typeof(p_command->'scenarioId') IS DISTINCT FROM 'string'
   OR jsonb_typeof(p_command->'choiceId') IS DISTINCT FROM 'string') THEN RAISE EXCEPTION 'social_invalid'; END IF;
 END IF;

 -- Settle all accrued commerce at the old follower count before this action
 -- changes future demand. Marketing-earned followers are preserved.
 PERFORM public.kq_business_settle(p_user_id);
 INSERT INTO public.kq_social_accounts(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING;
 INSERT INTO public.kq_social_platforms(user_id,platform) VALUES(p_user_id,'instagram'),(p_user_id,'x') ON CONFLICT DO NOTHING;
 SELECT * INTO account FROM public.kq_social_accounts WHERE user_id=p_user_id FOR UPDATE;
 -- Keep partial five-minute intervals. A refresh cannot discard recovery time
 -- or bank recovery while already at the 100-point maximum.
 steps:=LEAST(100,GREATEST(0,floor(EXTRACT(EPOCH FROM (now()-account.energy_updated_at))/300)))::INTEGER;
 UPDATE public.kq_social_accounts SET energy=LEAST(100,energy+steps),
  energy_updated_at=CASE WHEN energy+steps>=100 THEN now() ELSE energy_updated_at+steps*interval '5 minutes' END
  WHERE user_id=p_user_id RETURNING * INTO account;
 IF p_command IS NULL THEN RETURN public.kq_social_snapshot(p_user_id); END IF;

 SELECT * INTO previous FROM public.kq_social_requests r WHERE r.user_id=p_user_id AND r.request_key=v_request_key;
 IF FOUND THEN
  IF previous.command IS DISTINCT FROM p_command THEN RAISE EXCEPTION 'social_request_mismatch'; END IF;
  RETURN public.kq_social_snapshot(p_user_id,true);
 END IF;
 IF expected_revision<>account.revision THEN RAISE EXCEPTION 'social_changed'; END IF;

 IF action='recover' THEN
  IF account.recover_ready_at>now() THEN RAISE EXCEPTION 'social_recover_cooldown'; END IF;
  IF account.energy>=100 THEN RAISE EXCEPTION 'social_energy_full'; END IF;
  energy_delta:=LEAST(30,100-account.energy);
  UPDATE public.kq_social_accounts SET energy=energy+energy_delta,recover_ready_at=now()+interval '4 hours',
   energy_updated_at=CASE WHEN energy+energy_delta>=100 THEN now() ELSE energy_updated_at END WHERE user_id=p_user_id;
  entry:=jsonb_build_object('id',v_request_key,'platform',NULL,'scenarioId','recover','choiceId','recover','createdAt',now(),
   'outcome','Tu coupes les notifications et prends du recul. Ton énergie mentale remonte.',
   'followersDelta',0,'hatersDelta',0,'moderationDelta',0,'energyDelta',energy_delta);
 ELSE
  platform_code:=p_command->>'platform';
  SELECT * INTO network FROM public.kq_social_platforms WHERE user_id=p_user_id AND platform=platform_code FOR UPDATE;
  scenario:=public.kq_social_scenario(platform_code,network.chapter);
  IF scenario IS NULL OR p_command->>'scenarioId' IS DISTINCT FROM scenario->>'id' THEN RAISE EXCEPTION 'social_changed'; END IF;
  SELECT item INTO choice FROM jsonb_array_elements(scenario->'choices') item WHERE item->>'id'=p_command->>'choiceId';
  IF choice IS NULL THEN RAISE EXCEPTION 'social_invalid'; END IF;
  IF network.next_post_at>now() THEN RAISE EXCEPTION 'social_cooldown'; END IF;
  effect:=choice->'effects';
  energy_delta:=(effect->>'energy')::INTEGER-CASE WHEN platform_code='x' AND network.haters>=40 THEN 5 ELSE 0 END;
  IF account.energy+energy_delta<0 THEN RAISE EXCEPTION 'social_energy'; END IF;
  energy_delta:=LEAST(100,account.energy+energy_delta)-account.energy;
  follower_delta:=(effect->>'followers')::INTEGER;
  IF follower_delta>0 THEN
   follower_delta:=follower_delta*LEAST(3,1+network.followers/250);
   IF platform_code='instagram' AND network.moderation>=3 THEN follower_delta:=floor(follower_delta/2.0)::INTEGER; END IF;
  END IF;
  SELECT followers INTO online_followers FROM public.kq_online_accounts WHERE user_id=p_user_id FOR UPDATE;
  follower_delta:=GREATEST(-network.followers,LEAST(50000-network.followers,follower_delta));
  follower_delta:=GREATEST(-online_followers,LEAST(100000-online_followers,follower_delta));
  hater_delta:=GREATEST(0,LEAST(100,network.haters+(effect->>'haters')::INTEGER))-network.haters;
  moderation_delta:=GREATEST(0,LEAST(5,network.moderation+(effect->>'moderation')::INTEGER))-network.moderation;
  UPDATE public.kq_social_platforms SET followers=followers+follower_delta,haters=haters+hater_delta,
   moderation=moderation+moderation_delta,chapter=chapter+1,next_post_at=now()+interval '5 minutes'
   WHERE user_id=p_user_id AND platform=platform_code;
  UPDATE public.kq_social_accounts SET energy=energy+energy_delta,
   energy_updated_at=CASE WHEN energy+energy_delta>=100 THEN now() ELSE energy_updated_at END WHERE user_id=p_user_id;
  UPDATE public.kq_online_accounts SET followers=followers+follower_delta,revision=revision+1 WHERE user_id=p_user_id;
  entry:=jsonb_build_object('id',v_request_key,'platform',platform_code,'scenarioId',scenario->>'id','choiceId',choice->>'id','createdAt',now(),
   'outcome',choice->>'outcome','followersDelta',follower_delta,'hatersDelta',hater_delta,'moderationDelta',moderation_delta,'energyDelta',energy_delta);
 END IF;
 UPDATE public.kq_social_accounts SET revision=revision+1 WHERE user_id=p_user_id;
 INSERT INTO public.kq_social_requests(user_id,request_key,command,result) VALUES(p_user_id,v_request_key,p_command,entry);
 RETURN public.kq_social_snapshot(p_user_id);
END $$;

REVOKE ALL ON FUNCTION public.kq_social_catalog(),public.kq_social_scenario(TEXT,INTEGER),
 public.kq_social_snapshot(UUID,BOOLEAN),public.rpc_kq_social(UUID,JSONB) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_social(UUID,JSONB) TO service_role;

COMMIT;
