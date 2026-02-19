"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type AdminLoginFormProps = {
  nextUrl: string;
};

export function AdminLoginForm({ nextUrl }: AdminLoginFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error || "Connexion refusee.");
        return;
      }

      router.replace(nextUrl);
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
      />
      <button type="submit" disabled={loading} className="btn-cartoon btn-primary h-12">
        {loading ? "Connexion..." : "Se connecter"}
      </button>
      {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
    </form>
  );
}
