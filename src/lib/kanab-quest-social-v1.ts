/** Fictional social networks inside Kanab Quest. Effects mirror rpc_kq_social. */
export type KqSocialPlatform = "instagram" | "x";
export type KqSocialEffects = { followers: number; haters: number; moderation: number; energy: number };
export type KqSocialChoice = { id: string; label: string; description: string; upside: string; downside: string; outcome: string; effects: KqSocialEffects };
export type KqSocialScenario = { id: string; platform: KqSocialPlatform; title: string; body: string; audience: string; choices: KqSocialChoice[] };
export type KqSocialAccount = { followers: number; haters: number; moderation: number; chapter: number; nextPostAt: string | null };
export type KqSocialHistoryEntry = { id: string; platform: KqSocialPlatform | null; scenarioId: string; choiceId: string; createdAt: string; outcome: string; followersDelta: number; hatersDelta: number; moderationDelta: number; energyDelta: number };
export type KqSocialSnapshot = {
  version: 1; serverNow: string; revision: number; energy: number; energyUpdatedAt: string; recoverReadyAt: string | null;
  audienceFollowers: number; socialFollowers: number; additionalVisitsPerDay: number; siteActive: boolean;
  platforms: Record<KqSocialPlatform, KqSocialAccount>; history: KqSocialHistoryEntry[]; replayed?: boolean;
};
export type KqSocialCommand = { action: "choose"; requestKey: string; expectedRevision: number; platform: KqSocialPlatform; scenarioId: string; choiceId: string }
  | { action: "recover"; requestKey: string; expectedRevision: number };
export const KQ_SOCIAL_POST_MS = 5 * 60_000;
export const KQ_SOCIAL_RECOVER_MS = 4 * 60 * 60_000;
export const KQ_SOCIAL_ENERGY_TICK_MS = 5 * 60_000;
export const KQ_SOCIAL_PLATFORMS = [
  { id: "instagram", name: "Instagram", audience: "Curieux, amateurs de belles images et de marques artisanales", upside: "Le visuel attire plus vite de nouveaux abonnés.", downside: "Dans le jeu, les publications qui montrent ou vendent du cannabis risquent la modération." },
  { id: "x", name: "X", audience: "Passionnés, connaisseurs et contradicteurs", upside: "Les échanges argumentés construisent une communauté exigeante.", downside: "Moins d’abonnés par publication, plus de haters et une énergie mentale qui baisse plus vite." },
] as const;

function choice(id: string, label: string, description: string, upside: string, downside: string, outcome: string, followers: number, haters: number, moderation: number, energy: number): KqSocialChoice {
  return { id, label, description, upside, downside, outcome, effects: { followers, haters, moderation, energy } };
}

