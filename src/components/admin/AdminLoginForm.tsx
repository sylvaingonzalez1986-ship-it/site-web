"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "@/components/navigation/NavigationFeedback";
import styles from "./AdminLogin.module.css";

function sanitizeNextUrl(value: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/admin";
  }
  return value;
}

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

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
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
      let data: { error?: string; requireTotp?: boolean } = {};
      try {
        data = responseText ? JSON.parse(responseText) as typeof data : {};
      } catch {
        throw new Error(response.ok
          ? "Réponse inattendue du serveur. Recharge la page puis réessaie."
          : `Connexion admin indisponible (${response.status}). Redémarre le serveur local puis réessaie.`);
      }

      if (data.requireTotp && !requireTotp) {
        setRequireTotp(true);
        return;
      }

      if (!response.ok) {
        setError(data.error || "Connexion refusée.");
        return;
      }

      router.replace(sanitizeNextUrl(nextUrl));
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error
        ? submitError.message
        : "Connexion admin momentanément indisponible.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className={styles.form} aria-busy={loading}>
      <div className={styles.field}>
        <label htmlFor="admin-password">Mot de passe</label>
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
            disabled={requireTotp}
          />
          <button
            type="button"
            className={styles.visibilityButton}
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            aria-pressed={showPassword}
            aria-controls="admin-password"
          >
            {showPassword ? "Masquer" : "Afficher"}
          </button>
        </div>
      </div>
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
          />
        </div>
      )}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <button type="submit" disabled={loading} className={styles.submitButton}>
        <span>{loading ? "Connexion en cours…" : requireTotp ? "Vérifier le code" : "Se connecter"}</span>
        {!loading && <span aria-hidden="true">→</span>}
      </button>
    </form>
  );
}
