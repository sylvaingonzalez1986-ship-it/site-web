import { CONTEST_SCHEMA_MISSING_MESSAGE } from "@/lib/contest-backend";

type ContestSchemaUnavailableProps = {
  compact?: boolean;
};

export function ContestSchemaUnavailable({ compact = false }: ContestSchemaUnavailableProps) {
  return (
    <section className={`section-band bg-cream paper-grain ${compact ? "pt-28" : "pt-36"}`}>
      <div className="retro-container max-w-4xl">
        <div className="cartoon-border bg-white p-8">
          <h1 className="section-title">{compact ? "MODULE INDISPONIBLE" : "BETE DE CONCOURS INDISPONIBLE"}</h1>
          <p className="mt-4 text-charcoal">{CONTEST_SCHEMA_MISSING_MESSAGE}</p>
          <p className="mt-3 text-sm text-charcoal">
            La base Supabase actuellement ciblée par ton environnement local ne contient pas encore les tables
            `contest_*`. Tant que la migration `20260421000100_bete_de_concours.sql` n&apos;est pas appliquée sur ce
            projet, le module ne peut pas fonctionner sur cette base.
          </p>
        </div>
      </div>
    </section>
  );
}
