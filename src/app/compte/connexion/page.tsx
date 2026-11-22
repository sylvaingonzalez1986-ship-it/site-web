import Link from "@/components/navigation/NavigationLink";
import { AccountLoginForm } from "@/components/account/AccountLoginForm";
import { sanitizeNextPath } from "@/lib/safe-next-path";
import { isKqPlayerApiEnabled } from "@/lib/kanab-quest-player-access";

export default async function AccountLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; ref?: string; verified?: string; passwordReset?: string }>;
}) {
  const params = await searchParams;
  const nextUrl = sanitizeNextPath(params.next, "/profil");
  const enteringGame = nextUrl.split(/[?#]/)[0] === "/arene/placard";
  const referralCode = params.ref || "";
  const isVerified = params.verified === "true";
  const passwordReset = params.passwordReset === "true";
  const registerHref = `/compte/inscription?next=${encodeURIComponent(nextUrl)}${referralCode ? `&ref=${encodeURIComponent(referralCode)}` : ""}`;
  const forgotPasswordHref = `/compte/mot-de-passe-oublie?next=${encodeURIComponent(nextUrl)}`;

  return (
    <section className="section-band account-page bg-yellow halftone-overlay paper-grain pt-36">
      <div className="retro-container max-w-xl">
        <div className="cartoon-border bg-cream p-8">
          <h1 className="section-title">CONNEXION</h1>
          <p className="mt-3 text-charcoal">
            {enteringGame
              ? isKqPlayerApiEnabled() ? "Connecte-toi pour retrouver ton personnage et ta progression dans le Quartier." : "Connecte-toi avec ton compte de test pour entrer dans le Quartier."
              : "Connecte-toi pour accéder à ton profil, ton historique et tes commandes."}
          </p>
          {isVerified && (
            <p className="mt-3 rounded-md border border-[#1a1a1a] bg-mint/30 px-3 py-2 text-sm font-semibold text-charcoal">
              Compte verifie. Tu peux maintenant te connecter.
            </p>
          )}
          {passwordReset && (
            <p className="mt-3 rounded-md border border-[#1a1a1a] bg-mint/30 px-3 py-2 text-sm font-semibold text-charcoal">
              Mot de passe mis a jour. Tu peux maintenant te connecter.
            </p>
          )}

          <AccountLoginForm nextUrl={nextUrl} />

          <p className="mt-3 text-sm text-charcoal">
            <Link href={forgotPasswordHref} className="font-semibold text-ink underline">
              Mot de passe oublie ?
            </Link>
          </p>

          <p className="mt-4 text-sm text-charcoal">
            Pas de compte ?{" "}
            <Link href={registerHref} className="font-semibold text-ink underline">
              Créer un compte gratuit
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
