import type { DeliveryMethod, MondialRelayPoint } from "@/lib/shipping";
import { normalizeShippingCountryCode } from "@/lib/shipping-country";
import { normalizeShippingPhone } from "@/lib/shipping-phone";
import type { PublicCustomer } from "@/types/customer";

export type CheckoutDraft = {
  shippingName: string;
  shippingEmail: string;
  shippingPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingPostalCode: string;
  shippingCountry: string;
  deliveryMethod: DeliveryMethod;
  selectedRelayPoint: MondialRelayPoint | null;
};

/** Only edited fields are retained, in memory, for the current customer. */
export type CheckoutDraftState = {
  customerId: string | null;
  edits: Partial<CheckoutDraft>;
};

export function alignCheckoutDraft(
  state: CheckoutDraftState,
  customerId: string | null,
): CheckoutDraftState {
  if (state.customerId === customerId) return state;

  // A visitor can estimate delivery before signing in. Carry over only that
  // non-personal choice; another customer's address/relay must never follow.
  const edits: Partial<CheckoutDraft> =
    state.customerId === null && customerId !== null && state.edits.deliveryMethod
      ? { deliveryMethod: state.edits.deliveryMethod }
      : {};
  return { customerId, edits };
}

export function resolveCheckoutDraft(
  state: CheckoutDraftState,
  customer: PublicCustomer | null,
): CheckoutDraft {
  const { edits } = alignCheckoutDraft(state, customer?.id ?? null);
  const draft: CheckoutDraft = {
    shippingName: customer ? `${customer.firstName} ${customer.lastName}`.trim() : "",
    shippingEmail: customer?.email ?? "",
    shippingPhone: normalizeShippingPhone(customer?.phone, customer?.country || "France") || customer?.phone || "",
    shippingAddress: customer?.address ?? "",
    shippingCity: customer?.city ?? "",
    shippingPostalCode: customer?.postalCode ?? "",
    shippingCountry: customer?.country || "France",
    deliveryMethod: "home",
    selectedRelayPoint: null,
    ...edits,
  };
  if (
    draft.selectedRelayPoint &&
    normalizeShippingCountryCode(draft.selectedRelayPoint.country) !==
      normalizeShippingCountryCode(draft.shippingCountry)
  ) {
    draft.selectedRelayPoint = null;
  }
  return draft;
}

/** A relay must be selected again after the customer changes the search location. */
export function patchCheckoutDraft(
  state: CheckoutDraftState,
  customer: PublicCustomer | null,
  patch: Partial<CheckoutDraft>,
): CheckoutDraftState {
  const scoped = alignCheckoutDraft(state, customer?.id ?? null);
  const previous = resolveCheckoutDraft(scoped, customer);
  const next = { ...previous, ...patch };
  const locationChanged =
    normalizeShippingCountryCode(previous.shippingCountry) !== normalizeShippingCountryCode(next.shippingCountry) ||
    previous.shippingPostalCode.trim().toUpperCase() !== next.shippingPostalCode.trim().toUpperCase() ||
    previous.shippingCity.trim().toUpperCase() !== next.shippingCity.trim().toUpperCase();
  const edits = { ...scoped.edits, ...patch };
  if (locationChanged) edits.selectedRelayPoint = null;
  return { ...scoped, edits };
}
