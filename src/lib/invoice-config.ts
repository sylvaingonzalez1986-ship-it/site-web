export const INVOICE_COMPANY = {
  legalName: "LES CHAMPS BRETONS",
  legalForm: "SASU",
  siren: "942 368 994",
  siret: "942 368 994 00011",
  vatNumber: "FR90942368994",
  rcs: "942 368 994 R.C.S. Paris",
  shareCapital: "20,00 EUR",
  addressLine: "60 rue Francois Ier, 75008 Paris",
  president: "Sylvain Gonzalez",
  nafCode: "47.91A",
} as const;

export type InvoiceVatMode = "exempt" | "taxable";

export const INVOICE_SETTINGS = {
  vatMode: (process.env.INVOICE_VAT_MODE === "taxable" ? "taxable" : "exempt") as InvoiceVatMode,
  defaultCurrency: "EUR",
} as const;

export const INVOICE_CUSTOMER_THANK_YOU = {
  title: "MERCI DE SOUTENIR NOS PRODUCTEURS",
  body: "En commandant chez Les Chanvriers Bretons, vous faites vivre de petits producteurs passionnés qui cultivent cette magnifique plante avec patience, savoir-faire et beaucoup d'amour. Merci de faire partie de cette belle aventure humaine et locale.",
} as const;

export const INVOICE_CBD_DRIVING_NOTICE = {
  title: "CBD, THC ET CONDUITE - INFORMATION IMPORTANTE",
  paragraphs: [
    "Les tests routiers recherchent le THC, pas le CBD. Même de faibles traces de THC dans un produit au CBD peuvent rendre le test positif. Conduire après usage de THC est interdit, quelle que soit la quantité détectée.",
    "Aucun délai ne garantit un test négatif, y compris après une consommation la veille. En cas de doute, ne conduisez pas. Un autotest informe sans garantir le résultat d'un contrôle officiel.",
    "Après le prélèvement salivaire, indiquez immédiatement à l'agent que vous souhaitez vous réserver la possibilité d'une expertise : un prélèvement sanguin doit alors être réalisé. La demande peut être faite dans les cinq jours suivant la notification du résultat. Lisez avant de signer et faites consigner vos observations.",
  ],
  source:
    "Sources : Code de la route, art. R. 235-6 et R. 235-11 ; Cour de cassation, 21 juin 2023, n° 22-85.530.",
} as const;

export function getInvoiceLegalFooter(): string {
  if (INVOICE_SETTINGS.vatMode === "exempt") {
    return "TVA non applicable, art. 293 B du CGI";
  }

  return "TVA applicable.";
}
