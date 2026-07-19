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

export function getInvoiceLegalFooter(): string {
  if (INVOICE_SETTINGS.vatMode === "exempt") {
    return "TVA non applicable, art. 293 B du CGI";
  }

  return "TVA applicable.";
}
