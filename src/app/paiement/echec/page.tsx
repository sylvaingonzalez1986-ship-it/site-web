import type { Metadata } from "next";
import { VivaPaymentReturnPage } from "@/components/checkout/VivaPaymentReturnPage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Paiement non valide",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PaymentFailurePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <VivaPaymentReturnPage kind="failure" searchParams={await searchParams} />;
}
