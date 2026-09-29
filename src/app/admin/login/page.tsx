import { AdminLoginForm } from "@/components/admin/AdminLoginForm";

import Link from "next/link";
import styles from "@/components/admin/AdminLogin.module.css";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextUrl = params.next || "/admin";

  return (
    <section className={styles.page} aria-labelledby="admin-login-title">
      <div className={styles.container}>
        <Link href="/" className={styles.backLink}>
          <span aria-hidden="true">←</span> Retour au site
        </Link>
        <div className={styles.panel}>
          <header className={styles.header}>
            <p className={styles.eyebrow}>Les Chanvriers Bretons</p>
            <h1 id="admin-login-title">Espace admin</h1>
            <p className={styles.intro}>Les commandes du site, à portée de main.</p>
          </header>
          <div className={styles.content}>
            <h2>Connexion</h2>
            <p className={styles.description}>
              Entre ton mot de passe pour accéder à la gestion du site.
            </p>
            <AdminLoginForm nextUrl={nextUrl} />
          </div>
        </div>
        <p className={styles.footer}>Accès réservé à l’administration</p>
      </div>
    </section>
  );
}