export const KQ_SOCIAL_SCENARIOS: KqSocialScenario[] = [
  {
    id: "ig-first-frame", platform: "instagram", title: "Ton premier cadre", audience: "Des curieux qui découvrent ton atelier",
    body: "Mila, la photographe du quartier, te propose de présenter ton univers. Sur la table : un carnet, tes outils et un bocal. Quelle image raconterait le mieux ton aventure ?",
    choices: [
      choice("workshop", "Raconter l’atelier", "Un carrousel soigné : les mains, les outils, le travail quotidien.", "Une entrée accueillante pour les curieux.", "Préparer les images demande de l’énergie.", "Les visiteurs retiennent tes gestes et ton univers. Le carrousel circule et les premiers abonnés s’installent.", 32, 1, 0, -10),
      choice("flower", "Montrer le gros plan de cannabis", "Tu mises tout sur une fleur en plein écran.", "Les connaisseurs reconnaissent ton sujet.", "La modération du jeu limite sa diffusion.", "La photo plaît à quelques passionnés, puis sa diffusion est limitée. Un avertissement s’ajoute à ton compte.", 10, 3, 1, -12),
      choice("sale", "Publier une affiche de vente", "Un prix énorme, un lien et « achetez maintenant ».", "Un message immédiatement commercial.", "Cette audience n’a pas encore de raison de te faire confiance.", "L’affiche est signalée. Des visiteurs se détournent du compte avant même de découvrir ton histoire.", -8, 7, 2, -8),
    ],
  },
  {
    id: "ig-comment", platform: "instagram", title: "Le commentaire qui pique", audience: "Des abonnés qui observent ta réaction",
    body: "Sous tes images, un compte écrit : « Encore une marque qui ne montre que du décor. » Ta communauté attend de voir ce que tu vas en faire.",
    choices: [
      choice("explain", "Montrer le travail derrière l’image", "Une courte histoire sur ce que tu fais vraiment, sans attaquer personne.", "Tu transformes la critique en curiosité.", "Expliquer calmement coûte de l’énergie.", "Ton explication remet le travail au centre. Plusieurs curieux s’abonnent et la tension retombe.", 24, -6, 0, -12),
      choice("mock", "Tourner le critique en ridicule", "Tu l’affiches en story avec une pique bien sentie.", "La polémique attire quelques regards.", "Les critiques reviennent plus nombreuses.", "La story fait du bruit, mais les commentaires se durcissent. Tu gagnes un peu d’audience et beaucoup de tension.", 8, 15, 0, -18),
      choice("mute", "Modérer et passer à autre chose", "Tu poses une limite aux attaques et reprends ton fil.", "Moins de tension pour la communauté.", "Cette réponse n’attire pas de nouvelle audience.", "Le fil retrouve son calme. Aucun abonné gagné cette fois, mais les attaques diminuent.", 0, -10, 0, -3),
    ],
  },
  {
    id: "ig-collab", platform: "instagram", title: "Une place dans le cadre", audience: "Les amateurs de créations locales",
    body: "Une céramiste du quartier propose une publication commune. Ses objets et ton atelier partagent un public. Un autre compte te promet aussi une avalanche de visibilité.",
    choices: [
      choice("local", "Créer avec la céramiste", "Vous racontez vos matières, vos gestes et votre quartier.", "Une rencontre cohérente avec ton univers.", "Une collaboration se prépare.", "Les deux communautés découvrent un univers proche du leur. La collaboration t’apporte des abonnés intéressés.", 40, 2, 0, -16),
      choice("shoutout", "Choisir le compte qui promet tout", "Tu reprends sa publication tapageuse sans vérifier son public.", "Une exposition immédiate.", "Son audience s’intéresse surtout au spectacle.", "Quelques visiteurs restent, mais la plupart ne comprennent pas ton projet. Les remarques moqueuses affluent.", 6, 12, 0, -10),
      choice("solo", "Garder une publication simple", "Tu remercies la céramiste et publies un détail de ton atelier.", "Un petit rendez-vous facile à tenir.", "Tu laisses passer la rencontre des communautés.", "Ton image plaît à quelques habitués. La progression reste modeste et régulière.", 14, 0, 0, -5),
    ],
  },
  {
    id: "ig-moderation", platform: "instagram", title: "La limite du cadre", audience: "Une communauté qui veut garder le contact",
    body: "Une nouvelle publication sur le cannabis s’annonce délicate. Mila te rappelle qu’un beau visuel ne protège pas d’une restriction de diffusion dans cette aventure.",
    choices: [
      choice("editorial", "Recentrer sur le savoir-faire", "Tu prépares un récit d’atelier et retires les appels commerciaux sensibles.", "Un signal de modération peut être levé.", "La progression sera plus lente que celle d’une collaboration.", "Ton fil retrouve une ligne éditoriale claire. La pression de modération baisse et quelques curieux te rejoignent.", 18, -3, -1, -10),
      choice("repeat", "Republier le visuel signalé", "Tu remets exactement la même image en espérant passer cette fois.", "Tu défends ton choix visuel.", "La répétition aggrave la modération.", "La republication reçoit un nouvel avertissement. Plusieurs abonnés quittent ce fil devenu répétitif.", -12, 5, 2, -12),
      choice("archive", "Faire le ménage dans le fil", "Tu archives les contenus sensibles et annonces une prochaine série d’atelier.", "Deux signaux de modération peuvent être retirés.", "Aucune acquisition d’abonnés aujourd’hui.", "Le compte retrouve de la marge. Ton audience reste stable pendant que tu prépares la suite.", 0, -2, -2, -5),
    ],
  },
  {
    id: "ig-demand", platform: "instagram", title: "Tout le monde veut la suite", audience: "Des visiteurs curieux de ta boutique",
    body: "Tes publications commencent à être partagées. On te demande quand sortira la prochaine série. Tu peux raconter la suite ou promettre plus que ce que ton atelier sait tenir.",
    choices: [
      choice("honest", "Montrer les coulisses sans promesse", "Tu racontes le rythme de l’atelier et invites chacun à suivre l’aventure.", "Une audience qui comprend ton rythme.", "Pas d’annonce spectaculaire.", "La transparence plaît. De nouveaux abonnés découvrent ton univers sans attendre une livraison imaginaire.", 30, -4, 0, -12),
      choice("hype", "Promettre une sortie énorme", "Tu annonces que tout sera disponible, sans regarder ce que tu peux proposer.", "Le suspense apporte un pic d’attention.", "Les attentes et les haters montent ensemble.", "L’annonce attire des abonnés, mais les commentaires réclament déjà ce que tu as promis. La pression grimpe.", 38, 20, 0, -20),
      choice("silent", "Laisser les messages sans réponse", "Tu continues à publier sans répondre aux questions.", "Peu de préparation.", "Les curieux ont l’impression de parler dans le vide.", "L’élan retombe. Quelques personnes se désabonnent, faute de comprendre la suite.", -8, 6, 0, -4),
    ],
  },
  {
    id: "ig-identity", platform: "instagram", title: "Le visage de ta marque", audience: "Ceux qui te suivent pour ton univers",
    body: "Une tendance visuelle envahit le fil. Mila te demande : « Si tout le monde publie la même chose, comment reconnaîtra-t-on ton atelier ? »",
    choices: [
      choice("signature", "Créer ta propre série", "Tu déclines une idée qui raconte ton parcours en plusieurs images.", "Une identité que l’on retient.", "La création demande un vrai effort mental.", "La série est partagée pour ce qu’elle raconte de toi. Ton univers gagne une nouvelle vague d’abonnés.", 36, 2, 0, -16),
      choice("copy", "Copier la tendance mot pour mot", "Tu reprends une publication populaire jusque dans sa légende.", "C’est rapide à préparer.", "Les habitués reconnaissent la copie.", "La publication passe presque inaperçue. Quelques critiques soulignent le manque de personnalité.", 4, 8, 0, -6),
      choice("thanks", "Remercier la communauté", "Un message simple avec un détail de ton quotidien.", "Un rendez-vous chaleureux et peu fatigant.", "La croissance reste modeste.", "Les habitués apprécient l’attention. Quelques amis les rejoignent et l’ambiance s’apaise.", 16, -5, 0, -5),
    ],
  },
  {
    id: "x-first-thread", platform: "x", title: "Prendre la parole", audience: "Des connaisseurs qui demandent des arguments",
    body: "Noé t’invite dans une discussion sur le travail artisanal. Ici, une jolie image ne suffit pas : on attend ton point de vue, et parfois on le conteste sèchement.",
    choices: [
      choice("thread", "Écrire un fil concret", "Tu racontes un apprentissage, ses limites et ce que tu ferais autrement.", "Les passionnés apprécient la précision.", "Argumenter coûte plus d’énergie que publier une image.", "Le fil trouve un petit public attentif. Quelques contradicteurs arrivent aussi : sur X, la croissance se gagne.", 14, 4, 0, -18),
      choice("slogan", "Lancer une certitude provocante", "Tu simplifies tout en une phrase qui cherche la réaction.", "La formule attire immédiatement des réponses.", "Les haters pèsent vite sur ton moral.", "La phrase circule, mais la discussion tourne à l’affrontement. Peu d’abonnés restent face au bruit.", 5, 18, 0, -24),
      choice("listen", "Poser une vraie question", "Tu demandes comment les autres abordent le même problème.", "Un échange accessible et moins fatigant.", "L’audience se construit lentement.", "Quelques passionnés répondent. Une petite conversation commence sans te mettre au centre d’une polémique.", 7, 1, 0, -10),
    ],
  },
  {
    id: "x-pile-on", platform: "x", title: "Le fil s’échauffe", audience: "Des lecteurs partagés entre curiosité et conflit",
    body: "Un compte cite ton message hors contexte. Les notifications s’empilent. Noé te prévient : répondre à tout risque de dévorer l’énergie qu’il te reste.",
    choices: [
      choice("clarify", "Clarifier une fois, puis couper", "Tu redonnes le contexte et annonces que tu quittes la discussion.", "Tu défends ton propos sans entretenir le conflit.", "La clarification demande du recul.", "Des lecteurs retrouvent le sens de ton message. Quelques-uns s’abonnent et une partie des attaques s’éteint.", 10, -10, 0, -18),
      choice("fight", "Répondre à chaque attaque", "Tu t’installes pour gagner le dernier mot, réponse après réponse.", "Tu occupes toute la conversation.", "Très forte dépense mentale et nouveaux haters.", "Le fil ne s’arrête plus. L’épuisement se voit dans tes réponses ; des abonnés partent et les attaques se multiplient.", -10, 25, 0, -32),
      choice("mute", "Couper les notifications", "Tu poses une limite et laisses retomber le fil.", "Les haters perdent une occasion de relancer.", "Aucun nouvel abonné gagné.", "Le bruit décroît. Ton audience ne progresse pas, mais tu as évité une longue escalade.", 0, -15, 0, -4),
    ],
  },
  {
    id: "x-proof", platform: "x", title: "« Tu peux expliquer ? »", audience: "Des lecteurs qui vérifient les grandes affirmations",
    body: "Ton dernier message a suscité une question précise. Tu connais une partie de la réponse, mais pas tout. La manière de reconnaître cette limite peut changer la discussion.",
    choices: [
      choice("nuance", "Partager ce que tu sais, avec ses limites", "Tu distingues ton expérience des points qui restent incertains.", "Les lecteurs exigeants apprécient la nuance.", "Une réponse soignée prend de l’énergie.", "Ton honnêteté nourrit un échange utile. Une poignée de passionnés rejoint le compte et la tension baisse.", 16, -6, 0, -20),
      choice("bluff", "Faire comme si tu savais tout", "Tu ajoutes une explication péremptoire pour garder la face.", "Une réponse rapide et assurée.", "La contradiction peut coûter des abonnés.", "Une réponse démonte ton affirmation. Plusieurs abonnés partent, et le fil attire de nouveaux haters.", -14, 18, 0, -22),
      choice("admit", "Dire que tu dois vérifier", "Tu remercies la personne sans inventer de réponse.", "Tu désamorces la confrontation.", "Peu de visibilité supplémentaire.", "Les lecteurs apprécient la franchise. Tu gagnes une petite audience sans prolonger inutilement le débat.", 6, -5, 0, -8),
    ],
  },
  {
    id: "x-rival", platform: "x", title: "Le rival te mentionne", audience: "Deux communautés prêtes à se comparer",
    body: "Un autre artisan affirme que sa méthode vaut mieux que la tienne. Sa communauté est déjà dans les réponses. Tu peux nourrir la rivalité ou ouvrir une discussion.",
    choices: [
      choice("exchange", "Comparer vos expériences", "Tu proposes d’expliquer vos choix et leurs contraintes respectives.", "Des lecteurs découvrent ton point de vue.", "Même un échange courtois attire des contradicteurs.", "La comparaison devient intéressante. Quelques membres de l’autre communauté te suivent, avec leur lot de critiques.", 18, 5, 0, -22),
      choice("attack", "Attaquer sa compétence", "Tu transformes la différence de méthode en affaire personnelle.", "La rivalité fait parler.", "Le coût mental et les haters explosent.", "Le clash prend toute la place. Un peu d’audience arrive, surtout pour voir la dispute continuer.", 4, 24, 0, -30),
      choice("decline", "Refuser le concours d’ego", "Tu remercies pour l’échange et retournes à ton travail.", "La tension retombe.", "Tu laisses passer une occasion de visibilité.", "La discussion s’arrête sans duel public. Quelques lecteurs apprécient ta retenue.", 3, -8, 0, -6),
    ],
  },
  {
    id: "x-spotlight", platform: "x", title: "Sous les projecteurs", audience: "Des curieux arrivés par un compte influent",
    body: "Un compte suivi partage ton travail. Les questions arrivent plus vite que tes réponses. Cette visibilité peut devenir une communauté ou une course aux promesses.",
    choices: [
      choice("welcome", "Accueillir avec un fil de présentation", "Tu expliques ton projet, ton rythme et ce que les visiteurs peuvent découvrir.", "Les nouveaux venus savent pourquoi te suivre.", "Accueillir ce public demande de l’attention.", "Une partie des visiteurs reste pour ton projet. Tu gagnes des abonnés et quelques nouveaux contradicteurs.", 18, 6, 0, -24),
      choice("promise", "Promettre de répondre à tout le monde", "Tu annonces une disponibilité permanente pour entretenir l’élan.", "Un peu d’audience supplémentaire.", "La promesse entretient la pression mentale.", "Les sollicitations s’accumulent. Les attentes déçues prennent le dessus sur les nouvelles rencontres.", 8, 18, 0, -30),
      choice("boundaries", "Annoncer un rythme raisonnable", "Tu regroupes les questions et gardes du temps pour l’atelier.", "Un cadre qui apaise les échanges.", "Une croissance moins rapide.", "La communauté comprend ton rythme. Moins de monde s’abonne, mais la pression diminue.", 9, -8, 0, -12),
    ],
  },
  {
    id: "x-community", platform: "x", title: "Une communauté, pas une arène", audience: "Les habitués qui reviennent discuter",
    body: "Noé te propose un rendez-vous pour partager vos erreurs et vos découvertes. Tu peux en faire un échange utile, un nouveau classement ou simplement passer le micro.",
    choices: [
      choice("roundtable", "Organiser un échange d’expériences", "Chacun raconte une réussite, une erreur et une question encore ouverte.", "Les passionnés ont une raison de revenir.", "Animer l’échange demande de l’énergie.", "Les participants recommandent la discussion. Ton audience progresse et l’ambiance se détend.", 16, -10, 0, -20),
      choice("ranking", "Classer publiquement les autres", "Tu publies un podium des artisans et soulignes les derniers.", "Le classement déclenche des réactions.", "Les rivalités attirent surtout les haters.", "La discussion se réduit aux places du classement. Tu perds des abonnés et ravives les tensions.", -6, 20, 0, -24),
      choice("share", "Mettre en avant un autre artisan", "Tu partages un travail que tu apprécies en expliquant pourquoi.", "Un lien utile entre communautés.", "Tu n’es pas le centre de la publication.", "Le geste est apprécié. Quelques lecteurs curieux te rejoignent et les échanges gagnent en calme.", 8, -6, 0, -10),
    ],
  },
];

