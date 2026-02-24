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
        "Decouvre les photos des cultures en cours, directement depuis nos champs.",
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
      productsPricePrefix: "A partir de",
      productsAddButtonLabel: "Ajouter",
      productsCtaLabel: "Voir toute la boutique",
      appTitleLine1: "LES",
      appTitleLine2: "CHANVRIERS",
      appTitleLine3: "UNIS",
      appDescription:
        "L app pour suivre les cultures, retrouver les producteurs et rester informe.",
      appStoreLabel: "App Store",
      playStoreLabel: "Google Play",
      appProducerTitle: "Pour les producteurs",
      appProducerDescription: "Rejoignez le reseau des chanvriers bretons",
      storyTitle: "NOTRE HISTOIRE",
      storyDescription:
        "Nous voulons un CBD plus lisible, plus pop, plus local. Cette refonte garde l identite bretonne et ajoute une experience immersive par section.",
      contactTitle: "CONTACT",
      contactDescription: "Une question sur un produit ou une commande ? Ecris-nous.",
      contactNamePlaceholder: "Nom",
      contactEmailPlaceholder: "Email",
      contactSubmitLabel: "Envoyer",
    },
    boutique: {
      eyebrow: "Boutique CBD",
      title: "MES PRODUITS",
      description:
        "Filtre par categorie, ajoute au panier, puis lance ton paiement via Viva Smart Checkout.",
      emptyMessage: "Aucun produit dans cette categorie pour l instant.",
      addButtonLabel: "Ajouter",
      copainsSectionTitle: "Le Coin des Copains",
      copainsSectionDescription:
        "Decouvre les produits de nos producteurs partenaires partout en France.",
      producerPartnerLabel: "Producteur Partenaire",
      producerWebsiteLabel: "Voir le site",
    },
    application: {
      eyebrow: "Les Chanvriers Unis",
      title: "L APP COMMUNAUTE",
      description:
        "Une experience mobile pour la fidelite, la commande rapide et les actus locales.",
      heroPrimaryButtonLabel: "App Store - Bientot",
      heroSecondaryButtonLabel: "Google Play - Bientot",
      feature1Title: "Fidelite",
      feature1Description: "Cumule des points et debloque des recompenses exclusives.",
      feature2Title: "Commande rapide",
      feature2Description: "Retrouve tes favoris et repasse commande en quelques taps.",
      feature3Title: "Communaute",
      feature3Description: "Partage tes avis, decouvre des routines et echange avec la team.",
      feature4Title: "Actus locales",
      feature4Description: "Suis les nouveautes et evenements bretons autour de la marque.",
      newsletterTitle: "REJOINS LES CHANVRIERS UNIS",
      newsletterDescription:
        "Inscris-toi pour etre alerte du lancement et recevoir les acces en avant-premiere.",
      newsletterEmailPlaceholder: "Ton e-mail",
      newsletterSubmitLabel: "Me prevenir",
    },
    blog: {
      eyebrow: "Blog",
      title: "Le Blog CBD",
      description: "Guides, actualites et conseils autour du CBD bio.",
      postsEmptyMessage: "Aucun article publie pour le moment.",
      postsReadMoreLabel: "Lire l'article",
      breadcrumbHomeLabel: "Accueil",
      breadcrumbBlogLabel: "Blog",
      postPublishedPrefix: "Publie le",
      postBackLabel: "Retour au blog",
    },
    profile: {
      badgeBenefitsModalTitle: "Avantages du palier",
      badgeBenefitsModalHint: "Chaque ligne correspond a un avantage.",
      badgeBenefitsCloseLabel: "Fermer",
      decouverteDiscountPercent: 2,
      explorateurDiscountPercent: 4,
      connaisseurDiscountPercent: 6,
      ambassadeurDiscountPercent: 8,
      legendeDiscountPercent: 10,
      decouverteBenefits:
        "Acces au programme fidelite\nCumule des points sur chaque commande\nBadge bronze sur ton profil",
      explorateurBenefits:
        "Code promo ponctuel reserve au palier argent\nPriorite sur certaines nouveautes\nAcces a des offres flash",
      connaisseurBenefits:
        "Recompenses premium en avant-premiere\nOffres dediees au palier or\nSupport prioritaire",
      ambassadeurBenefits:
        "Invitations privilegiees a nos lancements\nAvantages exclusifs palier platine\nSelection speciale de produits",
      legendeBenefits:
        "Meilleurs avantages fidelite disponibles\nAcces VIP sur operations speciales\nPalier diamant affiche sur ton profil",
    },
    footer: {
      copyright: "Copyright Les Chanvriers Bretons - Tous droits reserves.",
      legalLabel: "Mentions legales",
      privacyLabel: "Politique de confidentialite",
    },
  },
  sections: createDefaultPageSections(),
  products,
  blog: [],
  producers: [],
  orders: [],
  updatedAt: new Date().toISOString(),
};
