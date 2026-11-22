import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getValidatedAdminContext } from "@/lib/admin-guard";
import { ArenaCharacterPreview } from "@/components/contest/ArenaCharacterPreview";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Tester la création du personnage",
  robots: { index: false, follow: false },
};

export default async function CharacterPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const admin = await getValidatedAdminContext();
  if (!admin) redirect("/admin");
  return <ArenaCharacterPreview ownerId={admin.customerId} />;
}
