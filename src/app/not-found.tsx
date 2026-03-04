import Link from "next/link";

export default function RootNotFound() {
  return (
    <div className="section-band bg-mint paper-grain py-10 md:py-16">
      <div className="retro-container">
        <div className="cartoon-panel mx-auto max-w-3xl bg-cream p-6 text-center md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-charcoal">
            404
          </p>
          <h1 className="mt-3 font-display text-4xl leading-none text-ink md:text-5xl">
            Cette page est introuvable
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-charcoal md:text-base">
            Le contenu demande n&apos;est plus disponible ou l&apos;adresse est incomplete.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/" className="btn-cartoon">
              Retour a l&apos;accueil
            </Link>
            <Link href="/boutique" className="btn-cartoon btn-secondary">
              Aller a la boutique
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
