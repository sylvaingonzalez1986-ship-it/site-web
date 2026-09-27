/** Order rewards use game cents; the checkout amount is expressed in real euros. */
export type KqOrderCashReceipt = {
  orderId: string;
  productsAmountCents: number;
  cashCents: number;
  grantedAt: string;
  ruleVersion: string;
};

export type KqOrderCashRewards = {
  available: boolean;
  gameEurosPerEuro: number;
  startsAt: string | null;
  receipts: KqOrderCashReceipt[];
};

export function estimateOrderCashCents(productsAmount: number, gameEurosPerEuro: number): number {
  if (!Number.isFinite(productsAmount) || productsAmount <= 0
    || !Number.isSafeInteger(gameEurosPerEuro) || gameEurosPerEuro <= 0) return 0;
  const cents = Math.round((productsAmount + Number.EPSILON) * 100) * gameEurosPerEuro;
  return Number.isSafeInteger(cents) && cents <= 2_147_483_647 ? cents : 0;
}

export function formatOrderCash(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(cents / 100);
}
