import {
  ArenaTesterProfilePage,
  generateMetadata as buildMetadata,
} from "@/app/bete-de-concours/profils/[pseudo]/page";

export const revalidate = 60;

type ArenaTesterProfilePageProps = {
  params: Promise<{ pseudo: string }>;
  searchParams: Promise<{ season?: string; track?: string }>;
};

export async function generateMetadata(props: ArenaTesterProfilePageProps) {
  return buildMetadata(props);
}

export default ArenaTesterProfilePage;
