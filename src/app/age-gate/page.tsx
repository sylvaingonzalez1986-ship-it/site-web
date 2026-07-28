import type { Metadata } from "next";
import { AgeGatePageClient } from "@/components/AgeGatePageClient";

export const metadata: Metadata = {
  title: "Vérification d'âge",
  robots: {
    index: false,
    follow: false,
  },
};

type AgeGatePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AgeGatePage({ searchParams }: AgeGatePageProps) {
  const resolvedSearchParams = await searchParams;
  const nextParam = resolvedSearchParams?.next;
  const nextPathParam = Array.isArray(nextParam) ? nextParam[0] : nextParam ?? null;
  return <AgeGatePageClient nextPathParam={nextPathParam} />;
}
