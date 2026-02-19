import type { Metadata } from "next";
import { AgeGatePageClient } from "@/components/AgeGatePageClient";

export const metadata: Metadata = {
  title: "Verification d'age",
  robots: {
    index: false,
    follow: false,
  },
};

type AgeGatePageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function AgeGatePage({ searchParams }: AgeGatePageProps) {
  const nextParam = searchParams?.next;
  const nextPathParam = Array.isArray(nextParam) ? nextParam[0] : nextParam ?? null;
  return <AgeGatePageClient nextPathParam={nextPathParam} />;
}
