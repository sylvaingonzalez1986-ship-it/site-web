"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ResetPasswordFormProps = {
  nextUrl: string;
};

type ResetPhase = "checking" | "ready" | "invalid";

type RecoveryPayload =
  | {
      tokenHash: string;
    }
  | {
      accessToken: string;
      refreshToken: string;
    };

function hasRecoveryMarker(url: URL): boolean {
  return (
    url.searchParams.has("code") ||
    url.searchParams.has("token_hash") ||
    url.searchParams.get("type") === "recovery" ||
    url.hash.includes("type=recovery") ||
    url.hash.includes("access_token=")
  );
}

function cleanRecoveryUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("code");
  url.searchParams.delete("type");
  url.searchParams.delete("token_hash");
  url.searchParams.delete("access_token");
  url.searchParams.delete("refresh_token");
  url.searchParams.delete("redirect_to");
  url.searchParams.delete("error");
  url.searchParams.delete("error_code");
  url.searchParams.delete("error_description");
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
}

function parseRecoveryPayload(url: URL): RecoveryPayload | null {
  const hashParams = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
  const tokenHash = url.searchParams.get("token_hash")?.trim() || "";
  const otpType = url.searchParams.get("type")?.trim() || hashParams.get("type")?.trim() || "";
  if (tokenHash && otpType === "recovery") {
    return { tokenHash };
  }

  const accessToken =
    hashParams.get("access_token")?.trim() || url.searchParams.get("access_token")?.trim() || "";
  const refreshToken =
    hashParams.get("refresh_token")?.trim() || url.searchParams.get("refresh_token")?.trim() || "";
  if (accessToken && refreshToken && (!otpType || otpType === "recovery")) {
    return { accessToken, refreshToken };
  }

  return null;
}

export function ResetPasswordForm({ nextUrl }: ResetPasswordFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phase, setPhase] = useState<ResetPhase>("checking");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryPayload, setRecoveryPayload] = useState<RecoveryPayload | null>(null);

  useEffect(() => {
    const currentUrl = new URL(window.location.href);
    if (!hasRecoveryMarker(currentUrl)) {
      setPhase("invalid");
      setError("Lien invalide ou expire. Redemande un nouvel email.");
      return;
    }

    const nextRecoveryPayload = parseRecoveryPayload(currentUrl);
    if (!nextRecoveryPayload) {
      cleanRecoveryUrl();
      setPhase("invalid");
      setError("Lien invalide ou expire. Redemande un nouvel email.");
      return;
    }

    setRecoveryPayload(nextRecoveryPayload);
    cleanRecoveryUrl();
    setError(null);
    setPhase("ready");
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Les deux mots de passe doivent etre identiques.");
      return;
    }

    if (!recoveryPayload) {
      setError("Lien invalide ou expire. Redemande un nouvel email.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/account/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          "tokenHash" in recoveryPayload
            ? { password, tokenHash: recoveryPayload.tokenHash }
            : {
                password,
                accessToken: recoveryPayload.accessToken,
                refreshToken: recoveryPayload.refreshToken,
              },
        ),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Reinitialisation impossible.");
        return;
      }

      const loginUrl = new URL("/compte/connexion", window.location.origin);
      loginUrl.searchParams.set("passwordReset", "true");
      if (nextUrl !== "/profil") {
        loginUrl.searchParams.set("next", nextUrl);
      }

      router.replace(`${loginUrl.pathname}${loginUrl.search}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  if (phase === "checking") {
    return (
      <div className="mt-6 rounded-md border border-[#1a1a1a] bg-white px-4 py-3 text-sm font-semibold text-charcoal">
        Verification du lien en cours...
      </div>
    );
  }

  if (phase === "invalid") {
    return (
      <div className="mt-6 grid gap-3">
        <p className="rounded-md border border-[#1a1a1a] bg-red-100 px-4 py-3 text-sm font-semibold text-red-700">
          {error || "Lien invalide ou expire. Redemande un nouvel email."}
        </p>
        <Link
          href={`/compte/mot-de-passe-oublie?next=${encodeURIComponent(nextUrl)}`}
          className="btn-cartoon btn-primary inline-flex h-12 items-center justify-center"
        >
          Demander un nouveau lien
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 grid gap-3">
      <input
        type="password"
        minLength={8}
        className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Nouveau mot de passe"
        autoComplete="new-password"
        required
      />
      <input
        type="password"
        minLength={8}
        className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        placeholder="Confirmer le nouveau mot de passe"
        autoComplete="new-password"
        required
      />
      <button type="submit" disabled={loading} className="btn-cartoon btn-primary h-12">
        {loading ? "Mise a jour..." : "Mettre a jour mon mot de passe"}
      </button>
      {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
    </form>
  );
}
