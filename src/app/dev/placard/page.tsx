import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Prototype local — Kanab Quest : La Botte du Chanvrier",
  robots: { index: false, follow: false },
};

export default function LocalPlacardPrototypePage() {
  redirect("/admin/placard");
}
