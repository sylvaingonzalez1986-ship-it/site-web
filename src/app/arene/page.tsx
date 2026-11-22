import type { Metadata } from "next";
import { ContestArenaPage, type ContestArenaPageProps } from "@/components/contest/ContestArenaPage";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "L’Arène – Kanab Quest et carnet de dégustation",
  description:
    "Entre dans le Quartier de Kanab Quest, retrouve tes dégustations dans le Carnet et consulte les classements de la communauté.",
  alternates: { canonical: "/arene" },
  robots: { index: false, follow: false },
};

export default function ArenaPage({ searchParams }: Pick<ContestArenaPageProps, "searchParams">) {
  return <ContestArenaPage searchParams={searchParams} />;
}
