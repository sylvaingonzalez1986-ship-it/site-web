"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "@/components/navigation/NavigationFeedback";
import { sanitizeAdminNextPath } from "@/lib/safe-next-path";
import styles from "./AdminLogin.module.css";

type AdminLoginFormProps = {
  nextUrl: string;
};

export function AdminLoginForm({ nextUrl }: AdminLoginFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [totp, setTotp] = useState("");
  const [requireTotp, setRequireTotp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountLoginRequired, setAccountLoginRequired] = useState(false);
  const safeNextUrl = sanitizeAdminNextPath(nextUrl);
  const accountLoginHref = `/compte/connexion?next=${encodeURIComponent(`/admin/login?next=${encodeURIComponent(safeNextUrl)}`)}`;

  const httpError = (status: number) => {
    if (status === 401) return requireTotp
      ? "Le code est incorrect ou expiré. Essaie le code actuel de ton application, ou reviens au mot de passe."
      : "Mot de passe administrateur incorrect. Il est distinct du mot de passe de ton compte.";
    if (status === 403) return "Ton compte n’est plus connecté ou n’a pas accès à l’administration. Reconnecte-toi avec le compte autorisé.";
    if (status === 429) return "Trop de tentatives. Patiente quelques minutes avant de réessayer.";
    if (status >= 500) return "Connexion administrateur momentanément indisponible. Réessaie plus tard. Si cela persiste, fais vérifier la configuration du site.";
    return "La demande de connexion n’a pas pu être traitée. Recharge la page puis réessaie.";
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setAccountLoginRequired(false);
    setLoading(true);

    try {
      const body: Record<string, string> = { password };
      if (requireTotp) {
        body.totp = totp;
      }

      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const responseText = await response.text();
      let data: unknown;
      try {
        data = JSON.parse(responseText);
      } catch {
        setAccountLoginRequired(response.status === 403);
        setError(response.ok
          ? "Réponse inattendue du serveur. Recharge la page puis réessaie."
          : httpError(response.status));
        return;
      }

      const result = data && typeof data === "object" && !Array.isArray(data)
        ? data as Record<string, unknown>
        : null;
      if (!response.ok) {
        const accountSessionMissing = response.status === 401 && result?.code === "account_session_required";
        setAccountLoginRequired(response.status === 403 || accountSessionMissing);
        setError(accountSessionMissing
          ? "Ta session de compte a expiré. Reconnecte-toi au compte avant de valider l’accès administrateur."
          : httpError(response.status));
        return;
      }

      if (result?.requireTotp === true && result.success !== true) {
        setRequireTotp(true);
        setTotp("");
        setShowPassword(false);
        if (requireTotp) setError("Saisis le code actuel de ton application d’authentification.");
        return;
      }

      // HTTP 200 alone, an empty object or a challenge is never proof of login.
      if (result?.success !== true || result.requireTotp === true) {
        setError("Réponse inattendue du serveur. Recharge la page puis réessaie.");
        return;
      }

      router.replace(safeNextUrl);
      router.refresh();
    } catch {
      setError("La connexion au serveur a échoué. Vérifie ta connexion Internet puis réessaie.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className={styles.form} aria-busy={loading}>
      {!requireTotp && <div className={styles.field}>
        <label htmlFor="admin-password">Mot de passe administrateur</label>
        <div className={styles.passwordControl}>
          <input
            id="admin-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            className={styles.input}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            disabled={loading}
            autoFocus
          />
          <button
            type="button"
            className={styles.visibilityButton}
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            aria-pressed={showPassword}
            aria-controls="admin-password"
            disabled={loading}
          >
            {showPassword ? "Masquer" : "Afficher"}
          </button>
        </div>
      </div>}
      {requireTotp && (
        <div className={styles.field}>
          <label htmlFor="admin-totp">Code de vérification</label>
          <p id="admin-totp-hint" className={styles.hint}>
            Saisis les 6 chiffres de ton application d’authentification.
          </p>
          <input
            id="admin-totp"
            name="totp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-describedby="admin-totp-hint"
            className={`${styles.input} ${styles.codeInput}`}
            value={totp}
            onChange={(event) => setTotp(event.target.value.replace(/\D/g, "").slice(0, 6))}
            minLength={6}
            maxLength={6}
            required
            autoFocus
            disabled={loading}
          />
          <button
            type="button"
            className={styles.visibilityButton}
            disabled={loading}
            onClick={() => {
              setRequireTotp(false);
              setTotp("");
              setPassword("");
              setShowPassword(false);
              setError(null);
              setAccountLoginRequired(false);
            }}
          >
            Revenir au mot de passe
          </button>
        </div>
      )}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {accountLoginRequired && <Link href={accountLoginHref}>Se reconnecter au compte</Link>}
      <button type="submit" disabled={loading} className={styles.submitButton}>
        <span>{loading ? "Connexion en cours…" : requireTotp ? "Vérifier le code" : "Se connecter"}</span>
        {!loading && <span aria-hidden="true">→</span>}
      </button>
    </form>
  );
}
