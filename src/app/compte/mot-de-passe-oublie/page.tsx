import Link from "next/link";
import { PasswordResetRequestForm } from "@/components/account/PasswordResetRequestForm";
import { sanitizeNextPath } from "@/lib/safe-next-path";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextUrl = sanitizeNextPath(params.next, "/profil");
  const loginHref = `/compte/connexion?next=${encodeURIComponent(nextUrl)}`;

  return (
    <section className="section-band bg-mint halftone-overlay paper-grain pt-36">
      <div className="retro-container max-w-xl">
        <div className="cartoon-border bg-cream p-8">
          <h1 className="section-title">MOT DE PASSE OUBLIE</h1>
          <p className="mt-3 text-charcoal">
            Saisis ton email et on t&apos;enverra un lien pour definir un nouveau mot de passe.
          </p>

          <PasswordResetRequestForm nextUrl={nextUrl} />

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
