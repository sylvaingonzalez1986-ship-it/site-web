import Link from "next/link";
import { ResetPasswordForm } from "@/components/account/ResetPasswordForm";
import { sanitizeNextPath } from "@/lib/safe-next-path";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextUrl = sanitizeNextPath(params.next, "/profil");
  const loginHref = `/compte/connexion?next=${encodeURIComponent(nextUrl)}`;

  return (
    <section className="section-band bg-yellow halftone-overlay paper-grain pt-36">
      <div className="retro-container max-w-xl">
        <div className="cartoon-border bg-cream p-8">
          <h1 className="section-title">NOUVEAU MOT DE PASSE</h1>
          <p className="mt-3 text-charcoal">
            Definis un nouveau mot de passe pour retrouver l&apos;acces a ton espace client.
          </p>
          <p className="mt-2 text-sm text-charcoal">
            Le lien recu par email est temporaire et ne peut etre utilise qu&apos;une seule fois.
          </p>

          <ResetPasswordForm nextUrl={nextUrl} />

          <p className="mt-4 text-sm text-charcoal">
            Retour a la{" "}
            <Link href={loginHref} className="font-semibold text-ink underline">
              connexion
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
