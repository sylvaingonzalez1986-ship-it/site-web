import Link from "@/components/navigation/NavigationLink";
import { AccountRegisterForm } from "@/components/account/AccountRegisterForm";
import { sanitizeNextPath } from "@/lib/safe-next-path";
import { isKqPlayerApiEnabled } from "@/lib/kanab-quest-player-access";

export default async function AccountRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; ref?: string }>;
}) {
  const params = await searchParams;
  const nextUrl = sanitizeNextPath(params.next, "/profil");
  const enteringGame = nextUrl.split(/[?#]/)[0] === "/arene/placard";
  const initialReferralCode = params.ref || "";
  const loginHref = `/compte/connexion?next=${encodeURIComponent(nextUrl)}${initialReferralCode ? `&ref=${encodeURIComponent(initialReferralCode)}` : ""}`;

  return (
    <section className="section-band account-page bg-mint halftone-overlay paper-grain pt-36">
      <div className="retro-container max-w-xl">
        <div className="cartoon-border bg-cream p-8">
          <h1 className="section-title">Créer un compte</h1>
          <p className="mt-3 text-charcoal">
            {enteringGame
              ? isKqPlayerApiEnabled() ? "Ce compte gratuit te permet de sauvegarder ton personnage et ta progression dans le Quartier." : "Le Quartier est en test privé. Tu peux déjà consulter le Carnet et les classements dans l’Arène."
              : "Crée ton espace client pour suivre tes informations et tes commandes."}
          </p>
          <p className="mt-2 text-sm text-charcoal">
            Ce site est réservé aux personnes majeures (18 ans et plus). En créant un compte,
            tu certifies avoir l’âge légal requis.
          </p>

          <AccountRegisterForm nextUrl={nextUrl} initialReferralCode={initialReferralCode} />

          <p className="mt-4 text-sm text-charcoal">
            Deja inscrit ?{" "}
            <Link href={loginHref} className="font-semibold text-ink underline">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
