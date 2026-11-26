import type { CheckoutDraft } from "@/lib/checkout-draft";
import { normalizeShippingCountryCode } from "@/lib/shipping-country";
import { normalizeShippingPhone } from "@/lib/shipping-phone";

type CheckoutDeliveryField =
  | "name"
  | "email"
  | "phone"
  | "address"
  | "city"
  | "postalCode"
  | "country"
  | "relay";

type CheckoutDeliveryError = { field: CheckoutDeliveryField; message: string };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const postalCodePattern = /^[A-Za-z0-9 -]{3,16}$/;

/** Return errors in the order the controls appear in the drawer. */
export function getCheckoutDeliveryErrors(draft: CheckoutDraft): CheckoutDeliveryError[] {
  const errors: CheckoutDeliveryError[] = [];
  const country = normalizeShippingCountryCode(draft.shippingCountry);
  const email = draft.shippingEmail.trim();
  const phone = draft.shippingPhone.trim();
  const isFranceOrBelgium = country === "FR" || country === "BE";
  const phoneDigits = (isFranceOrBelgium ? normalizeShippingPhone(phone, country) : phone).replace(/\D/g, "");

  if (!draft.shippingName.trim()) errors.push({ field: "name", message: "Saisis ton nom complet." });
  if (email.length > 120 || !emailPattern.test(email)) {
    errors.push({ field: "email", message: "Saisis une adresse e-mail valide, par exemple nom@exemple.fr." });
  }
  if (phone.length > 40 || phoneDigits.length < 8) {
    errors.push({ field: "phone", message: "Saisis un numéro de téléphone valide." });
  }

  const postalCode = draft.shippingPostalCode.trim();
  const relay = draft.selectedRelayPoint;
  if (draft.deliveryMethod === "home") {
    if (!draft.shippingAddress.trim()) errors.push({ field: "address", message: "Saisis ton adresse de livraison." });
    if (!draft.shippingCity.trim()) errors.push({ field: "city", message: "Saisis ta ville de livraison." });
    if (!postalCodePattern.test(postalCode)) errors.push({ field: "postalCode", message: "Saisis un code postal valide." });
  } else if (!relay && (postalCode.length < 4 || !postalCodePattern.test(postalCode))) {
    errors.push({ field: "postalCode", message: "Saisis un code postal valide pour rechercher un point relais." });
  }

  if (!country) errors.push({ field: "country", message: "Saisis ton pays de livraison, par exemple France ou Belgique." });

  if (draft.deliveryMethod === "relay" && (
    !relay?.id?.trim() || !relay.name?.trim() || !relay.address?.trim() || !relay.city?.trim() ||
    !postalCodePattern.test(relay.postalCode?.trim() ?? "") || !country || normalizeShippingCountryCode(relay.country) !== country
  )) {
    errors.push({ field: "relay", message: "Choisis un point relais disponible dans le pays de livraison." });
  }

  return errors;
}

export type { CheckoutDeliveryField };
