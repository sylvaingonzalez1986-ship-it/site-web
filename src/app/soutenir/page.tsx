import type { Metadata } from "next";
import { KqFinancialSupport } from "@/components/placard/KqFinancialSupport";
export const metadata: Metadata = { title: "Soutenir les producteurs | Les Chanvriers Bretons", description: "La cagnotte de soutien aux producteurs : contributions confirmées et montant collecté." };
export default function SupportPage() {
  return <main className="mx-auto w-full max-w-4xl px-3 py-8 sm:px-6"><KqFinancialSupport standalone /></main>;
}
