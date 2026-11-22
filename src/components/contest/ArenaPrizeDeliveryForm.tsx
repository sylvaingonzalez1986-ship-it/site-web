"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "@/components/navigation/NavigationLink";
import type { ArenaPrizeDelivery } from "@/lib/arena-customer-rewards";

export function ArenaPrizeDeliveryForm({ delivery }: { delivery: ArenaPrizeDelivery }) {
  const [orderId, setOrderId] = useState(delivery.orderId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const receipt = useRef<HTMLHeadingElement>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || orderId) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/arena/rewards/delivery", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grantId: delivery.id, ...Object.fromEntries(new FormData(event.currentTarget)) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      if (typeof body.orderId !== "string" || body.totalCents !== 0) throw new Error();
      setOrderId(body.orderId);
      requestAnimationFrame(() => receipt.current?.focus());
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : "Confirmation indisponible. Réessaie ou recharge la page.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (orderId) return <div className="my-3 grid gap-2" data-arena-prize-receipt>
    <h3 ref={receipt} tabIndex={-1} className="font-bold">Commande de remise confirmée</h3>
    <p className="break-all">Référence {orderId}</p>
    <p>Total 0 €, livraison comprise.</p>
    <Link href="/profil?tab=commandes" className="w-fit underline">Voir mes commandes</Link>
  </div>;

  const inputClass = "block min-h-11 w-full border border-current bg-white px-2 text-base";
  return <details className="my-2">
    <summary className="min-h-11 cursor-pointer py-2 font-bold">Commander mon lot · 0 €</summary>
    <form onSubmit={event => void submit(event)} className="grid gap-2" aria-busy={busy}>
      <p>Livraison et traitement inclus. Expédition en France métropolitaine, Corse comprise.</p>
      <label>Nom du destinataire<input name="name" className={inputClass} autoComplete="shipping name" required minLength={2} maxLength={120} /></label>
      <label>Adresse<input name="address" className={inputClass} autoComplete="shipping street-address" required minLength={5} maxLength={180} /></label>
      <label>Code postal<input name="postalCode" className={inputClass} autoComplete="shipping postal-code" inputMode="numeric" required pattern="[0-9]{5}" maxLength={5} /></label>
      <label>Commune<input name="city" className={inputClass} autoComplete="shipping address-level2" required minLength={2} maxLength={100} /></label>
      <label>Téléphone (facultatif)<input name="phone" type="tel" className={inputClass} autoComplete="shipping tel" maxLength={30} /></label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" className="btn-cartoon btn-primary w-fit" disabled={busy}>{busy ? "Confirmation…" : "Confirmer la commande · 0 €"}</button>
    </form>
  </details>;
}
