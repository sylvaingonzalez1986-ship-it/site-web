"use client";

import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type ResetPasswordFormProps = {
  nextUrl: string;
};

type ResetPhase = "checking" | "ready" | "invalid";

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
  url.searchParams.delete("redirect_to");
  url.searchParams.delete("error");
  url.searchParams.delete("error_code");
  url.searchParams.delete("error_description");
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
}

export function ResetPasswordForm({ nextUrl }: ResetPasswordFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phase, setPhase] = useState<ResetPhase>("checking");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recoveryDetectedRef = useRef(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let active = true;
    const currentUrl = new URL(window.location.href);
    recoveryDetectedRef.current = hasRecoveryMarker(currentUrl);

    const markReadyFromSession = (session: Session | null) => {
      if (!active || !session || !recoveryDetectedRef.current) {
        return;
      }

      cleanRecoveryUrl();
      setError(null);
      setPhase("ready");
    };

    const authSubscription = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        recoveryDetectedRef.current = true;
      }

      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        markReadyFromSession(session);
      }
    });

    async function bootstrapRecovery() {
      const tokenHash = currentUrl.searchParams.get("token_hash");
      const otpType = currentUrl.searchParams.get("type");

      // Let the browser client auto-handle standard recovery callback URLs.
      // Only verify token_hash links manually when they are explicitly present.
      if (tokenHash && otpType === "recovery") {
        recoveryDetectedRef.current = true;
        const verifyResult = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });
        if (verifyResult.error) {
          if (!active) {
            return;
          }

          cleanRecoveryUrl();
          setPhase("invalid");
          setError("Lien invalide ou expire. Redemande un nouvel email.");
          return;
        }
      }

      const initialSession = await supabase.auth.getSession();
      if (initialSession.data.session && recoveryDetectedRef.current) {
        markReadyFromSession(initialSession.data.session);
        return;
      }

      for (let attempt = 0; attempt < 4; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 250));
        if (!active) {
          return;
        }

        const fallbackSession = await supabase.auth.getSession();
        if (fallbackSession.data.session && recoveryDetectedRef.current) {
          markReadyFromSession(fallbackSession.data.session);
          return;
        }
      }

      setPhase("invalid");
      setError("Lien invalide ou expire. Redemande un nouvel email.");
    }

    void bootstrapRecovery();

    return () => {
      active = false;
      authSubscription.data.subscription.unsubscribe();
    };
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

    setLoading(true);

    try {
      const response = await fetch("/api/account/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
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
