import { AdminLoginForm } from "@/components/admin/AdminLoginForm";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextUrl = params.next || "/admin";

  return (
    <section className="section-band bg-yellow halftone-overlay paper-grain pt-36">
      <div className="retro-container max-w-xl">
        <div className="cartoon-border bg-cream p-8">
          <h1 className="section-title">ADMIN LOGIN</h1>
          <p className="mt-3 text-charcoal">
            Entre le mot de passe admin pour acceder a la gestion du site.
          </p>

          <AdminLoginForm nextUrl={nextUrl} />
        </div>
      </div>
    </section>
  );
}
