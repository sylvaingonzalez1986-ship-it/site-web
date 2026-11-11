import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Confirmer mon inscription à la newsletter",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";

export default async function NewsletterConfirmationPage({ searchParams }: {
  searchParams: Promise<{ token?: string; done?: string; error?: string }>;
}) {
  const params = await searchParams;
  const valid = typeof params.token === "string" && /^[a-f0-9]{64}$/.test(params.token);
  return <main className="mx-auto max-w-xl px-5 py-20">
    <div className="cartoon-border bg-cream p-6 md:p-8">
      <h1 className="font-display text-4xl">{params.done === "1" ? "Inscription confirmée" : "Confirmer mon inscription"}</h1>
      {params.done === "1" ? <p className="mt-5">Tu recevras nos actualités et offres. Chaque e-mail permet de te désinscrire.</p>
        : params.error || !valid ? <p className="mt-5" role="alert">Ce lien est expiré, déjà utilisé ou indisponible. Demande un nouveau lien d’inscription.</p>
        : <>
          <p className="mt-5">Confirme pour recevoir les actualités et offres des Chanvriers Bretons.</p>
          <form action="/api/newsletter/confirm" method="post" className="mt-6">
            <input type="hidden" name="token" value={params.token} />
            <button className="btn-cartoon btn-primary" type="submit">Confirmer mon inscription</button>
          </form>
        </>}
      <Link href="/" className="mt-6 inline-block underline">Retour à l’accueil</Link>
    </div>
  </main>;
}
