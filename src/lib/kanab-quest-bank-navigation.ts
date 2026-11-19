export const KQ_BANK_DESK_LABELS = {
  loans: "Prêts",
  savings: "Livret d’épargne",
  stocks: "Bourse",
  crypto: "Crypto",
} as const;

export type KqBankDesk = keyof typeof KQ_BANK_DESK_LABELS;

export function isKqBankDesk(value: string | null | undefined): value is KqBankDesk {
  return typeof value === "string" && Object.hasOwn(KQ_BANK_DESK_LABELS, value);
}
