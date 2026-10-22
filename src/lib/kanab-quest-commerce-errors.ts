export type KqCommerceOfferChangedCode = "commerce_offer_changed" | "commerce_storage_changed";

export function isKqCommerceOfferChangedCode(value: unknown): value is KqCommerceOfferChangedCode {
  return value === "commerce_offer_changed" || value === "commerce_storage_changed";
}

/** A rejected transaction is safe to replace with a new offer; a network failure is not. */
export class KqCommerceOfferChangedError extends Error {
  constructor(message: string, readonly code: KqCommerceOfferChangedCode) {
    super(message);
    this.name = "KqCommerceOfferChangedError";
  }
}
