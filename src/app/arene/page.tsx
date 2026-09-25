import type { Metadata } from "next";
import { ContestArenaPage, type ContestArenaPageProps } from "@/components/contest/ContestArenaPage";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "L'Arène - concours et dégustation CBD",
  description:
    "L'Arène réunit les lots CBD de saison, les carnets de dégustation, les avis vérifiés et le classement de la communauté.",
  alternates: { canonical: "/arene" },
  robots: { index: false, follow: false },
};

export default function ArenaPage({ searchParams }: Pick<ContestArenaPageProps, "searchParams">) {
  return <ContestArenaPage searchParams={searchParams} />;
}
