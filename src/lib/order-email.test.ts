import { describe, expect, it } from "vitest";
import { buildShippedEmail } from "@/lib/order-email";
import type { CmsOrder } from "@/types/store";

const shippedOrder: CmsOrder = {
  id: "ORD-20260811-1234",
  createdAt: "2026-08-11T12:00:00.000Z",
  status: "shipped",
  paymentProvider: "viva",
  paymentState: "paid",
  source: "web",
  customerEmail: "client@example.com",
  customerName: "Client Test",
  deliveryMethod: "relay",
  deliveryFee: 4.9,
  relayName: "Relais Test",
  relayAddress: "1 rue du Test",
  relayPostalCode: "29000",
  relayCity: "Quimper",
  relayCountry: "France",
  trackingNumber: "MR 123/456",
  itemsCount: 1,
  totalHt: 10,
  totalVat: 2,
  vatBreakdown: [],
  totalAmount: 16.9,
  items: [
    {
      productId: "product-1",
      name: "Produit test",
      unitPrice: 12,
      unitPriceHt: 10,
      quantity: 1,
      lineTotal: 12,
      lineTotalHt: 10,
      lineVatAmount: 2,
      vatRate: 20,
    },
  ],
};

describe("shipped order email", () => {
  it("uses the canonical .com domain for every customer-site link", () => {
    const email = buildShippedEmail(shippedOrder);

    expect(email.html).toContain(
      'href="https://leschanvriersbretons.com/profil?tab=commandes"',
    );
    expect(email.html).toContain('target="_blank"');
    expect(email.html).toContain('mso-padding-alt:12px 16px');
    expect(email.html).toContain("Si le bouton ne s'ouvre pas, utilise ce lien");
    expect(email.html).toContain("https://leschanvriersbretons.com/mentions-legales");
    expect(email.html).toContain("https://leschanvriersbretons.com/politique-confidentialite");
    expect(email.text).toContain(
      "Voir mes commandes: https://leschanvriersbretons.com/profil?tab=commandes",
    );
    expect(`${email.html}\n${email.text}`).not.toContain("leschanvriersbretons.fr");
  });

  it("keeps the official relay tracking link and improves the shipping copy", () => {
    const email = buildShippedEmail(shippedOrder);

    expect(email.subject).toBe("Commande #ORD-20260811-1234 expédiée");
    expect(email.html).toContain("Ta commande est en route");
    expect(email.html).toContain(
      "https://www.mondialrelay.fr/suivi-de-colis?numColis=MR%20123%2F456",
    );
    expect(email.html).toContain("Suivre mon colis");
  });
});
