/** Management accounts for the game's virtual euros. Debit balances are positive. */
export const KQ_TREASURY_ACCOUNTS = {
  cash: "Trésorerie disponible",
  vat_reserve: "Trésorerie réservée à la TVA",
  savings: "Épargne",
  crypto_assets: "Cryptoactifs au coût d’acquisition",
  equipment: "Matériel — valeur nette",
  website: "Site internet — valeur nette",
  stock: "Stocks au coût de production",
  prepaid: "Charges payées d’avance",
  lab_payable: "Analyses à payer",
  energy_payable: "Électricité et soins à payer",
  vat_payable: "TVA à reverser",
  loan_payable: "Emprunts bancaires restant dus",
  opening_equity: "Situation nette à l’ouverture",
  capital: "Apports et dotations de jeu",
  suspense: "Mouvements à classer",
  revenue_online: "Ventes en ligne HT",
  revenue_shop: "Ventes aux boutiques HT",
  revenue_wholesale: "Ventes aux grossistes HT",
  revenue_rewards: "Primes d’activité",
  revenue_interest: "Intérêts d’épargne",
  revenue_crypto_gains: "Gains réalisés sur les cryptoactifs",
  expense_lab: "Analyses laboratoire",
  expense_energy: "Électricité et soins",
  expense_processing: "Transformation",
  expense_hosting: "Hébergement et maintenance du site",
  expense_advertising: "Publicité",
  expense_domiciliation: "Domiciliation",
  expense_maintenance: "Entretien du matériel",
  expense_depreciation: "Amortissements",
  stock_variation: "Variation des stocks",
  expense_other: "Autres charges",
  expense_loan_interest: "Intérêts des emprunts",
  expense_crypto_losses: "Pertes réalisées sur les cryptoactifs",
} as const;

export type KqTreasuryAccount = keyof typeof KQ_TREASURY_ACCOUNTS;
export type KqTreasuryBalances = Partial<Record<KqTreasuryAccount, number>>;
export type KqTreasuryPeriod = "current" | "previous" | "all";
export type KqTreasuryPosting = { account: KqTreasuryAccount; deltaCents: number };
export type KqTreasuryEntry = {
  id: string; occurredAt: string; kind: string; reference: string;
  postings: KqTreasuryPosting[];
};
export type KqTreasuryPoint = {
  from: string; to: string; cashOpeningCents: number; cashClosingCents: number;
  inflowsCents: number; outflowsCents: number; revenueCents: number; expenseCents: number;
};
export type KqTreasurySnapshot = {
  version: 1; serverNow: string; startedAt: string; businessStartedAt: string;
  period: { key: KqTreasuryPeriod; from: string; to: string };
  openingBalances: KqTreasuryBalances; closingBalances: KqTreasuryBalances;
  series: KqTreasuryPoint[];
  journal: { items: KqTreasuryEntry[]; total: number; offset: number; limit: number };
  unclassified?: { transactions: number; netCents: number; absoluteCents: number };
  checks: {
    walletCashCents: number; vatReserveCents: number; savingsCents: number;
    labDebtCents: number; energyDebtCents: number; vatDebtCents: number;
    loanDebtCents?: number; cryptoCostCents?: number;
  };
};

export const KQ_TREASURY_PERIODS: Record<KqTreasuryPeriod, string> = {
  current: "Mois de jeu en cours", previous: "Mois de jeu précédent", all: "Depuis l’ouverture",
};
export const KQ_TREASURY_REVENUE_ACCOUNTS: KqTreasuryAccount[] = [
  "revenue_online", "revenue_shop", "revenue_wholesale", "revenue_rewards", "revenue_interest", "revenue_crypto_gains",
];
export const KQ_TREASURY_EXPENSE_ACCOUNTS: KqTreasuryAccount[] = [
  "expense_lab", "expense_energy", "expense_processing", "expense_hosting", "expense_advertising",
  "expense_domiciliation", "expense_maintenance", "expense_depreciation", "stock_variation", "expense_other", "expense_loan_interest", "expense_crypto_losses",
];
export const KQ_TREASURY_ENTRY_LABELS: Record<string, string> = {
  "loan-issued": "Versement du prêt", "loan-interest": "Intérêts du prêt", "loan-repayment": "Remboursement du prêt",
  "crypto-buy": "Achat de cryptoactifs", "crypto-sell": "Vente de cryptoactifs",
  opening: "Ouverture des comptes", cash: "Mouvement de trésorerie", sale: "Vente",
  "vat-reserve": "Mise en réserve de TVA", "vat-paid": "Reversement de TVA",
  "lab-issued": "Facture laboratoire", "lab-paid": "Règlement laboratoire",
  "energy-issued": "Facture électricité et soins", "energy-paid": "Règlement électricité et soins",
  "shop-created": "Création du site", "shop-renewed": "Hébergement du site",
  "domicile-paid": "Domiciliation", "advertising-started": "Campagne publicitaire",
  "equipment-purchase": "Achat de matériel", "equipment-upgrade": "Amélioration du matériel",
  "equipment-repair": "Entretien du matériel", "equipment-replacement": "Remplacement du matériel",
  "stock-valuation": "Variation du stock", processing: "Transformation du lot",
  savings: "Mouvement d’épargne", interest: "Intérêts d’épargne", capital: "Dotation de jeu",
  reward: "Prime d’activité", depreciation: "Amortissement", "prepaid-release": "Charge de la période",
  "cash-movement": "Mouvement de trésorerie", "savings-movement": "Mouvement d’épargne",
  "savings-interest": "Intérêts d’épargne", "invoice-issued": "Facture de culture",
  "invoice-payment": "Règlement d’une facture", "asset-purchase": "Investissement ou charge payée d’avance",
  maintenance: "Entretien du matériel", "asset-disposal": "Sortie du matériel remplacé",
  "vat-remittance": "Reversement de TVA", "capital-grant": "Dotation de jeu", "prepaid-expense": "Charge de la période",
};

