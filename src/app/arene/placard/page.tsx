import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PlacardPlayerShell } from "@/components/placard/PlacardPlayerShell";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isContestFeatureEnabledServer } from "@/lib/contest-feature";
import { isKqPlayerApiEnabled } from "@/lib/kanab-quest-player-access";
import { isKqPlayerRequestEnabled } from "@/lib/kanab-quest-player-request-access";

export const metadata: Metadata = {
  title: "Le Placard — Kanab Quest",
  robots: { index: false, follow: false },
};

export default async function PlacardPlayerPage() {
  if (!isKqPlayerApiEnabled() && !isContestFeatureEnabledServer()) notFound();
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) redirect("/compte/connexion?next=%2Farene%2Fplacard");
  if (!await isKqPlayerRequestEnabled()) notFound();
  return <PlacardPlayerShell />;
}
