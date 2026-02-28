import { products } from "@/data/products";
import { createDefaultPageSections } from "@/data/sections";
import type { CmsStore } from "@/types/store";

export const defaultStore: CmsStore = {
  content: {
    home: {
      heroEyebrow: "",
      heroLine1: "BIENVENUE",
      heroLine2: "",
      heroLine3: "",
      heroDescription:
        "Cultive localement, controle en laboratoire, vendu en toute transparence.",
      heroPrimaryCtaLabel: "Voir la boutique",
      heroSecondaryCtaLabel: "Lire notre histoire",
      seasonGalleryTitle: "CULTURES DE LA SAISON",
      seasonGalleryDescription:
        "Découvre les photos des cultures en cours, directement depuis nos champs.",
      seasonGalleryImages: [],
      legalLine1: "100%",
      legalLine2: "LEGAL",
      legalDescription:
        "Nos fleurs et resines proviennent de varietes autorisees, cultivees en France et analysees par un laboratoire independant.",
      legalPillThc: "THC moins de 0.3%",
      legalPillLab: "Analyses labo",
      legalPillDelivery: "Livraison suivie",
      productsTitleLine1: "NOS",
      productsTitleLine2: "PRODUITS",
      productsPricePrefix: "À partir de",
      productsAddButtonLabel: "Ajouter",
      productsCtaLabel: "Voir toute la boutique",
      appTitleLine1: "LES",
      appTitleLine2: "CHANVRIERS",
      appTitleLine3: "UNIS",
      appDescription:
        "L app pour suivre les cultures, retrouver les producteurs et rester informé.",
      appStoreLabel: "App Store",
      playStoreLabel: "Google Play",
      appProducerTitle: "Pour les producteurs",
      appProducerDescription: "Rejoignez le réseau des chanvriers bretons",
      storyTitle: "NOTRE HISTOIRE",
      storyDescription:
        "Nous voulons un CBD plus lisible, plus pop, plus local. Cette refonte garde l'identité bretonne et ajoute une expérience immersive par section.",
      contactTitle: "CONTACT",
      contactDescription: "Une question sur un produit ou une commande ? Écris-nous.",
      contactNamePlaceholder: "Nom",
      contactEmailPlaceholder: "Email",
      contactSubmitLabel: "Envoyer",
    },
    boutique: {
      eyebrow: "Boutique CBD",
      title: "MES PRODUITS",
      description:
        "Filtre par catégorie, ajoute au panier, puis lance ton paiement via Viva Smart Checkout.",
      emptyMessage: "Aucun produit dans cette catégorie pour l'instant.",
      addButtonLabel: "Ajouter",
      copainsSectionTitle: "Le Coin des Copains",
      copainsSectionDescription:
        "Découvre les produits de nos producteurs partenaires partout en France.",
      producerPartnerLabel: "Producteur Partenaire",
      producerWebsiteLabel: "Voir le site",
    },
    application: {
      eyebrow: "Les Chanvriers Unis",
      title: "L'APP COMMUNAUTÉ",
      description:
        "Une expérience mobile pour la fidélité, la commande rapide et les actus locales.",
      heroPrimaryButtonLabel: "App Store - Bientôt",
      heroSecondaryButtonLabel: "Google Play - Bientôt",
      feature1Title: "Fidélité",
      feature1Description: "Cumule des points et débloque des récompenses exclusives.",
      feature2Title: "Commande rapide",
      feature2Description: "Retrouve tes favoris et repasse commande en quelques taps.",
      feature3Title: "Communauté",
      feature3Description: "Partage tes avis, découvre des routines et échange avec la team.",
      feature4Title: "Actus locales",
      feature4Description: "Suis les nouveautés et événements bretons autour de la marque.",
      newsletterTitle: "REJOINS LES CHANVRIERS UNIS",
      newsletterDescription:
        "Inscris-toi pour être alerté du lancement et recevoir les accès en avant-première.",
      newsletterEmailPlaceholder: "Ton e-mail",
      newsletterSubmitLabel: "Me prévenir",
    },
    blog: {
      eyebrow: "Blog",
      title: "Le Blog CBD",
      description: "Guides, actualites et conseils autour du CBD bio.",
      postsEmptyMessage: "Aucun article publié pour le moment.",
      postsReadMoreLabel: "Lire l'article",
      breadcrumbHomeLabel: "Accueil",
      breadcrumbBlogLabel: "Blog",
      postPublishedPrefix: "Publié le",
      postBackLabel: "Retour au blog",
    },
    logistics: {
      mondialRelay: {
        collectionType: "R",
        collectionRelayId: "",
        collectionCountry: "FR",
      },
    },
    profile: {
      badgeBenefitsModalTitle: "Avantages du palier",
      badgeBenefitsModalHint: "Chaque ligne correspond à un avantage.",
      badgeBenefitsCloseLabel: "Fermer",
      decouverteDiscountPercent: 2,
      explorateurDiscountPercent: 4,
      connaisseurDiscountPercent: 6,
      ambassadeurDiscountPercent: 8,
      legendeDiscountPercent: 10,
      decouverteBenefits:
        "Accès au programme fidélité\nCumule des points sur chaque commande\nBadge bronze sur ton profil",
      explorateurBenefits:
        "Code promo ponctuel réservé au palier argent\nPriorité sur certaines nouveautés\nAccès à des offres flash",
      connaisseurBenefits:
        "Récompenses premium en avant-première\nOffres dédiées au palier or\nSupport prioritaire",
      ambassadeurBenefits:
        "Invitations privilégiées à nos lancements\nAvantages exclusifs palier platine\nSélection spéciale de produits\nCadeau anniversaire en passant une commande le mois de ton anniversaire",
      legendeBenefits:
        "Meilleurs avantages fidélité disponibles\nAccès VIP sur opérations spéciales\nPalier diamant affiché sur ton profil\nCadeau anniversaire en passant une commande le mois de ton anniversaire\nCadeau de Noël en passant une commande en décembre",
    },
    footer: {
      copyright: "Copyright Les Chanvriers Bretons - Tous droits réservés.",
      legalLabel: "Mentions légales",
      privacyLabel: "Politique de confidentialité",
    },
  },
  sections: createDefaultPageSections(),
  products,
  blog: [],
  producers: [],
  orders: [],
  updatedAt: new Date().toISOString(),
};
