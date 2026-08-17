import { describe, expect, it } from "vitest";
import {
  INVOICE_CBD_DRIVING_NOTICE,
  INVOICE_CUSTOMER_THANK_YOU,
} from "@/lib/invoice-config";

describe("invoice customer thank-you", () => {
  it("thanks the customer and highlights the small producers behind the order", () => {
    expect(INVOICE_CUSTOMER_THANK_YOU.title).toBe("MERCI DE SOUTENIR NOS PRODUCTEURS");
    expect(INVOICE_CUSTOMER_THANK_YOU.body).toContain("petits producteurs passionnés");
    expect(INVOICE_CUSTOMER_THANK_YOU.body).toContain("savoir-faire");
    expect(INVOICE_CUSTOMER_THANK_YOU.body).toContain("aventure humaine et locale");
  });
});

describe("invoice CBD driving notice", () => {
  const fullNotice = [
    INVOICE_CBD_DRIVING_NOTICE.title,
    ...INVOICE_CBD_DRIVING_NOTICE.paragraphs,
    INVOICE_CBD_DRIVING_NOTICE.source,
  ].join(" ");

  it("warns that THC can produce a positive roadside test without promising a safe delay", () => {
    expect(fullNotice).toContain("traces de THC");
    expect(fullNotice).toContain("Aucun délai ne garantit un test négatif");
    expect(fullNotice).toContain("En cas de doute, ne conduisez pas");
    expect(fullNotice).not.toContain("relativement safe");
  });

  it("states the current procedure for preserving the right to a technical examination", () => {
    expect(fullNotice).toContain("indiquez immédiatement à l'agent");
    expect(fullNotice).toContain("prélèvement sanguin");
    expect(fullNotice).toContain("cinq jours suivant la notification du résultat");
    expect(fullNotice).toContain("R. 235-6 et R. 235-11");
  });
});
