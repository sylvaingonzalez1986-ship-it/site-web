"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

type ContactRequestModalProps = {
  open: boolean;
  onClose: () => void;
};

export function ContactRequestModal({ open, onClose }: ContactRequestModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setError(null);
    setSuccess(null);
  }, [open]);

  if (!open) {
    return null;
  }

  const canSubmit =
    name.trim().length >= 2 && email.trim().length > 0 && message.trim().length >= 10;

  const submit = async () => {
    setError(null);
    setSuccess(null);

    if (!canSubmit) {
      setError("Complète le formulaire avant l'envoi.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          phone,
          message,
        }),
      });

      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        setError(data.error ?? "Envoi impossible. Réessaie plus tard.");
        return;
      }

      setSuccess("Message envoyé. Nous reviendrons vers toi rapidement.");
      setName("");
      setEmail("");
      setPhone("");
      setMessage("");
    } catch {
      setError("Erreur réseau. Réessaie dans quelques minutes.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Fermer le formulaire de contact"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-xl cartoon-border bg-cream p-5 md:p-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-3xl text-ink">Nous contacter</h3>
            <p className="mt-1 text-sm text-charcoal">
              Écris-nous ici. Nous répondons par e-mail.
            </p>
          </div>
          <button
            type="button"
            className="btn-cartoon btn-secondary inline-flex h-10 w-10 items-center justify-center p-0"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 grid gap-2">
          <input
            className="h-11 border-2 border-[#1a1a1a] bg-white px-3"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nom complet"
            maxLength={120}
          />
          <input
            className="h-11 border-2 border-[#1a1a1a] bg-white px-3"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            maxLength={160}
          />
          <input
            className="h-11 border-2 border-[#1a1a1a] bg-white px-3"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Téléphone (optionnel)"
            maxLength={40}
          />
          <textarea
            className="min-h-36 border-2 border-[#1a1a1a] bg-white p-3"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Ton message"
            maxLength={3000}
          />
          {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
          {success && <p className="text-sm font-semibold text-green-700">{success}</p>}
          <button
            type="button"
            className="btn-cartoon btn-primary mt-1"
            disabled={!canSubmit || loading}
            onClick={submit}
          >
            {loading ? "Envoi..." : "Envoyer le message"}
          </button>
        </div>
      </div>
    </div>
  );
}


