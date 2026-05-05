import type { Metadata } from "next";
import { VivaPaymentReturnPage } from "@/components/checkout/VivaPaymentReturnPage";

export const metadata: Metadata = {
  title: "Paiement valide",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <VivaPaymentReturnPage kind="success" searchParams={await searchParams} />;
}
