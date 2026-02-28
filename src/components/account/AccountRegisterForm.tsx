"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type AccountRegisterFormProps = {
  nextUrl: string;
  initialReferralCode?: string;
};

export function AccountRegisterForm({ nextUrl, initialReferralCode = "" }: AccountRegisterFormProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("France");
  const [referralCode, setReferralCode] = useState(initialReferralCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAtLeast18Client = (dateValue: string): boolean => {
    if (!dateValue) {
      return false;
    }

    const date = new Date(`${dateValue}T00:00:00Z`);
    if (!Number.isFinite(date.getTime())) {
      return false;
    }

    const now = new Date();
    let age = now.getUTCFullYear() - date.getUTCFullYear();
    const monthDelta = now.getUTCMonth() - date.getUTCMonth();
    if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < date.getUTCDate())) {
      age -= 1;
    }

    return age >= 18;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!isAtLeast18Client(dateOfBirth)) {
      setError("Ce site est reserve aux personnes majeures (18 ans et plus).");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/account/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          dateOfBirth,
          email,
          password,
          phone,
          address,
          city,
          postalCode,
          country,
          referralCode,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error || "Inscription impossible.");
        return;
      }

      router.replace(nextUrl);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="mt-6 grid gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <input
          type="text"
          className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          placeholder="Prenom"
          required
        />
        <input
          type="text"
          className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
          placeholder="Nom"
          required
        />
      </div>
      <input
        type="date"
        className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
        value={dateOfBirth}
        onChange={(event) => setDateOfBirth(event.target.value)}
        required
      />
      <input
        type="email"
        className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        minLength={8}
        className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Mot de passe (8 caractères minimum)"
        required
      />
      <input
        type="text"
        className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        placeholder="Téléphone (optionnel)"
      />
      <input
        type="text"
        className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
        value={address}
        onChange={(event) => setAddress(event.target.value)}
        placeholder="Adresse (optionnel)"
      />
      <div className="grid gap-3 md:grid-cols-3">
        <input
          type="text"
          className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
          value={city}
          onChange={(event) => setCity(event.target.value)}
          placeholder="Ville (optionnel)"
        />
        <input
          type="text"
          className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
          value={postalCode}
          onChange={(event) => setPostalCode(event.target.value)}
          placeholder="Code postal (optionnel)"
        />
        <input
          type="text"
          className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
          value={country}
          onChange={(event) => setCountry(event.target.value)}
          placeholder="Pays"
        />
      </div>
      <input
        type="text"
        className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base uppercase"
        value={referralCode}
        onChange={(event) => setReferralCode(event.target.value.toUpperCase())}
        placeholder="Code parrain (optionnel)"
        data-tutorial="referral-code-input"
      />
      {referralCode.trim().length > 0 && (
        <p className="text-xs font-semibold text-charcoal">
          Code parrain detecte: 10% auto sur ta premiere commande.
        </p>
      )}
      <button type="submit" disabled={loading} className="btn-cartoon btn-primary h-12">
        {loading ? "Création..." : "Créer mon compte"}
      </button>
      {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
    </form>
  );
}