const bounded = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const integer = (value: unknown, max = Number.MAX_SAFE_INTEGER): value is number => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= max;
const timestamp = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const nullableTime = (value: unknown) => value === null || timestamp(value);
const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
export function isKqSocialUuid(value: unknown): value is string { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
export function parseKqSocialCommand(value: unknown): KqSocialCommand | null {
  if (!object(value) || !isKqSocialUuid(value.requestKey) || !integer(value.expectedRevision, 2147483646)) return null;
  const allowed = value.action === "recover" ? ["action", "requestKey", "expectedRevision"] : ["action", "requestKey", "expectedRevision", "platform", "scenarioId", "choiceId"];
  if (Object.keys(value).some(key => !allowed.includes(key))) return null;
  const base = { requestKey: value.requestKey, expectedRevision: value.expectedRevision };
  if (value.action === "recover") return { ...base, action: "recover" };
  if (value.action !== "choose" || (value.platform !== "instagram" && value.platform !== "x") || typeof value.scenarioId !== "string" || typeof value.choiceId !== "string") return null;
  const scenario = KQ_SOCIAL_SCENARIOS.find(item => item.platform === value.platform && item.id === value.scenarioId);
  if (!scenario?.choices.some(item => item.id === value.choiceId)) return null;
  return { ...base, action: "choose", platform: value.platform, scenarioId: value.scenarioId, choiceId: value.choiceId };
}
export function isKqSocialSnapshot(value: unknown): value is KqSocialSnapshot {
  if (!object(value) || value.version !== 1 || !timestamp(value.serverNow) || !integer(value.revision) || !integer(value.energy, 100) || !timestamp(value.energyUpdatedAt) || !nullableTime(value.recoverReadyAt)
    || !integer(value.audienceFollowers, 100000) || !integer(value.socialFollowers, 100000) || typeof value.additionalVisitsPerDay !== "number" || !Number.isFinite(value.additionalVisitsPerDay) || value.additionalVisitsPerDay < 0 || typeof value.siteActive !== "boolean" || !object(value.platforms) || !Array.isArray(value.history) || value.history.length > 20) return false;
  for (const platform of ["instagram", "x"]) {
    const account = value.platforms[platform];
    if (!object(account) || !integer(account.followers, 50000) || !integer(account.haters, 100) || !integer(account.moderation, 5) || !integer(account.chapter) || !nullableTime(account.nextPostAt)) return false;
  }
  const platforms = value.platforms as Record<KqSocialPlatform, KqSocialAccount>;
  if (value.socialFollowers !== platforms.instagram.followers + platforms.x.followers) return false;
  return value.history.every(entry => object(entry) && typeof entry.id === "string" && (entry.platform === null || entry.platform === "instagram" || entry.platform === "x")
    && typeof entry.scenarioId === "string" && typeof entry.choiceId === "string" && timestamp(entry.createdAt) && typeof entry.outcome === "string"
    && [entry.followersDelta, entry.hatersDelta, entry.moderationDelta, entry.energyDelta].every(Number.isSafeInteger));
}
export function getKqSocialScenario(platform: KqSocialPlatform, chapter: number): KqSocialScenario {
  const stories = KQ_SOCIAL_SCENARIOS.filter(item => item.platform === platform);
  return stories[(Number.isSafeInteger(chapter) && chapter >= 0 ? chapter : 0) % stories.length];
}
export function getKqSocialFame(total: number): { label: string; nextGoal: number | null } {
  const tiers = [{ at: 0, label: "Premier cercle" }, { at: 100, label: "Connu du quartier" }, { at: 500, label: "La communauté grandit" }, { at: 1500, label: "Nom qui circule" }, { at: 5000, label: "Sous les projecteurs" }];
  const index = Math.max(0, tiers.findLastIndex(tier => total >= tier.at));
  return { label: tiers[index].label, nextGoal: tiers[index + 1]?.at ?? null };
}
/** Incremental audience contribution to existing shop traffic, before campaigns. */
export function getKqSocialVisits(audience: number, social: number, reputation = 0) {
  return Math.round((Math.min(audience, 5000) - Math.min(Math.max(0, audience - social), 5000)) * .12 * (1 + Math.min(.25, Math.max(0, reputation) / 6000)) * 1_000_000) / 1_000_000;
}
export function getKqSocialChoicePreview(snapshot: KqSocialSnapshot, platform: KqSocialPlatform, selected: KqSocialChoice): KqSocialEffects {
  const account = snapshot.platforms[platform];
  let followers = selected.effects.followers;
  if (followers > 0) {
    followers *= Math.min(3, 1 + Math.floor(account.followers / 250));
    if (platform === "instagram" && account.moderation >= 3) followers = Math.floor(followers / 2);
  }
  followers = bounded(account.followers + followers, 0, 50000) - account.followers;
  followers = bounded(snapshot.audienceFollowers + followers, 0, 100000) - snapshot.audienceFollowers;
  return { followers, haters: bounded(account.haters + selected.effects.haters, 0, 100) - account.haters,
    moderation: bounded(account.moderation + selected.effects.moderation, 0, 5) - account.moderation,
    energy: selected.effects.energy - (platform === "x" && account.haters >= 40 ? 5 : 0) };
}
export function createKqSocialSnapshot(now: number, audienceFollowers = 0, siteActive = true): KqSocialSnapshot {
  const account = (): KqSocialAccount => ({ followers: 0, haters: 0, moderation: 0, chapter: 0, nextPostAt: null });
  return { version: 1, serverNow: new Date(now).toISOString(), revision: 0, energy: 100, energyUpdatedAt: new Date(now).toISOString(), recoverReadyAt: null,
    audienceFollowers, socialFollowers: 0, additionalVisitsPerDay: 0, siteActive, platforms: { instagram: account(), x: account() }, history: [] };
}
/** Used by the isolated tutorial; the real game always receives a server snapshot. */
export function refreshKqSocialSnapshot(snapshot: KqSocialSnapshot, now: number, reputation = 0): KqSocialSnapshot {
  const next = structuredClone(snapshot);
  const elapsedTicks = Math.max(0, Math.floor((now - Date.parse(next.energyUpdatedAt)) / KQ_SOCIAL_ENERGY_TICK_MS));
  next.energy = Math.min(100, next.energy + elapsedTicks);
  next.energyUpdatedAt = new Date(next.energy === 100 ? now : Date.parse(next.energyUpdatedAt) + elapsedTicks * KQ_SOCIAL_ENERGY_TICK_MS).toISOString();
  next.serverNow = new Date(now).toISOString();
  next.socialFollowers = next.platforms.instagram.followers + next.platforms.x.followers;
  next.additionalVisitsPerDay = getKqSocialVisits(next.audienceFollowers, next.socialFollowers, reputation);
  delete next.replayed;
  return next;
}
/** Local-only resolver. RPC validates the same catalog and choices under a lock. */
export function applyKqSocialCommand(snapshot: KqSocialSnapshot, command: KqSocialCommand, now: number, reputation = 0): KqSocialSnapshot {
  if (!parseKqSocialCommand(command)) throw new Error("Choix de réseau social invalide.");
  const next = refreshKqSocialSnapshot(snapshot, now, reputation);
  if (command.expectedRevision !== next.revision) throw new Error("La situation a changé. Actualise les réseaux avant de choisir.");
  const entry: KqSocialHistoryEntry = { id: command.requestKey, platform: null, scenarioId: "recover", choiceId: "recover", createdAt: next.serverNow,
    outcome: "Tu coupes les notifications et prends du recul. Ton énergie mentale remonte.", followersDelta: 0, hatersDelta: 0, moderationDelta: 0, energyDelta: 0 };
  if (command.action === "recover") {
    if (next.recoverReadyAt && Date.parse(next.recoverReadyAt) > now) throw new Error("Ta prochaine pause sera disponible après le délai indiqué.");
    if (next.energy >= 100) throw new Error("Ton énergie mentale est déjà au maximum.");
    entry.energyDelta = Math.min(30, 100 - next.energy);
    next.energy += entry.energyDelta;
    next.recoverReadyAt = new Date(now + KQ_SOCIAL_RECOVER_MS).toISOString();
  } else {
    const account = next.platforms[command.platform];
    const scenario = getKqSocialScenario(command.platform, account.chapter);
    const selected = scenario.choices.find(item => item.id === command.choiceId);
    if (scenario.id !== command.scenarioId || !selected) throw new Error("Cette histoire a déjà changé. Actualise avant de choisir.");
    if (account.nextPostAt && Date.parse(account.nextPostAt) > now) throw new Error("Laisse respirer ton audience avant de publier à nouveau.");
    const effects = getKqSocialChoicePreview(next, command.platform, selected);
    if (next.energy + effects.energy < 0) throw new Error("Ton énergie mentale ne suffit pas. Fais une pause ou reviens plus tard.");
    Object.assign(entry, { platform: command.platform, scenarioId: scenario.id, choiceId: selected.id, outcome: selected.outcome,
      followersDelta: effects.followers, hatersDelta: effects.haters, moderationDelta: effects.moderation, energyDelta: effects.energy });
    account.followers += effects.followers;
    account.haters += effects.haters;
    account.moderation += effects.moderation;
    account.chapter += 1;
    account.nextPostAt = new Date(now + KQ_SOCIAL_POST_MS).toISOString();
    next.audienceFollowers += effects.followers;
    next.energy += effects.energy;
  }
  next.revision += 1;
  next.history = [entry, ...next.history].slice(0, 20);
  return refreshKqSocialSnapshot(next, now, reputation);
}
