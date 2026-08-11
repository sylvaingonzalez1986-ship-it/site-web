export const PENDING_VIVA_PAYMENT_STORAGE_KEY = "checkout:viva:pending-payment";
export const VIVA_CHECKOUT_ATTEMPT_STORAGE_KEY = "checkout:viva:attempt";

export type PendingVivaPayment = {
  version: 1;
  attemptId: string;
  orderId: string;
  createdAt: number;
};

const MAX_PENDING_PAYMENT_AGE_MS = 48 * 60 * 60 * 1000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function readPendingVivaPayment(
  storage: Pick<Storage, "getItem" | "removeItem">,
  now = Date.now(),
): PendingVivaPayment | null {
  try {
    const raw = storage.getItem(PENDING_VIVA_PAYMENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingVivaPayment>;
    const isValid =
      parsed.version === 1 &&
      typeof parsed.attemptId === "string" &&
      UUID_PATTERN.test(parsed.attemptId) &&
      typeof parsed.orderId === "string" &&
      parsed.orderId.trim().length > 0 &&
      parsed.orderId.length <= 120 &&
      typeof parsed.createdAt === "number" &&
      Number.isFinite(parsed.createdAt) &&
      parsed.createdAt <= now + 60_000 &&
      now - parsed.createdAt <= MAX_PENDING_PAYMENT_AGE_MS;

    if (!isValid) {
      storage.removeItem(PENDING_VIVA_PAYMENT_STORAGE_KEY);
      return null;
    }
    return parsed as PendingVivaPayment;
  } catch {
    storage.removeItem(PENDING_VIVA_PAYMENT_STORAGE_KEY);
    return null;
  }
}

export function savePendingVivaPayment(
  storage: Pick<Storage, "setItem">,
  payment: Omit<PendingVivaPayment, "version" | "createdAt">,
): void {
  storage.setItem(
    PENDING_VIVA_PAYMENT_STORAGE_KEY,
    JSON.stringify({ ...payment, version: 1, createdAt: Date.now() } satisfies PendingVivaPayment),
  );
}

export function clearPendingVivaPayment(
  storage: Pick<Storage, "getItem" | "removeItem">,
  expectedOrderId?: string,
): void {
  if (expectedOrderId) {
    const payment = readPendingVivaPayment(storage);
    if (payment && payment.orderId !== expectedOrderId) return;
  }
  storage.removeItem(PENDING_VIVA_PAYMENT_STORAGE_KEY);
}
