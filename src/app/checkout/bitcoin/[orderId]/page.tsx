import type { Metadata } from "next";
import { BitcoinPaymentPage } from "@/components/checkout/BitcoinPaymentPage";

export const metadata: Metadata = {
  title: "Paiement Bitcoin (Lightning)",
  robots: { index: false, follow: false },
};

export default async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <BitcoinPaymentPage key={orderId} orderId={orderId} />;
}
