import { isArenaPrelaunch } from "@/lib/arena-opening";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ArenaGameEntry } from "@/components/contest/ArenaGameEntry";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isContestFeatureEnabledServer } from "@/lib/contest-feature";
import { isKqPlayerApiEnabled } from "@/lib/kanab-quest-player-access";
import { isKqPlayerRequestEnabled } from "@/lib/kanab-quest-player-request-access";
import { sanitizeNextPath } from "@/lib/safe-next-path";
import { getArenaBetaConnectionKey } from "@/lib/supabase/arena-beta-connection";
import { normalizeKqVillageLocation } from "@/lib/kanab-quest-world-mode";

export const metadata: Metadata = {
  title: "Kanab Quest",
  robots: { index: false, follow: false },
};

export default async function PlacardPlayerPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (isArenaPrelaunch() && !await isKqPlayerRequestEnabled()) redirect("/arene?mode=jouer&ouverture=1");
  if (!isKqPlayerApiEnabled() && !isContestFeatureEnabledServer()) notFound();
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(await searchParams)) {
      if (typeof value === "string") query.append(key, value);
      else if (Array.isArray(value)) for (const entry of value) query.append(key, entry);
    }
    const search = normalizeKqVillageLocation(query.size ? `?${query}` : "");
    const nextPath = sanitizeNextPath(`/arene/placard${search}`, "/arene/placard");
    redirect(`/compte/connexion?next=${encodeURIComponent(nextPath)}`);
  }
  if (!await isKqPlayerRequestEnabled()) notFound();
  const betaConnectionKey = await getArenaBetaConnectionKey(session.customerId);
  return <ArenaGameEntry key={session.customerId} userId={session.customerId} betaConnectionKey={betaConnectionKey} />;
}
