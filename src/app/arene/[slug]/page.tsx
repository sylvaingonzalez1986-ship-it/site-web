import { ContestArenaDetailPage, generateMetadata as buildMetadata } from "@/app/bete-de-concours/[slug]/page";

export const revalidate = 60;

type ArenaDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata(props: ArenaDetailPageProps) {
  return buildMetadata(props);
}

export default ContestArenaDetailPage;
