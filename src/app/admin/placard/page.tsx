import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KanabQuestDicePrototype } from "@/components/placard/KanabQuestDicePrototype";
import { isCurrentRequestAdminAuthorized } from "@/lib/admin-guard";

export const metadata: Metadata = {
  title: "Placard — Kanab Quest",
  robots: { index: false, follow: false },
};

export default async function AdminPlacardPage() {
  const isAuthorized = await isCurrentRequestAdminAuthorized();
  if (!isAuthorized) {
    redirect("/admin/login?next=%2Fadmin%2Fplacard");
  }
  return <KanabQuestDicePrototype showAdminOperations={false} showPackLab />;
}
