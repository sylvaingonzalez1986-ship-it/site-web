"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

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

      const data = (await response.json()) as { error?: string; requireTotp?: boolean };

      if (data.requireTotp && !requireTotp) {
        setRequireTotp(true);
        return;
      }

      if (!response.ok) {
        setError(data.error || "Connexion refusee.");
        return;
      }

      router.replace(sanitizeNextUrl(nextUrl));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="mt-6 grid gap-3">
      <input
        type="password"
        className="h-12 border-2 border-[#1a1a1a] bg-white px-3"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Mot de passe"
        required
        disabled={requireTotp}
      />
      {requireTotp && (
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-center font-mono tracking-widest"
          value={totp}
          onChange={(event) => setTotp(event.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="Code TOTP (6 chiffres)"
          required
          autoFocus
        />
      )}
      <button type="submit" disabled={loading} className="btn-cartoon btn-primary h-12">
        {loading ? "Connexion..." : requireTotp ? "Verifier le code" : "Se connecter"}
      </button>
      {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
    </form>
  );
}
