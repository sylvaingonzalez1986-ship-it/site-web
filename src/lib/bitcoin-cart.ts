import { readBrowserCart, type StoredCartLine } from "@/lib/cart-session-storage";
import { VIVA_CHECKOUT_ATTEMPT_STORAGE_KEY } from "@/lib/pending-viva-payment";

const cartKey = (orderId: string) => `checkout:bitcoin:cart:${orderId}`;
const maxAgeMs = 48 * 60 * 60 * 1000;

function describeCart(items: StoredCartLine[]): string {
  return JSON.stringify(items.map(({ id, quantity, price }) => [id, quantity, price]).sort());
}

export function saveBitcoinCart(orderId: string, attemptId: string, items: StoredCartLine[]): void {
  try {
    const key = cartKey(orderId);
    if (!window.sessionStorage.getItem(key)) {
      window.sessionStorage.setItem(key, JSON.stringify({
        attemptId, cart: describeCart(items), createdAt: Date.now(),
      }));
    }
  } catch {
    // The customer can still pay without browser storage.
  }
}

export function consumePaidBitcoinCart(
  orderId: string,
  items: StoredCartLine[],
  clearCart: () => void,
): void {
  try {
    const storage = window.sessionStorage;
    const key = cartKey(orderId);
    const raw = storage.getItem(key);
    if (!raw) return;
    storage.removeItem(key);
    const marker = JSON.parse(raw) as { attemptId: string; cart: string; createdAt: number };
    const activeAttempt = JSON.parse(storage.getItem(VIVA_CHECKOUT_ATTEMPT_STORAGE_KEY) ?? "null") as
      { attemptId?: string } | null;
    if (activeAttempt?.attemptId !== marker.attemptId) return;
    storage.removeItem(VIVA_CHECKOUT_ATTEMPT_STORAGE_KEY);
    if (
      Date.now() - marker.createdAt <= maxAgeMs &&
      describeCart(items) === marker.cart &&
      describeCart(readBrowserCart()) === marker.cart
    ) {
      clearCart();
    }
  } catch {
    // Keep the cart when the checkout snapshot cannot be verified.
  }
}
