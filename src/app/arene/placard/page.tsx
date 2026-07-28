import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PlacardPlayerShell } from "@/components/placard/PlacardPlayerShell";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerApiEnabled } from "@/lib/kanab-quest-player-access";

export const metadata: Metadata = {
  title: "Le Placard — Kanab Quest",
  robots: { index: false, follow: false },
};

export default async function PlacardPlayerPage() {
  if (!isKqPlayerApiEnabled()) notFound();
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) redirect("/compte/connexion?next=%2Farene%2Fplacard");
  return <PlacardPlayerShell />;
}
