import { describe, expect, it } from "vitest";
import type { CheckoutDraft } from "@/lib/checkout-draft";
import { getCheckoutDeliveryErrors } from "@/lib/checkout-delivery-validation";

const home: CheckoutDraft = {
  shippingName: "Client Test",
  shippingEmail: "client@example.test",
  shippingPhone: "0600000000",
  shippingAddress: "1 rue du Test",
  shippingCity: "Rennes",
  shippingPostalCode: "35000",
  shippingCountry: "France",
  deliveryMethod: "home",
  selectedRelayPoint: null,
};

const relay: CheckoutDraft = {
  ...home,
  deliveryMethod: "relay",
  shippingAddress: "",
  shippingCity: "",
  selectedRelayPoint: {
    id: "relay-test",
    name: "Relais de test",
    address: "1 rue du Test",
    postalCode: "35000",
    city: "Rennes",
    country: "FR",
  },
};

describe("checkout delivery validation", () => {
  it("allows complete delivery details, including a Belgian phone for France", () => {
    expect(getCheckoutDeliveryErrors(home)).toEqual([]);
    expect(getCheckoutDeliveryErrors({ ...home, shippingPhone: "+32470123456" })).toEqual([]);
  });

  it("reports all delivery errors in visual order", () => {
    const errors = getCheckoutDeliveryErrors({
      ...home,
      shippingName: " ",
      shippingEmail: "invalide",
      shippingPhone: "1234",
      shippingAddress: "",
      shippingCity: "",
      shippingPostalCode: "/",
      shippingCountry: "invalide",
    });
    expect(errors.map(error => error.field)).toEqual(["name", "email", "phone", "address", "city", "postalCode", "country"]);
  });

  it("uses the chosen relay instead of requiring a home address or a city for lookup", () => {
    expect(getCheckoutDeliveryErrors(relay)).toEqual([]);
    expect(getCheckoutDeliveryErrors({ ...relay, selectedRelayPoint: null }).map(error => error.field)).toEqual(["relay"]);
    expect(getCheckoutDeliveryErrors({
      ...relay, shippingPostalCode: "", selectedRelayPoint: null,
    }).map(error => error.field)).toEqual(["postalCode", "relay"]);
  });

  it("rejects incomplete relays and relays outside the delivery country", () => {
    const point = relay.selectedRelayPoint!;
    for (const patch of [{ name: " " }, { postalCode: "/" }, { country: "BE" }]) {
      expect(getCheckoutDeliveryErrors({
        ...relay, selectedRelayPoint: { ...point, ...patch },
      }).map(error => error.field)).toEqual(["relay"]);
    }
  });
});
