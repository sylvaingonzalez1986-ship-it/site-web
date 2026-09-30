export const INVOICE_PERSONAL_MESSAGE_MAX_LENGTH = 1_000;
export const INVOICE_PERSONAL_MESSAGE_MAX_LINES = 20;

// Unicode ranges from fontkit's characterSet for public/fonts/invoice/
// SpaceGrotesk-Regular.ttf (excluding controls, private use and U+FFFF).
// Keep this static so the browser and API validate against the PDF font without
// loading a font parser. Regenerate these ranges if the invoice body font changes.
const UNSUPPORTED_INVOICE_CHARACTER = new RegExp(
  "[^\\n" +
  "\\u0020-\\u007e\\u00a0-\\u0180\\u018f\\u0192\\u01a0-\\u01a1\\u01af-\\u01b0\\u01c4-\\u01dc\\u01e6-\\u01e7" +
  "\\u01ea-\\u01eb\\u01fa-\\u021b\\u022a-\\u022d\\u0230-\\u0233\\u0237\\u0243\\u0251\\u0259\\u02b9-\\u02bc" +
  "\\u02be-\\u02bf\\u02c6-\\u02cc\\u02d8-\\u02dd\\u0300-\\u0304\\u0306-\\u030c\\u030f\\u0311-\\u0312\\u031b" +
  "\\u0323-\\u0324\\u0326-\\u0328\\u032e\\u0331\\u0394\\u03a9\\u03c0\\u0e3f\\u1e08-\\u1e09\\u1e0c-\\u1e0f" +
  "\\u1e14-\\u1e17\\u1e1c-\\u1e1d\\u1e20-\\u1e21\\u1e24-\\u1e25\\u1e2a-\\u1e2b\\u1e2e-\\u1e2f\\u1e36-\\u1e3b" +
  "\\u1e42-\\u1e49\\u1e4c-\\u1e53\\u1e5a-\\u1e69\\u1e6c-\\u1e6f\\u1e78-\\u1e7b\\u1e80-\\u1e85\\u1e8e-\\u1e8f" +
  "\\u1e92-\\u1e93\\u1e97\\u1e9e\\u1ea0-\\u1ef9\\u2007-\\u200b\\u2010\\u2012-\\u2015\\u2018-\\u201a" +
  "\\u201c-\\u201e\\u2020-\\u2022\\u2026\\u2030\\u2032-\\u2033\\u2039-\\u203a\\u2044\\u2052\\u2070-\\u2071" +
  "\\u2074-\\u2079\\u207d-\\u2089\\u208d-\\u208e\\u2094\\u20a1\\u20a3-\\u20a4\\u20a6-\\u20a7\\u20a9" +
  "\\u20ab-\\u20ad\\u20b1-\\u20b2\\u20b5\\u20b9-\\u20ba\\u20bc-\\u20bd\\u20bf\\u2113\\u2116\\u2120\\u2122\\u2126" +
  "\\u212e\\u2153-\\u2154\\u215b-\\u215e\\u2190-\\u2199\\u2202\\u2205-\\u2206\\u220f\\u2211-\\u2212\\u2215" +
  "\\u2219-\\u221a\\u221e\\u222b\\u2248\\u2260\\u2264-\\u2265\\u25ca\\u27e8-\\u27e9\\ufb00-\\ufb04" +
  "]",
  "u",
);

export type InvoicePersonalMessageValidation =
  | { ok: true; message: string }
  | { ok: false; error: string };

/** Shared by the editor and the API; invoice messages are plain text. */
export function validateInvoicePersonalMessage(value: unknown): InvoicePersonalMessageValidation {
  if (typeof value !== "string") {
    return { ok: false, error: "Le message doit être un texte." };
  }

  const message = value.normalize("NFC").replace(/\r\n?/g, "\n").replace(/[\u2028\u2029]/g, "\n").replace(/\u202f/g, "\u00a0").replace(/\t/g, "  ").trim();
  if (message.length > INVOICE_PERSONAL_MESSAGE_MAX_LENGTH) {
    return { ok: false, error: `Le message est limité à ${INVOICE_PERSONAL_MESSAGE_MAX_LENGTH} caractères.` };
  }
  if (message.split("\n").length > INVOICE_PERSONAL_MESSAGE_MAX_LINES) {
    return { ok: false, error: `Le message est limité à ${INVOICE_PERSONAL_MESSAGE_MAX_LINES} lignes.` };
  }
  if (Array.from(message).some((character) => {
    const code = character.charCodeAt(0);
    return (code < 32 && code !== 10) || (code >= 127 && code <= 159);
  })) {
    return { ok: false, error: "Le message contient des caractères de contrôle non autorisés." };
  }
  if (UNSUPPORTED_INVOICE_CHARACTER.test(message)) {
    return {
      ok: false,
      error: "La facture ne peut pas afficher certains caractères de ton message, notamment les emojis. Remplace-les avant de télécharger le PDF.",
    };
  }

  return { ok: true, message };
}
