import Link from "next/link";
import { AccountLoginForm } from "@/components/account/AccountLoginForm";

export default async function AccountLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; ref?: string }>;
}) {
  const params = await searchParams;
  const nextUrl = params.next || "/profil";
  const referralCode = params.ref || "";
  const registerHref = `/compte/inscription?next=${encodeURIComponent(nextUrl)}${referralCode ? `&ref=${encodeURIComponent(referralCode)}` : ""}`;

  return (
    <section className="section-band bg-yellow halftone-overlay paper-grain pt-36">
      <div className="retro-container max-w-xl">
        <div className="cartoon-border bg-cream p-8">
          <h1 className="section-title">CONNEXION</h1>
          <p className="mt-3 text-charcoal">
            Connecte-toi pour acceder a ton profil, ton historique et tes futures commandes.
          </p>

          <AccountLoginForm nextUrl={nextUrl} />

          <p className="mt-4 text-sm text-charcoal">
            Pas de compte ?{" "}
            <Link href={registerHref} className="font-semibold text-ink underline">
              Creer un compte
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
