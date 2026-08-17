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
  body: "En commandant chez Les Chanvriers Bretons, vous participez à faire vivre de petits producteurs passionnés, engagés et fiers de leur savoir-faire. Chacun cultive cette magnifique plante avec patience, exigence et beaucoup d'amour. Merci de faire partie de cette belle aventure humaine et locale.",
} as const;

export const INVOICE_CBD_DRIVING_NOTICE = {
  title: "CBD, THC ET CONDUITE - INFORMATION IMPORTANTE",
  paragraphs: [
    "Les tests salivaires routiers recherchent le THC, pas le CBD. Un produit au CBD contenant même de faibles traces de THC peut rendre le test positif. En France, la conduite après usage de THC est interdite quelle que soit la quantité détectée, y compris lorsque le produit au CBD est légal.",
    "Aucun délai ne garantit un test négatif : une consommation la veille ne permet pas d'affirmer que la conduite le lendemain est sans risque. En cas de doute, ne conduisez pas. Un autotest peut informer, mais ne garantit pas un résultat négatif au contrôle officiel.",
    "Après le prélèvement salivaire, indiquez immédiatement à l'agent si vous souhaitez vous réserver la possibilité de demander l'examen technique ou l'expertise : un prélèvement sanguin doit alors être effectué dans le plus court délai possible. La demande peut être faite dans les cinq jours suivant la notification du résultat. Lisez tout document avant de le signer et faites consigner vos observations.",
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
