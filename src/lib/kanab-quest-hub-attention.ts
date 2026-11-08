/** Advice only. Opening a destination never confirms a payment or a sale. */
export type KqHubAttentionNotice = {
  id: "invoice-overdue" | "invoice-upcoming" | "sales-suspended" | "sales-quality" | "trim-required";
  severity: "urgent" | "attention" | "upcoming";
  title: string;
  description: string;
  buttonLabel: string;
  summary: string;
  destination: "treasury" | "market" | "workshop";
  href?: string;
  options: {
    treasuryPole?: "accounting";
    marketSection?: "dashboard" | "management";
    listingId?: string;
  };
};

export type KqHubAttentionResult = {
  notice: KqHubAttentionNotice | null;
  /** False never means that no invoice or blocked sale exists. */
  complete: boolean;
};
