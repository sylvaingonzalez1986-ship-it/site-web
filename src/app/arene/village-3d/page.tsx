import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Le Quartier en 3D — prototype",
  robots: { index: false, follow: false },
};

/** The development shortcut enters through the game's authentication and onboarding. */
export default async function VillagePrototypePage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") query.append(key, value);
    else if (Array.isArray(value)) for (const entry of value) query.append(key, entry);
  }
  query.set("world", "3d");
  redirect(`/arene/placard?${query.toString()}`);
}