export type KqTreasuryLine = { account: string; label: string; cents: number };
const ASSETS: KqTreasuryAccount[] = ["cash", "vat_reserve", "savings", "crypto_assets", "equipment", "website", "stock", "prepaid"];
const DEBTS: KqTreasuryAccount[] = ["lab_payable", "energy_payable", "vat_payable", "loan_payable"];
const total = (values: number[]) => values.reduce((sum, amount) => {
  const next = sum + amount;
  if (!Number.isSafeInteger(next)) throw new Error("Montants comptables hors limites.");
  return next;
}, 0);
const balance = (values: KqTreasuryBalances, account: KqTreasuryAccount) => values[account] ?? 0;
const sumAccounts = (values: KqTreasuryBalances, accounts: KqTreasuryAccount[]) => total(accounts.map(account => balance(values, account)));
const credit = (value: number) => value === 0 ? 0 : -value;

/** Totals use complete server aggregates, never the paginated journal. */
export function getKqTreasuryReport(data: KqTreasurySnapshot) {
  const closing = data.closingBalances;
  const movement = Object.fromEntries(Object.keys(KQ_TREASURY_ACCOUNTS).map(key => {
    const account = key as KqTreasuryAccount;
    return [account, balance(closing, account) - balance(data.openingBalances, account)];
  })) as KqTreasuryBalances;
  const line = (account: KqTreasuryAccount, cents: number): KqTreasuryLine => ({ account, label: KQ_TREASURY_ACCOUNTS[account], cents });
  const revenues = KQ_TREASURY_REVENUE_ACCOUNTS.map(account => line(account, credit(balance(movement, account))));
  const expenses = KQ_TREASURY_EXPENSE_ACCOUNTS.map(account => line(account, balance(movement, account)));
  const revenueCents = total(revenues.map(row => row.cents));
  const expenseCents = total(expenses.map(row => row.cents));
  const resultCents = revenueCents - expenseCents;
  const retainedResultCents = credit(sumAccounts(data.openingBalances, [...KQ_TREASURY_REVENUE_ACCOUNTS, ...KQ_TREASURY_EXPENSE_ACCOUNTS]));
  const assets = ASSETS.map(account => line(account, balance(closing, account)));
  const debts = DEBTS.map(account => line(account, credit(balance(closing, account))));
  const suspenseCents = balance(closing, "suspense");
  if (suspenseCents > 0) assets.push(line("suspense", suspenseCents));
  if (suspenseCents < 0) debts.push(line("suspense", -suspenseCents));
  const equity: KqTreasuryLine[] = [
    line("opening_equity", credit(balance(closing, "opening_equity"))),
    line("capital", credit(balance(closing, "capital"))),
    { account: "retained_result", label: "Résultat des périodes antérieures", cents: retainedResultCents },
    { account: "period_result", label: "Résultat de la période", cents: resultCents },
  ];
  const assetsCents = total(assets.map(row => row.cents));
  const debtCents = total(debts.map(row => row.cents));
  const equityCents = total(equity.map(row => row.cents));
  const cashCents = balance(closing, "cash");
  const unpaidCents = credit(sumAccounts(closing, ["lab_payable", "energy_payable"]));
  const sourceDifferences = {
    cash: cashCents - data.checks.walletCashCents,
    vatReserve: balance(closing, "vat_reserve") - data.checks.vatReserveCents,
    savings: balance(closing, "savings") - data.checks.savingsCents,
    lab: -balance(closing, "lab_payable") - data.checks.labDebtCents,
    energy: -balance(closing, "energy_payable") - data.checks.energyDebtCents,
    vat: -balance(closing, "vat_payable") - data.checks.vatDebtCents,
    loan: -balance(closing, "loan_payable") - (data.checks.loanDebtCents ?? 0),
    crypto: balance(closing, "crypto_assets") - (data.checks.cryptoCostCents ?? 0),
  };
  // Source checks refer to live balances; a previous-month balance is historical.
  const reconciled = data.period.key === "previous" ? null : Object.values(sourceDifferences).every(value => value === 0);
  return {
    income: { revenues, expenses, revenueCents, expenseCents, resultCents,
      salesHtCents: credit(sumAccounts(movement, ["revenue_online", "revenue_shop", "revenue_wholesale"])),
      operatingResultCents: resultCents + balance(movement, "revenue_interest") + balance(movement, "revenue_crypto_gains")
        + balance(movement, "expense_loan_interest") + balance(movement, "expense_crypto_losses") },
    balanceSheet: { assets, debts, equity, assetsCents, debtCents, equityCents,
      liabilitiesCents: debtCents + equityCents, differenceCents: assetsCents - debtCents - equityCents },
    cash: { availableCents: cashCents, reservedVatCents: balance(closing, "vat_reserve"),
      savingsCents: balance(closing, "savings"), loanDebtCents: credit(balance(closing, "loan_payable")),
      cryptoCostCents: balance(closing, "crypto_assets"), unpaidCents, afterDebtCents: cashCents - unpaidCents,
      openingCents: balance(data.openingBalances, "cash"), changeCents: balance(movement, "cash"),
      inflowsCents: total(data.series.map(point => point.inflowsCents)),
      outflowsCents: total(data.series.map(point => point.outflowsCents)) },
    suspenseCents, reconciled, sourceDifferences,
  };
}

