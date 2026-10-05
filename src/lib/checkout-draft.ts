import type { DeliveryMethod, MondialRelayPoint } from "@/lib/shipping";
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
  return {
    shippingName: customer ? `${customer.firstName} ${customer.lastName}`.trim() : "",
    shippingEmail: customer?.email ?? "",
    shippingPhone: customer?.phone ?? "",
    shippingAddress: customer?.address ?? "",
    shippingCity: customer?.city ?? "",
    shippingPostalCode: customer?.postalCode ?? "",
    shippingCountry: customer?.country || "France",
    deliveryMethod: "home",
    selectedRelayPoint: null,
    ...edits,
  };
}
