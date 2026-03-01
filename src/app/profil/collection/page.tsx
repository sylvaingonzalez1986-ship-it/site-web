import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CollectionAlbumClient } from "@/components/account/CollectionAlbumClient";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";

export const metadata: Metadata = {
  title: "Mon album — Hemp Heroes 2026",
  description:
    "Album de collection Hemp Heroes 2026 — complète tes pages, burn tes doublons et débloque des lots.",
};

export default async function CollectionPage() {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    redirect("/compte/connexion");
  }

  return <CollectionAlbumClient />;
}
