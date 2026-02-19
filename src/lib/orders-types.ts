import type { VatRate } from "@/data/products";
import type { CmsOrder, OrderStatus } from "@/types/store";

export type AppendOrderInput = {
  items: Array<{
    productId: string;
    name: string;
    unitPrice: number;
    quantity: number;
    lineTotal?: number;
    vatRate?: VatRate;
    unitPriceHt?: number;
    lineTotalHt?: number;
    lineVatAmount?: number;
    parentPackId?: string;
    parentPackName?: string;
  }>;
  totalAmount: number;
  itemsCount: number;
  totalHt?: number;
  totalVat?: number;
  vatBreakdown?: CmsOrder["vatBreakdown"];
  paymentState: CmsOrder["paymentState"];
  status?: OrderStatus;
  customer?: {
    id?: string;
    email?: string;
    name?: string;
  } | null;
  shipping?: {
    address: string;
    city: string;
    postalCode: string;
    country: string;
    phone: string;
  };
  promo?: {
    code: string;
    discountPercent: number;
    discountAmount: number;
  } | null;
  viva?: {
    orderCode: number;
    transactionId?: string;
  } | null;
};
