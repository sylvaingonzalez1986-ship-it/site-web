"use client";

import { FormEvent, useId, useState } from "react";
import { useRouter } from "@/components/navigation/NavigationFeedback";
import { useCart } from "@/context/CartContext";
import { sanitizeNextPath } from "@/lib/safe-next-path";
import type { PublicCustomer } from "@/types/customer";

type AccountLoginFormProps = {
  nextUrl: string;
};

export function AccountLoginForm({ nextUrl }: AccountLoginFormProps) {
  const router = useRouter();
  const { setUser } = useCart();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const formId = useId();

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/account/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error || "Connexion refusee.");
        return;
      }

      const data = (await response.json()) as { user: PublicCustomer };
      setUser(data.user);
      router.replace(sanitizeNextPath(nextUrl, "/profil"));
    } catch {
      setError("Connexion impossible pour le moment. Réessaie dans quelques instants.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="account-form mt-6 grid gap-3" aria-busy={loading}>
      <label htmlFor={`${formId}-email`} className="text-sm font-bold">Adresse e-mail</label>
      <input
        id={`${formId}-email`}
        name="email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        type="email"
        className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="toi@exemple.fr"
        required
      />
      <label htmlFor={`${formId}-password`} className="text-sm font-bold">Mot de passe</label>
      <div className="account-password-field">
      <input
        id={`${formId}-password`}
        name="password"
        autoComplete="current-password"
        type={showPassword ? "text" : "password"}
        className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
      />
      <button type="button" onClick={() => setShowPassword(value => !value)} aria-controls={`${formId}-password`} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-pressed={showPassword}>{showPassword ? "Masquer" : "Afficher"}</button>
      </div>
      <button type="submit" disabled={loading} className="btn-cartoon btn-primary min-h-12">
        {loading ? "Connexion..." : "Se connecter"}
      </button>
      {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
    </form>
  );
}
