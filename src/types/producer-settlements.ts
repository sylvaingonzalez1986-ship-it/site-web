export type ProducerRate = {
  producerId: string;
  productId: string;
  effectiveMonth: string;
  mode: "unit" | "gram" | "percent_ht";
  rate: number;
  gramsPerUnit: number | null;
};

export type ProducerPayment = {
  id: string;
  producerId: string;
  producerName: string;
  salesMonth: string;
  salesFromMonth?: string;
  amountCents: number;
  paidOn: string;
  reference: string;
  note: string;
  createdAt: string;
  voidedAt: string | null;
  voidReason: string | null;
};

export type ProducerProductSales = {
  productId: string;
  productName: string;
  quantity: number;
  gramsSold?: number | null;
  revenueTtcCents: number;
  revenueHtCents: number;
  rate: ProducerRate | null;
  dueCents: number | null;
};

export type ProducerSalesPeriod = {
  producerId: string;
  producerName: string;
  month: string;
  ordersCount: number;
  quantity: number;
  gramsSold?: number | null;
  revenueTtcCents: number;
  revenueHtCents: number;
  dueCents: number;
  missingRateCount: number;
  paidCents: number;
  balanceCents: number;
  products: ProducerProductSales[];
};

export type ProducerSettlementsDashboard = {
  generatedAt: string;
  producers: Array<{ id: string; name: string }>;
  periods: ProducerSalesPeriod[];
  rates: ProducerRate[];
  payments: ProducerPayment[];
  unattributed: { quantity: number; revenueTtcCents: number };
};

export type ProducerSaleSource = {
  orderId: string;
  createdAt: string;
  paymentState: string;
  status: string;
  archivedAt: string | null;
  productId: string;
  productName: string;
  producerId: string | null;
  producerName: string | null;
  attribution: "producer" | "own" | "unknown";
  quantity: number;
  lineTotal: number;
  lineTotalHt: number | null;
  vatRate: number;
  unitWeightGrams?: number | null;
};

export type ProducerSettlementSources = {
  sales: ProducerSaleSource[];
  producers: Array<{ id: string; name: string }>;
  rates: ProducerRate[];
  payments: ProducerPayment[];
};
