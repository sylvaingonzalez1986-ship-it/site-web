import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { ContestDetailClient } from "@/components/contest/ContestDetailClient";
import { ContestSchemaUnavailable } from "@/components/contest/ContestSchemaUnavailable";
import { readPublicStoreByBackend } from "@/lib/data-backend";
import {
  canCustomerAccessContestFeatureServer,
  isContestBetaAccessRestrictedServer,
  isContestFeatureEnabledServer,
} from "@/lib/contest-feature";
import { isCurrentRequestAdminAuthorized } from "@/lib/admin-guard";
import { getContestEntryDetailBySlug, isContestSchemaMissingError } from "@/lib/contest-backend";
import { sanitizePublicContestEntryDetail } from "@/lib/contest-public-api";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import type { PublicCustomer } from "@/types/customer";

export const revalidate = 60;

type ContestDetailPageProps = {
  params: Promise<{ slug: string }>;
};

async function getOptionalContestSession(): Promise<{
  customerId: string;
  customer: PublicCustomer;
} | null> {
  try {
    return await getCurrentCustomerSessionByBackend();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("[supabase:auth.getUser]")) {
      return null;
    }
    throw error;
  }
}

export async function generateMetadata({
  params,
}: ContestDetailPageProps): Promise<Metadata> {
  if (!isContestFeatureEnabledServer() || isContestBetaAccessRestrictedServer()) {
    return {
      title: "L'Arène",
      robots: { index: false, follow: false },
    };
  }

  const { slug } = await params;
  let detail = null;
  try {
    detail = await getContestEntryDetailBySlug(slug);
  } catch (error) {
    if (isContestSchemaMissingError(error)) {
      return {
        title: "L'Arène indisponible",
        robots: { index: false, follow: false },
      };
    }
    throw error;
  }
  if (!detail) {
    return {
      title: "Lot premium introuvable",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: `${detail.entry.title} - L'Arène`,
    description:
      detail.entry.story.trim().slice(0, 150) ||
      "Fiche lot premium avec classement saisonnier, carnet de dégustation et critiques clients.",
    alternates: {
      canonical: `/arene/${detail.entry.slug}`,
    },
    robots: {
      index: false,
      follow: false,
    },
  };
}

export async function ContestArenaDetailPage({ params }: ContestDetailPageProps) {
  const { slug } = await params;
  let detail = null;
  let session: Awaited<ReturnType<typeof getOptionalContestSession>> = null;
  try {
    session = await getOptionalContestSession();
    const adminAuthorized = await isCurrentRequestAdminAuthorized();
    if (!canCustomerAccessContestFeatureServer(session?.customer ?? null, { adminAuthorized })) {
      if (isContestFeatureEnabledServer() && isContestBetaAccessRestrictedServer() && !session && !adminAuthorized) {
        redirect(`/compte/connexion?next=${encodeURIComponent(`/arene/${slug}`)}`);
      }
      notFound();
    }

    detail = await getContestEntryDetailBySlug(slug, session?.customerId, session?.customer.email);
  } catch (error) {
    if (isContestSchemaMissingError(error)) {
      return <ContestSchemaUnavailable compact />;
    }
    throw error;
  }

  if (!detail) {
    notFound();
  }

  const store = await readPublicStoreByBackend();
  const product = store.products.find((item) => item.id === detail.entry.productId) ?? null;
  const loginHref = `/compte/connexion?next=${encodeURIComponent(`/arene/${detail.entry.slug}`)}`;

  return (
    <ContestDetailClient
      detail={sanitizePublicContestEntryDetail(detail)}
      product={product}
      lowStockThresholdGrams={store.content.boutique.lowStockThresholdGrams}
      loginHref={loginHref}
      isAuthenticated={Boolean(session?.customerId)}
    />
  );
}

export default async function LegacyContestDetailPage({ params }: ContestDetailPageProps) {
  const { slug } = await params;
  permanentRedirect(`/arene/${encodeURIComponent(slug)}`);
}
