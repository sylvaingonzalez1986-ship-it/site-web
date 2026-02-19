import Link from "next/link";
import { AccountRegisterForm } from "@/components/account/AccountRegisterForm";

export default async function AccountRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextUrl = params.next || "/profil";

  return (
    <section className="section-band bg-mint halftone-overlay paper-grain pt-36">
      <div className="retro-container max-w-xl">
        <div className="cartoon-border bg-cream p-8">
          <h1 className="section-title">CREER UN COMPTE</h1>
          <p className="mt-3 text-charcoal">
            Cree ton espace client pour suivre tes informations et tes commandes.
          </p>
          <p className="mt-2 text-sm text-charcoal">
            Ce site est reserve aux personnes majeures (18 ans et plus). En creant un compte,
            vous certifiez avoir l&apos;age legal requis.
          </p>

          <AccountRegisterForm nextUrl={nextUrl} />

          <p className="mt-4 text-sm text-charcoal">
            Deja inscrit ?{" "}
            <Link href={`/compte/connexion?next=${encodeURIComponent(nextUrl)}`} className="font-semibold text-ink underline">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
