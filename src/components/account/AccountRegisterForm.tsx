"use client";

import { FormEvent, useId, useState } from "react";
import Link from "@/components/navigation/NavigationLink";
import { sanitizeNextPath } from "@/lib/safe-next-path";

type AccountRegisterFormProps = {
  nextUrl: string;
  initialReferralCode?: string;
};

export function AccountRegisterForm({ nextUrl, initialReferralCode = "" }: AccountRegisterFormProps) {
  const nextPath = sanitizeNextPath(nextUrl, "/profil");
  const loginHref = `/compte/connexion?next=${encodeURIComponent(nextPath)}`;
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
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const formId = useId();

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
          next: nextPath,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error || "Inscription impossible.");
        return;
      }
      const data = (await response.json()) as { email?: string };
      setVerificationEmail(data.email ?? email);
    } catch {
      setError("Inscription impossible pour le moment. Réessaie dans quelques instants.");
    } finally {
      setLoading(false);
    }
  };

  if (verificationEmail) {
    return (
      <div className="account-form mt-6 grid gap-3">
        <div role="status" className="cartoon-border-sm bg-mint/30 p-4 text-sm text-charcoal">
          <p className="font-semibold">Un e-mail de vérification a été envoyé à {verificationEmail}.</p>
          <p className="mt-2">Ouvre le lien reçu pour activer ton compte. Pense à vérifier les courriers indésirables.</p>
        </div>
        <Link href={loginHref} className="btn-cartoon btn-primary inline-flex min-h-12 items-center justify-center">Aller à la connexion</Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="account-form mt-6 grid gap-3" aria-busy={loading}>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1.5"><span className="text-sm font-bold">Prénom</span>
        <input
          type="text"
          name="given-name"
          autoComplete="given-name"
          className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          required
        />
        </label>
        <label className="grid gap-1.5"><span className="text-sm font-bold">Nom</span>
        <input
          type="text"
          name="family-name"
          autoComplete="family-name"
          className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
          required
        />
        </label>
      </div>
      <label className="grid gap-1.5">
        <span className="text-sm font-bold text-ink">
          Date de naissance <span className="text-red-700">(obligatoire)</span>
        </span>
        <input
          type="date"
          name="bday"
          autoComplete="bday"
          className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
          value={dateOfBirth}
          onChange={(event) => setDateOfBirth(event.target.value)}
          aria-describedby={`${formId}-birth-help`}
          required
        />
        <span id={`${formId}-birth-help`} className="text-xs font-semibold text-charcoal">
          Vous devez avoir 18 ans ou plus pour pouvoir passer commande.
        </span>
      </label>
      <label className="grid gap-1.5"><span className="text-sm font-bold">Adresse e-mail</span>
      <input
        type="email"
        name="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="toi@exemple.fr"
        required
      />
      </label>
      <label htmlFor={`${formId}-password`} className="text-sm font-bold">Mot de passe</label>
      <p id={`${formId}-password-help`} className="text-sm text-charcoal">Au moins 8 caractères.</p>
      <div className="account-password-field">
      <input
        id={`${formId}-password`}
        name="password"
        autoComplete="new-password"
        type={showPassword ? "text" : "password"}
        aria-describedby={`${formId}-password-help`}
        minLength={8}
        className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
      />
      <button type="button" onClick={() => setShowPassword(value => !value)} aria-controls={`${formId}-password`} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-pressed={showPassword}>{showPassword ? "Masquer" : "Afficher"}</button>
      </div>
      <details className="account-optional-fields">
      <summary>Coordonnées de livraison (facultatif)</summary>
      <p className="mb-3 text-sm text-charcoal">Tu peux les renseigner plus tard, lors d’une commande.</p>
      <div className="grid gap-3">
      <label className="grid gap-1.5"><span className="text-sm font-bold">Téléphone</span>
      <input
        type="tel"
        name="tel"
        autoComplete="tel"
        className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
      />
      </label>
      <label className="grid gap-1.5"><span className="text-sm font-bold">Adresse</span>
      <input
        type="text"
        name="street-address"
        autoComplete="street-address"
        className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
        value={address}
        onChange={(event) => setAddress(event.target.value)}
      />
      </label>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="grid gap-1.5"><span className="text-sm font-bold">Ville</span>
        <input
          type="text"
          name="address-level2"
          autoComplete="address-level2"
          className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
          value={city}
          onChange={(event) => setCity(event.target.value)}
        />
        </label>
        <label className="grid gap-1.5"><span className="text-sm font-bold">Code postal</span>
        <input
          type="text"
          name="postal-code"
          autoComplete="postal-code"
          inputMode={country.trim().toLowerCase() === "france" ? "numeric" : "text"}
          className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
          value={postalCode}
          onChange={(event) => setPostalCode(event.target.value)}
        />
        </label>
        <label className="grid gap-1.5"><span className="text-sm font-bold">Pays</span>
        <input
          type="text"
          name="country-name"
          autoComplete="country-name"
          className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base"
          value={country}
          onChange={(event) => setCountry(event.target.value)}
        />
        </label>
      </div>
      </div>
      </details>
      <label className="grid gap-1.5"><span className="text-sm font-bold">Code parrain (facultatif)</span>
      <input
        type="text"
        name="referral-code"
        autoCapitalize="characters"
        spellCheck={false}
        className="h-12 border-2 border-[#1a1a1a] bg-white px-3 text-base uppercase"
        value={referralCode}
        onChange={(event) => setReferralCode(event.target.value.toUpperCase())}
      />
      </label>
      {referralCode.trim().length > 0 && (
        <p className="text-xs font-semibold text-charcoal">
          Code parrain detecte: 10% auto sur ta premiere commande.
        </p>
      )}
      <button type="submit" disabled={loading} className="btn-cartoon btn-primary min-h-12">
        {loading ? "Création..." : "Créer mon compte"}
      </button>
      {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
    </form>
  );
}
