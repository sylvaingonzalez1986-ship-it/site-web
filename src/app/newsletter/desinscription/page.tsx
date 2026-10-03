import type { Metadata } from "next";
import Link from "next/link";
import { readMailingUnsubscribeToken } from "@/lib/mailing-unsubscribe";

export const metadata: Metadata = {
  title: "Désinscription des e-mails | Les Chanvriers Bretons",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string; done?: string; error?: string }> }) {
  const params = await searchParams;
  let valid = false;
  let unavailable = false;
  try { valid = Boolean(readMailingUnsubscribeToken(params.token)); }
  catch { unavailable = true; }
  const done = params.done === "1";

  return (
    <main className="mx-auto max-w-xl px-5 py-20">
      <div className="cartoon-border bg-cream p-6 md:p-8">
        <p className="text-sm font-bold text-charcoal">Les Chanvriers Bretons</p>
        <h1 className="mt-3 font-display text-4xl">{done ? "Désinscription confirmée" : "Gérer mes e-mails"}</h1>
        {done ? <p className="mt-5">Tu ne recevras plus nos envois groupés. Les e-mails nécessaires au suivi de tes commandes et de ton compte restent actifs.</p>
          : unavailable || params.error ? <p className="mt-5" role="alert">La désinscription est momentanément indisponible. Réessaie depuis le lien de ton e-mail dans quelques instants.</p>
          : valid ? <>
            <p className="mt-5">Confirme pour ne plus recevoir nos actualités et nos envois groupés. Cette action ne change pas le suivi de tes commandes.</p>
            <form action="/api/newsletter/unsubscribe" method="post" className="mt-6">
              <input type="hidden" name="token" value={params.token} />
              <button className="btn-cartoon btn-primary" type="submit">Confirmer ma désinscription</button>
            </form>
          </> : <p className="mt-5" role="alert">Ce lien est invalide. Utilise le lien de désinscription présent dans l’un de nos e-mails.</p>}
        <Link className="mt-6 inline-block underline" href="/">Retour à l’accueil</Link>
      </div>
    </main>
  );
}
