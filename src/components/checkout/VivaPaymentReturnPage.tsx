import Link from "next/link";
import { VivaPaymentReturnEffects } from "@/components/checkout/VivaPaymentReturnEffects";
import { getOrderByVivaOrderCodeByBackend } from "@/lib/order-backend";
import { formatPrice } from "@/lib/utils";
import type { CmsOrder } from "@/types/store";

export type VivaPaymentReturnKind = "success" | "failure";

type VivaPaymentReturnPageProps = {
  kind: VivaPaymentReturnKind;
  searchParams?: Record<string, string | string[] | undefined>;
};

type PaymentCopy = {
  eyebrow: string;
  title: string;
  message: string;
  toneClassName: string;
  statusLabel: string;
};

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}

function hasSearchParam(
  params: Record<string, string | string[] | undefined> | undefined,
  key: string,
): boolean {
  return Boolean(params && Object.prototype.hasOwnProperty.call(params, key));
}

function getPaymentStateLabel(paymentState: CmsOrder["paymentState"] | undefined): string {
  switch (paymentState) {
    case "paid":
      return "Paiement confirme";
    case "failed":
      return "Paiement refuse";
    case "not_configured":
      return "Validation manuelle";
    case "pending":
      return "Confirmation en cours";
    default:
      return "Retour Viva recu";
  }
}

function getOrderStatusLabel(status: CmsOrder["status"] | undefined): string {
  switch (status) {
    case "paid":
      return "Commande payee";
    case "processing":
      return "Preparation en cours";
    case "shipped":
      return "Expediee";
    case "cancelled":
      return "Annulee";
    case "pending_payment":
      return "Paiement en attente";
    case "new":
      return "Nouvelle commande";
    default:
      return "Statut indisponible";
  }
}

function buildCopy(input: {
  kind: VivaPaymentReturnKind;
  order: CmsOrder | null;
  cancelled: boolean;
}): PaymentCopy {
  if (input.cancelled) {
    return {
      eyebrow: "Paiement Viva",
      title: "Paiement annule",
      message:
        "Le paiement a ete annule avant validation. Aucun paiement n'a ete confirme pour cette tentative.",
      toneClassName: "bg-[#fff5da] text-[#6f4b00]",
      statusLabel: getPaymentStateLabel(input.order?.paymentState),
    };
  }

  if (input.kind === "failure" || input.order?.paymentState === "failed") {
    return {
      eyebrow: "Paiement Viva",
      title: "Paiement non valide",
      message:
        "Le paiement n'a pas ete confirme par Viva. Tu peux revenir a la boutique et relancer le paiement si besoin.",
      toneClassName: "bg-[#f8d7da] text-[#7f1d1d]",
      statusLabel: getPaymentStateLabel(input.order?.paymentState),
    };
  }

  if (input.order?.paymentState === "paid") {
    return {
      eyebrow: "Paiement Viva",
      title: "Paiement confirme",
      message:
        "Ton paiement a bien ete valide. La commande est enregistree et va passer en preparation.",
      toneClassName: "bg-[#d4f5dc] text-[#1a5c32]",
      statusLabel: getPaymentStateLabel(input.order.paymentState),
    };
  }

  return {
    eyebrow: "Paiement Viva",
    title: "Paiement valide",
    message:
      "Viva a valide le retour de paiement. La confirmation definitive peut prendre quelques instants, le temps que le webhook mette la commande a jour.",
    toneClassName: "bg-[#d4f5dc] text-[#1a5c32]",
    statusLabel: getPaymentStateLabel(input.order?.paymentState),
  };
}

export async function VivaPaymentReturnPage({
  kind,
  searchParams,
}: VivaPaymentReturnPageProps) {
  const vivaOrderCode = firstParam(searchParams?.s);
  const vivaTransactionId = firstParam(searchParams?.t);
  const eventId = firstParam(searchParams?.eventId);
  const cancelled =
    hasSearchParam(searchParams, "cancel") || Boolean(firstParam(searchParams?.cancel));
  let order: CmsOrder | null = null;
  let lookupFailed = false;

  if (vivaOrderCode) {
    try {
      order = await getOrderByVivaOrderCodeByBackend(vivaOrderCode);
    } catch (error) {
      lookupFailed = true;
      console.error("Unable to load Viva return order:", error);
    }
  }

  const copy = buildCopy({ kind, order, cancelled });
  const details = [
    order?.id ? { label: "Commande", value: order.id } : null,
    vivaOrderCode ? { label: "Reference Viva", value: vivaOrderCode } : null,
    vivaTransactionId || order?.vivaTransactionId
      ? { label: "Transaction", value: vivaTransactionId || order?.vivaTransactionId || "" }
      : null,
    order ? { label: "Montant", value: `${formatPrice(order.totalAmount)} TTC` } : null,
    order ? { label: "Statut commande", value: getOrderStatusLabel(order.status) } : null,
    eventId ? { label: "Code retour Viva", value: eventId } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  return (
    <section className="section-band bg-mint halftone-overlay paper-grain pt-36 pb-16">
      <VivaPaymentReturnEffects clearCart={kind === "success"} />
      <div className="retro-container">
        <div className="cartoon-border mx-auto max-w-3xl bg-cream p-6 text-center md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-charcoal">
            {copy.eyebrow}
          </p>
          <h1 className="mt-3 font-display text-4xl leading-none text-ink md:text-5xl">
            {copy.title}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-charcoal md:text-base">
            {copy.message}
          </p>

          <div
            className={`cartoon-border-sm mx-auto mt-6 inline-flex px-4 py-2 text-sm font-extrabold uppercase tracking-[0.08em] ${copy.toneClassName}`}
          >
            {copy.statusLabel}
          </div>

          {details.length > 0 && (
            <dl className="mx-auto mt-6 grid max-w-xl gap-3 text-left sm:grid-cols-2">
              {details.map((detail) => (
                <div key={detail.label} className="cartoon-border-sm bg-white p-3">
                  <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-charcoal">
                    {detail.label}
                  </dt>
                  <dd className="mt-1 break-words text-sm font-bold text-ink">
                    {detail.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {!vivaOrderCode && (
            <p className="mx-auto mt-5 max-w-xl text-sm font-semibold text-charcoal">
              Le retour Viva ne contient pas de reference commande. Si ton paiement est passe,
              retrouve la commande dans ton profil.
            </p>
          )}
          {lookupFailed && (
            <p className="mx-auto mt-5 max-w-xl text-sm font-semibold text-charcoal">
              La commande n&apos;a pas pu etre relue pour le moment, mais le retour paiement a bien
              ete recu par le site.
            </p>
          )}

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href="/profil" className="btn-cartoon btn-primary">
              Voir mon profil
            </Link>
            <Link href="/boutique" className="btn-cartoon btn-secondary">
              Retour boutique
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
