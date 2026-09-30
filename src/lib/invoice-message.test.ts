import { describe, expect, it } from "vitest";
import { validateInvoicePersonalMessage } from "@/lib/invoice-message";

describe("invoice personal message", () => {
  it("preserves French text and paragraphs while normalizing pasted line endings", () => {
    expect(validateInvoicePersonalMessage("  Merci Élodie !\r\n\r\nÀ bientôt,\rSylvain\t& l’équipe  ")).toEqual({
      ok: true, message: "Merci Élodie !\n\nÀ bientôt,\nSylvain  & l’équipe",
    });
  });

  it("accepts an empty message to remove the previous personal message", () => {
    expect(validateInvoicePersonalMessage(" \r\n\t ")).toEqual({ ok: true, message: "" });
  });

  it("bounds both text length and vertical space, without silently truncating", () => {
    expect(validateInvoicePersonalMessage("a".repeat(1_000)).ok).toBe(true);
    expect(validateInvoicePersonalMessage("a".repeat(1_001)).ok).toBe(false);
    expect(validateInvoicePersonalMessage(Array(20).fill("Merci").join("\n")).ok).toBe(true);
    expect(validateInvoicePersonalMessage(Array(21).fill("Merci").join("\n")).ok).toBe(false);
  });

  it.each([null, undefined, 42, {}, ["Bonjour"], "Bonjour\u0000", "Bonjour\u001b"])("rejects invalid input %j", (input) => {
    expect(validateInvoicePersonalMessage(input).ok).toBe(false);
  });

  it("keeps markup as plain text rather than interpreting it", () => {
    expect(validateInvoicePersonalMessage('<b>Merci</b> & bonjour')).toEqual({
      ok: true, message: '<b>Merci</b> & bonjour',
    });
  });

  it("normalizes composed accents while keeping supported currencies and punctuation", () => {
    const message = "Merci E\u0301lodie, a\u0300 biento\u0302t !\n« Fidélité » : 50 € / £ / $ — l’équipe…";
    expect(validateInvoicePersonalMessage(message)).toEqual({
      ok: true,
      message: "Merci Élodie, à bientôt !\n« Fidélité » : 50 € / £ / $ — l’équipe…",
    });
    expect(validateInvoicePersonalMessage("e\u0301".repeat(1_000))).toEqual({
      ok: true,
      message: "é".repeat(1_000),
    });
    expect(validateInvoicePersonalMessage("50\u202f€ offerts")).toEqual({
      ok: true,
      message: "50\u00a0€ offerts",
    });
  });

  it.each(["Merci 💚", "Bonne dégustation 🌿", "Привет", "你好", "\ue132", "\uffff"])(
    "rejects characters unavailable in the invoice font: %j",
    (message) => {
      const result = validateInvoicePersonalMessage(message);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("Remplace-les avant de télécharger le PDF");
    },
  );
});
