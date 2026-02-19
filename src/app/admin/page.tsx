import type { Metadata } from "next";
import { AdminPanel } from "@/components/admin/AdminPanel";

export const metadata: Metadata = {
  title: "Admin",
  description: "Edition des textes et des produits de la boutique.",
};

export default function AdminPage() {
  return <AdminPanel />;
}
