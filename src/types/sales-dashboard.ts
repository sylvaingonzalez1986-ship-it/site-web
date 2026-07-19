export type AdminSalesDashboardPaymentState = "paid" | "not_configured";

export type AdminSalesProductSummary = {
  productId: string;
  productName: string;
  category: string | null;
  isCurrentProduct: boolean;
  quantitySold: number;
  ordersCount: number;
  revenueTtc: number;
  revenueHt: number;
  vatAmount: number;
  firstSoldAt: string | null;
  lastSoldAt: string | null;
};

export type AdminSalesPeriodSummary = {
  periodKey: string;
  periodLabel: string;
  startsAt: string;
  endsAt: string;
  ordersCount: number;
  quantitySold: number;
  revenueTtc: number;
  revenueHt: number;
  vatAmount: number;
  products: AdminSalesProductSummary[];
};

export type AdminProductSalesDashboard = {
  generatedAt: string;
  timezone: "Europe/Paris";
  includedPaymentStates: AdminSalesDashboardPaymentState[];
  allTime: AdminSalesPeriodSummary;
  byWeek: AdminSalesPeriodSummary[];
  byMonth: AdminSalesPeriodSummary[];
};
