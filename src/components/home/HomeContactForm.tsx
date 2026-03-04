"use client";

import { useState, type FormEvent } from "react";
import type { CmsStore } from "@/types/store";

type HomeContent = CmsStore["content"]["home"];

export function HomeContactForm({
  home,
}: {
  home: HomeContent;
}) {
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactLoading, setContactLoading] = useState(false);
  const [contactSuccess, setContactSuccess] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);

  const submitHomeContact = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setContactError(null);
    setContactSuccess(null);

    const name = contactName.trim();
    const email = contactEmail.trim().toLowerCase();
    const message = contactMessage.trim();

    if (name.length < 2 || email.length === 0 || message.length < 10) {
      setContactError("Complète le formulaire avant l'envoi.");
      return;
    }

    setContactLoading(true);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone: "", message }),
      });

      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        setContactError(data.error ?? "Envoi impossible. Réessaie plus tard.");
        return;
      }

      setContactSuccess("Message envoyé. Nous reviendrons vers toi rapidement.");
      setContactName("");
      setContactEmail("");
      setContactMessage("");
    } catch {
      setContactError("Erreur réseau. Réessaie dans quelques minutes.");
    } finally {
      setContactLoading(false);
    }
  };

  return (
    <form className="mt-6 grid gap-3 md:grid-cols-2" onSubmit={submitHomeContact}>
      <input
        className="h-12 border-2 border-[#1a1a1a] bg-white px-4 text-base"
        placeholder={home.contactNamePlaceholder}
        value={contactName}
        onChange={(event) => setContactName(event.target.value)}
      />
      <input
        type="email"
        className="h-12 border-2 border-[#1a1a1a] bg-white px-4 text-base"
        placeholder={home.contactEmailPlaceholder}
        value={contactEmail}
        onChange={(event) => setContactEmail(event.target.value)}
      />
      <textarea
        className="min-h-28 border-2 border-[#1a1a1a] bg-white p-4 text-base md:col-span-2"
        placeholder="Ton message"
        value={contactMessage}
        onChange={(event) => setContactMessage(event.target.value)}
      />
      {contactError && (
        <p className="text-sm font-semibold text-red-700 md:col-span-2">{contactError}</p>
      )}
      {contactSuccess && (
        <p className="text-sm font-semibold text-green-700 md:col-span-2">{contactSuccess}</p>
      )}
      <button
        type="submit"
        className="btn-cartoon btn-primary h-12 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={contactLoading}
      >
        {contactLoading ? "Envoi..." : home.contactSubmitLabel}
      </button>
    </form>
  );
}
