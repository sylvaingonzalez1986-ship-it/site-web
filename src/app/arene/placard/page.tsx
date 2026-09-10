import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PlacardPlayerShell } from "@/components/placard/PlacardPlayerShell";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerRequestEnabled } from "@/lib/kanab-quest-player-request-access";

export const metadata: Metadata = {
  title: "Le Placard — Kanab Quest",
  robots: { index: false, follow: false },
};

export default async function PlacardPlayerPage() {
  if (!await isKqPlayerRequestEnabled()) notFound();
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) redirect("/compte/connexion?next=%2Farene%2Fplacard");
  return <PlacardPlayerShell />;
}
