export type SwissBitcoinAttemptState =
  | "creating" | "unknown" | "pending" | "confirming" | "expired" | "failed" | "paid" | "review";

export type SwissBitcoinPaymentSummary = {
  id: string;
  invoiceId: string | null;
  expectedEurMinor: number;
  state: SwissBitcoinAttemptState;
  createdAt: string;
  expiresAt: string | null;
  lastCheckedAt: string | null;
  paidAt: string | null;
  paidSats: number | null;
  paymentReference: string | null;
  issue: string | null;
  providerStatus: string | null;
};

export type SwissBitcoinPaymentStatus = {
  orderId: string;
  totalAmount: number;
  state: "preparing" | "pending" | "confirming" | "paid" | "expired" | "unavailable" | "review" | "cancelled";
  archiveRequested?: boolean;
  checkoutUrl?: string;
  resumeCardUrl?: string;
  expiresAt?: string;
  canRetry: boolean;
  canPayByCard: boolean;
};
