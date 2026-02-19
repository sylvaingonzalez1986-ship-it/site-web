import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/site-url";

const BASE_URL = getSiteUrl();

export const metadata: Metadata = {
  title: "Blog CBD - Guides, Actualites & Conseils",
  description:
    "Guides CBD bio, actualites legislation et conseils bien-etre. Le blog des Chanvriers Bretons.",
  alternates: {
    canonical: `${BASE_URL}/blog`,
  },
};

export default function BlogLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
