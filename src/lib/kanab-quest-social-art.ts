import type { KqSocialSubject } from "./kanab-quest-social-producer-types";
/** Scene-specific decor. The app adds the player avatar only in the reserved area. */
export type KqSocialArtwork = {
  src: string;
  alt: string;
  playerPlacement: "left" | "center" | "none";
};

export const KQ_SOCIAL_ARTWORK: Record<string, KqSocialArtwork> = {
  "ig-first-frame": { src: "/app/kanab-quest/social/scenes/ig-first-frame-cbd-v2.webp", alt: "Un placard de culture indoor ouvert, avec des plantes sous une lampe LED, un ventilateur et un carnet de suivi.", playerPlacement: "left" },
  "ig-comment": { src: "/app/kanab-quest/social/scenes/ig-comment-cbd-v2.webp", alt: "Un carnet de feuilles dessinées, une feuille au bord jaune, un chiffon et une loupe près du placard de culture.", playerPlacement: "none" },
  "ig-collab": { src: "/app/kanab-quest/social/scenes/ig-collab-cbd-v2.webp", alt: "Deux carnets de culture et deux tasses sont ouverts sur une table près d’une tente de culture indoor.", playerPlacement: "left" },
  "ig-sensitive-frame": { src: "/app/kanab-quest/social/scenes/ig-sensitive-frame.webp", alt: "Un bocal de fleurs, des outils et un carnet entourés de cadres en carton sur une table de prise de vue.", playerPlacement: "none" },
  "ig-moderation": { src: "/app/kanab-quest/social/scenes/ig-moderation.webp", alt: "Des cadres de prise de vue et un fond mobile entourent un bocal, un appareil photo et un carnet.", playerPlacement: "left" },
  "ig-return": { src: "/app/kanab-quest/social/scenes/ig-return-cbd-v2.webp", alt: "Un placard de culture éclairé présente les plantes, le matériel de suivi et un espace libre devant les pots.", playerPlacement: "left" },
  "ig-demand": { src: "/app/kanab-quest/social/scenes/ig-demand-cbd-v2.webp", alt: "Des claies de séchage et des notes de préparation accompagnent une grille de planning sans date.", playerPlacement: "none" },
  "ig-identity": { src: "/app/kanab-quest/social/scenes/ig-identity-cbd-v2.webp", alt: "Une table de préparation des fleurs, avec des ciseaux, des gants et un plateau de manucure.", playerPlacement: "left" },
  "ig-open-house": { src: "/app/kanab-quest/social/scenes/ig-open-house-cbd-v2.webp", alt: "Un placard de culture indoor ouvert, avec des plantes sous un éclairage LED et un passage libre au centre.", playerPlacement: "center" },
  "x-first-thread": { src: "/app/kanab-quest/social/scenes/x-first-thread.webp", alt: "Un téléphone, un carnet d’essais et une tasse sur un bureau au milieu des outils de l’atelier.", playerPlacement: "left" },
  "x-proof": { src: "/app/kanab-quest/social/scenes/x-proof.webp", alt: "Des échantillons, une loupe et des croquis de travail réunis pour examiner un raisonnement.", playerPlacement: "none" },
  "x-rival": { src: "/app/kanab-quest/social/scenes/x-rival.webp", alt: "Deux petits établis présentent des outils disposés différemment autour d’une allée centrale libre.", playerPlacement: "center" },
  "x-pile-on": { src: "/app/kanab-quest/social/scenes/x-pile-on.webp", alt: "Un téléphone près du bord d’une table, à côté d’un carnet et d’une bande de papier détachée.", playerPlacement: "none" },
  "x-spotlight": { src: "/app/kanab-quest/social/scenes/x-spotlight.webp", alt: "Des questions sur des papiers sans texte sont regroupées dans des plateaux près d’un carnet et d’un téléphone.", playerPlacement: "left" },
  "x-community": { src: "/app/kanab-quest/social/scenes/x-community.webp", alt: "Des tabourets et des tables de côté entourent un espace d’échange, avec un objet réparé et un bol irrégulier.", playerPlacement: "center" },
  "x-invitation": { src: "/app/kanab-quest/social/scenes/x-invitation.webp", alt: "Un microphone, un casque et une carte d’invitation sans texte dans le coin d’un petit studio local.", playerPlacement: "left" },
  "x-brief": { src: "/app/kanab-quest/social/scenes/x-brief.webp", alt: "Un extrait de papier posé près d’une page complète, avec un crayon et le câble d’un microphone.", playerPlacement: "none" },
  "x-line": { src: "/app/kanab-quest/social/scenes/x-line.webp", alt: "Un carnet ouvert sur trois idées illustrées, accompagné d’un crayon et d’un téléphone éteint.", playerPlacement: "none" },
  "ig-credit-source": { src: "/app/kanab-quest/social/scenes/ig-credit-source.webp", alt: "Une photographie d’atelier et sa copie recadrée, près d’un appareil et d’une étiquette encore vierge.", playerPlacement: "none" },
  "ig-credit-repair": { src: "/app/kanab-quest/social/scenes/ig-credit-repair.webp", alt: "La marge repliée d’une photographie masque une petite étiquette, à côté d’un crayon et d’une étiquette plus grande.", playerPlacement: "none" },
  "ig-credit-license": { src: "/app/kanab-quest/social/scenes/ig-credit-license.webp", alt: "Des photographies, des fiches vierges et une enveloppe sont préparées sur un établi pour organiser leur reprise.", playerPlacement: "left" },
  "ig-live-glitch": { src: "/app/kanab-quest/social/scenes/ig-live-glitch-cbd-v2.webp", alt: "Un ventilateur à l’arrêt, une gaine d’extraction et un carnet près des claies de séchage en intérieur.", playerPlacement: "left" },
  "ig-live-queue": { src: "/app/kanab-quest/social/scenes/ig-live-queue.webp", alt: "Des fiches illustrées d’un outil, d’un appareil photo et d’un tabouret attendent d’être regroupées.", playerPlacement: "none" },
  "ig-live-edit": { src: "/app/kanab-quest/social/scenes/ig-live-edit.webp", alt: "Des petites photographies de visite sont étalées près d’un carnet, d’une caméra et d’un câble audio.", playerPlacement: "none" },
  "ig-filter-doubt": { src: "/app/kanab-quest/social/scenes/ig-filter-doubt.webp", alt: "Deux versions colorées d’une même nature morte sont comparées devant le bocal qui leur sert de sujet.", playerPlacement: "none" },
  "ig-filter-proof": { src: "/app/kanab-quest/social/scenes/ig-filter-proof.webp", alt: "Un même bocal placé entre deux fonds de couleur reçoit la lumière d’une fenêtre et d’une lampe.", playerPlacement: "none" },
  "ig-filter-style": { src: "/app/kanab-quest/social/scenes/ig-filter-style.webp", alt: "Un appareil, des tissus et des croquis de cadrage préparent un coin photo cohérent dans l’atelier.", playerPlacement: "left" },
  "ig-brand-brief": { src: "/app/kanab-quest/social/scenes/ig-brand-brief.webp", alt: "Un dossier de proposition déborde de feuilles décoratives près d’un carnet de notes et d’un appareil photo.", playerPlacement: "none" },
  "ig-brand-claim": { src: "/app/kanab-quest/social/scenes/ig-brand-claim.webp", alt: "Un fond photo légèrement recourbé et une lampe projettent une ombre sur un objet posé devant l’appareil.", playerPlacement: "none" },
  "ig-brand-editorial": { src: "/app/kanab-quest/social/scenes/ig-brand-editorial.webp", alt: "Une petite carte amovible prend place parmi les croquis d’un carnet éditorial, sans couvrir les autres pages.", playerPlacement: "none" },
  "ig-creative-call": { src: "/app/kanab-quest/social/scenes/ig-creative-call-cbd-v2.webp", alt: "Une feuille abîmée, un carnet d’observations et du matériel rangé racontent les petits ratés de la culture indoor.", playerPlacement: "center" },
  "ig-creative-rules": { src: "/app/kanab-quest/social/scenes/ig-creative-rules.webp", alt: "Des créations photographiées et leurs objets d’origine sont accompagnés de petites fiches vierges.", playerPlacement: "none" },
  "ig-creative-spotlight": { src: "/app/kanab-quest/social/scenes/ig-creative-spotlight.webp", alt: "Des photographies de créations du quotidien sont exposées avec chacune une petite étiquette, sans classement.", playerPlacement: "none" },
  "ig-feed-overload": { src: "/app/kanab-quest/social/scenes/ig-feed-overload.webp", alt: "Trois brouillons photographiques montrent presque le même coin de table, avec le carnet légèrement déplacé.", playerPlacement: "none" },
  "ig-feed-calendar": { src: "/app/kanab-quest/social/scenes/ig-feed-calendar.webp", alt: "Un carnet plein d’idées repose près d’une grille de préparation vierge et d’un sac d’appareil photo.", playerPlacement: "left" },
  "ig-feed-offline": { src: "/app/kanab-quest/social/scenes/ig-feed-offline.webp", alt: "Un appareil suspendu près des manteaux et un téléphone rangé dans un plateau laissent place à un coin de discussion.", playerPlacement: "center" },
  "x-archive-resurfaces": { src: "/app/kanab-quest/social/scenes/x-archive-resurfaces.webp", alt: "Une ancienne image d’atelier ressort d’une boîte d’archives, près d’une copie recadrée et d’un téléphone.", playerPlacement: "none" },
  "x-archive-context": { src: "/app/kanab-quest/social/scenes/x-archive-context.webp", alt: "Deux outils de générations différentes sont comparés près d’une ancienne photographie et d’un carnet.", playerPlacement: "left" },
  "x-archive-correction": { src: "/app/kanab-quest/social/scenes/x-archive-correction.webp", alt: "Une ancienne photographie, un croquis récent et une note vierge sont réunis devant des dossiers d’archives.", playerPlacement: "none" },
  "x-number-viral": { src: "/app/kanab-quest/social/scenes/x-number-viral.webp", alt: "Une feuille de présentation recadrée est examinée près d’une loupe et d’un dossier encore fermé.", playerPlacement: "none" },
  "x-number-source": { src: "/app/kanab-quest/social/scenes/x-number-source.webp", alt: "Un dossier de réponses ouvert est placé à côté d’un échantillon de travail et d’un outil.", playerPlacement: "none" },
  "x-number-nuance": { src: "/app/kanab-quest/social/scenes/x-number-nuance.webp", alt: "Un carnet de vérification reste ouvert entre une loupe, un objet d’atelier et deux grandes cartes mises de côté.", playerPlacement: "none" },
  "x-double-account": { src: "/app/kanab-quest/social/scenes/x-double-account.webp", alt: "Deux images presque semblables d’une porte d’atelier présentent quelques détails différents près d’un téléphone.", playerPlacement: "none" },
  "x-double-channel": { src: "/app/kanab-quest/social/scenes/x-double-channel.webp", alt: "Une photographie complète reste accrochée à un panneau, au-dessus de plusieurs copies recadrées et d’un dossier.", playerPlacement: "none" },
  "x-double-clarification": { src: "/app/kanab-quest/social/scenes/x-double-clarification.webp", alt: "Un nouvel essai reprend place sur l’établi tandis qu’un petit panneau de référence reste au fond de l’atelier.", playerPlacement: "left" },
  "x-live-invitation": { src: "/app/kanab-quest/social/scenes/x-live-invitation.webp", alt: "Deux microphones et des carnets attendent sur des tables de côté autour d’un espace de discussion.", playerPlacement: "center" },
  "x-live-turns": { src: "/app/kanab-quest/social/scenes/x-live-turns.webp", alt: "Deux microphones et leurs câbles se croisent au-dessus de fiches, près d’un petit sablier.", playerPlacement: "none" },
  "x-live-summary": { src: "/app/kanab-quest/social/scenes/x-live-summary.webp", alt: "Des microphones au repos accompagnent un carnet où deux approches de travail restent présentées côte à côte.", playerPlacement: "none" },
  "x-growth-shortcut": { src: "/app/kanab-quest/social/scenes/x-growth-shortcut.webp", alt: "Une proposition dans une enveloppe brillante côtoie un carnet de travail et un outil ordinaire.", playerPlacement: "none" },
  "x-growth-proof": { src: "/app/kanab-quest/social/scenes/x-growth-proof.webp", alt: "Une image promotionnelle recadrée est examinée à côté d’un carnet, d’une fiche et de deux tasses.", playerPlacement: "none" },
  "x-growth-peers": { src: "/app/kanab-quest/social/scenes/x-growth-peers.webp", alt: "Des objets de travail inachevés et des carnets attendent sur des tables de côté dans une cour d’ateliers.", playerPlacement: "center" },
  "x-help-boundaries": { src: "/app/kanab-quest/social/scenes/x-help-boundaries.webp", alt: "Des dossiers et des demandes sur papier entourent un carnet personnel et les outils d’un établi.", playerPlacement: "left" },
  "x-help-requests": { src: "/app/kanab-quest/social/scenes/x-help-requests.webp", alt: "Un exemple d’assemblage et son croquis sont ouverts sur une table, tandis que les autres dossiers restent fermés.", playerPlacement: "none" },
  "x-help-relay": { src: "/app/kanab-quest/social/scenes/x-help-relay.webp", alt: "Des outils de céramique et de travail du bois encadrent l’entrée commune de plusieurs ateliers.", playerPlacement: "center" },
};

export function getKqSocialArtwork(scenarioId: string): KqSocialArtwork | undefined {
  return Object.prototype.hasOwnProperty.call(KQ_SOCIAL_ARTWORK, scenarioId)
    ? KQ_SOCIAL_ARTWORK[scenarioId]
    : undefined;
};

/** Reuse decor only when the pictured crop or lot actually exists in this game. */
export function getKqSocialProducerArtwork(subject?: KqSocialSubject): KqSocialArtwork {
  if (subject?.requirement === "flowering") return KQ_SOCIAL_ARTWORK["ig-open-house"];
  if (subject?.requirement === "harvest") return KQ_SOCIAL_ARTWORK["ig-identity"];
  if (subject?.requirement === "curing") return KQ_SOCIAL_ARTWORK["ig-filter-proof"];
  if (subject?.requirement === "ready") return KQ_SOCIAL_ARTWORK["ig-filter-doubt"];
  return { src: "/app/kanab-quest/social/scenes/producer-journal-v3.webp",
    alt: "Un téléphone et un carnet d’observation sur le bureau du producteur, sous une affiche botanique. Aucune plante ni récolte n’est représentée.", playerPlacement: "none" };
}
