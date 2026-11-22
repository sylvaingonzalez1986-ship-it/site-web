import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import type { ContestArenaPageProps } from "@/components/contest/ContestArenaPage";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "L’Arène – Kanab Quest et carnet de dégustation",
  description:
    "Entre dans le Quartier de Kanab Quest, retrouve tes dégustations dans le Carnet et consulte les classements de la communauté.",
  alternates: {
    canonical: "/arene",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default async function LegacyContestHubPage({ searchParams }: Pick<ContestArenaPageProps, "searchParams">) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.season) query.set("season", params.season);
  if (params.category) query.set("category", params.category);
  if (params.track) query.set("track", params.track);
  if (params.vue) query.set("vue", params.vue);
  permanentRedirect(`/arene${query.size ? `?${query.toString()}` : ""}`);
}
