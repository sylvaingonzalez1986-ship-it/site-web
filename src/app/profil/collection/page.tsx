import type { Metadata } from "next";
import { CollectionAlbumClient } from "@/components/account/CollectionAlbumClient";

export const metadata: Metadata = {
  title: "Mon album — Kanab Quest",
  description:
    "Album de collection Kanab Quest — complète tes pages, recycle tes doublons et débloque des récompenses.",
};

export default async function CollectionPage() {
  return <CollectionAlbumClient />;
}
