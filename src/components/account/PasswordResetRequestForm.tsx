"use client";

import { FormEvent, useState } from "react";

type PasswordResetRequestFormProps = {
  nextUrl: string;
};

type RequestState = {
  error: string | null;
  successMessage: string | null;
};

const INITIAL_STATE: RequestState = {
  error: null,
  successMessage: null,
};

export function PasswordResetRequestForm({ nextUrl }: PasswordResetRequestFormProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<RequestState>(INITIAL_STATE);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState(INITIAL_STATE);
    setLoading(true);

    try {
      const response = await fetch("/api/account/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, next: nextUrl }),
      });

      const data = (await response.json()) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        setState({
          error: data.error || "Demande impossible pour le moment.",
          successMessage: null,
        });
        return;
      }

      setState({
        error: null,
        successMessage:
          data.message ||
          "Si un compte existe pour cette adresse, un email de reinitialisation vient d'etre envoye.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="mt-6 grid gap-3">
      <input
        type="email"
        className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email"
        autoComplete="email"
        required
      />
      <button type="submit" disabled={loading} className="btn-cartoon btn-primary h-12">
        {loading ? "Envoi..." : "Recevoir un lien de reinitialisation"}
      </button>
      {state.error && <p className="text-sm font-semibold text-red-700">{state.error}</p>}
      {state.successMessage && (
        <div className="rounded-md border border-[#1a1a1a] bg-mint/30 px-3 py-2 text-sm font-semibold text-charcoal">
          <p>{state.successMessage}</p>
          <p className="mt-2 font-normal">
            Pense aussi a verifier tes spams ou courriers indesirables.
          </p>
        </div>
      )}
    </form>
  );
}
