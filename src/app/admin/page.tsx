import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { isCurrentRequestAdminAuthorized } from "@/lib/admin-guard";

export const metadata: Metadata = {
  title: "Admin",
  description: "Edition des textes et des produits de la boutique.",
};

export default async function AdminPage() {
  const isAuthorized = await isCurrentRequestAdminAuthorized();
  if (!isAuthorized) {
    redirect("/admin/login?next=%2Fadmin");
  }

  return <AdminPanel />;
}