export function getKqTreasuryEntryLabel(kind: string) {
  return KQ_TREASURY_ENTRY_LABELS[kind] ?? "Écriture comptable";
}

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
const date = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));
const money = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value);
const natural = (value: unknown) => money(value) && (value as number) >= 0;
function validBalances(value: unknown) {
  return object(value) && Object.entries(value).every(([key, amount]) => Object.hasOwn(KQ_TREASURY_ACCOUNTS, key) && money(amount));
}

/** Reject partial/old schemas instead of presenting an invented zero balance. */
export function isKqTreasurySnapshot(value: unknown): value is KqTreasurySnapshot {
  if (!object(value) || value.version !== 1 || !date(value.serverNow) || !date(value.startedAt) || !date(value.businessStartedAt)
    || !object(value.period) || !Object.hasOwn(KQ_TREASURY_PERIODS, String(value.period.key))
    || !date(value.period.from) || !date(value.period.to)
    || !validBalances(value.openingBalances) || !validBalances(value.closingBalances)
    || !object(value.checks) || !["walletCashCents", "vatReserveCents", "savingsCents", "labDebtCents", "energyDebtCents", "vatDebtCents"].every(key => natural(value.checks && (value.checks as Record<string, unknown>)[key]))
    || !Array.isArray(value.series) || value.series.length > 1200 || !object(value.journal)
    || !Array.isArray(value.journal.items) || !natural(value.journal.total) || !natural(value.journal.offset)
    || !natural(value.journal.limit) || (value.journal.limit as number) < 1 || (value.journal.limit as number) > 100
    || value.journal.items.length > (value.journal.limit as number)) return false;
  if (["loanDebtCents", "cryptoCostCents"].some(key => (value.checks as Record<string, unknown>)[key] !== undefined && !natural((value.checks as Record<string, unknown>)[key]))) return false;
  if (value.unclassified !== undefined && (!object(value.unclassified) || !natural(value.unclassified.transactions)
    || !money(value.unclassified.netCents) || !natural(value.unclassified.absoluteCents))) return false;
  if (!value.series.every(point => object(point) && date(point.from) && date(point.to)
    && ["cashOpeningCents", "cashClosingCents", "inflowsCents", "outflowsCents"].every(key => natural(point[key]))
    && money(point.revenueCents) && money(point.expenseCents))) return false;
  return value.journal.items.every(entry => object(entry) && typeof entry.id === "string" && date(entry.occurredAt)
    && typeof entry.kind === "string" && typeof entry.reference === "string" && Array.isArray(entry.postings)
    && entry.postings.length > 0 && entry.postings.every(posting => object(posting)
      && Object.hasOwn(KQ_TREASURY_ACCOUNTS, String(posting.account)) && money(posting.deltaCents))
    && entry.postings.reduce((sum, posting) => sum + (posting as KqTreasuryPosting).deltaCents, 0) === 0);
}
