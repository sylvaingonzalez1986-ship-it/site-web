import type { Metadata } from "next";
import { SupportPaymentReturn } from "@/components/placard/SupportPaymentReturn";
export const metadata: Metadata = { title: "Suivi de ton soutien", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function SupportReturnPage({ searchParams }: { searchParams: Promise<{ t?: string | string[]; s?: string | string[]; support?: string | string[] }> }) {
  const { t, s, support } = await searchParams;
  return <main className="mx-auto w-full max-w-3xl px-3 py-8 sm:px-6"><SupportPaymentReturn key={JSON.stringify([support, t, s])} supportId={support} transactionId={t} orderCode={s} /></main>;
}
