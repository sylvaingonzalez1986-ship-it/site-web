import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { sanitizeAdminNextPath } from "@/lib/safe-next-path";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isAllowedAdminEmail } from "@/lib/admin-allowlist";

import Link from "next/link";
import styles from "@/components/admin/AdminLogin.module.css";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const nextUrl = sanitizeAdminNextPath(params.next);
  const adminLoginHref = `/admin/login?next=${encodeURIComponent(nextUrl)}`;
  const accountLoginHref = `/compte/connexion?next=${encodeURIComponent(adminLoginHref)}`;
  const { session, accountUnavailable } = await getCurrentCustomerSessionByBackend("identity")
    .then((session) => ({ session, accountUnavailable: false }))
    .catch(() => ({ session: null, accountUnavailable: true }));
  const accountAllowed = Boolean(session && isAllowedAdminEmail(session.customer.email));

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
            {accountUnavailable ? (
              <>
                <h2>Connexion indisponible</h2>
                <p className={styles.description} role="alert">
                  Impossible de vérifier ta connexion au compte pour le moment. Ta session n’a pas été
                  modifiée. Réessaie dans un instant.
                </p>
                <div className={styles.form}>
                  <a href={adminLoginHref} className={styles.submitButton}>
                    <span>Réessayer</span><span aria-hidden="true">→</span>
                  </a>
                </div>
              </>
            ) : !session ? (
              <>
                <h2>Connecte ton compte</h2>
                <p className={styles.description}>
                  Utilise l’adresse e-mail et le mot de passe de ton compte. Tu reviendras ensuite ici
                  pour valider l’accès administrateur.
                </p>
                <div className={styles.form}>
                  <Link href={accountLoginHref} className={styles.submitButton}>
                    <span>Se connecter au compte</span><span aria-hidden="true">→</span>
                  </Link>
                </div>
              </>
            ) : !accountAllowed ? (
              <>
                <h2>Accès réservé</h2>
                <p className={styles.description}>
                  Ce compte n’est pas autorisé à ouvrir l’administration. Ta connexion au site reste active.
                </p>
                <div className={styles.form}>
                  <Link href={accountLoginHref} className={styles.submitButton}>
                    <span>Utiliser un autre compte</span><span aria-hidden="true">→</span>
                  </Link>
                  <Link href="/profil">Voir mon compte</Link>
                </div>
              </>
            ) : (
              <>
                <h2>Valider l’accès admin</h2>
                <p className={styles.description}>
                  Ton compte est connecté. Entre maintenant le mot de passe administrateur du site,
                  distinct du mot de passe de ton compte.
                </p>
                <AdminLoginForm nextUrl={nextUrl} />
                <p className={styles.description}>
                  Mot de passe administrateur oublié ? Il doit être réinitialisé dans la configuration
                  sécurisée du site. Changer le mot de passe de ton compte ne le modifie pas.
                </p>
              </>
            )}
          </div>
        </div>
        <p className={styles.footer}>Accès réservé à l’administration</p>
      </div>
    </section>
  );
}
