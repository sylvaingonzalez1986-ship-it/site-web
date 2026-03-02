import "server-only";

import {
  escapeHtml,
  formatEmailSender,
  getNewsletterSmtpConfig,
  getTransporter,
} from "@/lib/email-smtp";
import { calculateOrderSubtotal } from "@/lib/invoice-utils";
import type { CmsOrder } from "@/types/store";

function formatPrice(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function formatDate(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return value;
  }

  return new Date(timestamp).toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
}

function formatMultiline(value: string): string {
  return escapeHtml(value).replaceAll("\n", "<br />");
}

function formatAddressBlock(lines: Array<string | undefined>): string {
  const filtered = lines
    .map((line) => line?.trim() || "")
    .filter((line) => line.length > 0);

  return filtered.length > 0
    ? filtered.map((line) => formatMultiline(line)).join("<br />")
    : "-";
}

function getTrackingUrl(order: CmsOrder): string | null {
  const trackingNumber = order.trackingNumber?.trim();
  if (!trackingNumber) {
    return null;
  }

  if (order.deliveryMethod === "relay") {
    return `https://www.mondialrelay.fr/suivi-de-colis?numColis=${encodeURIComponent(trackingNumber)}`;
  }

  return null;
}

function buildItemsHtml(order: CmsOrder): string {
  return order.items
    .map((item) => {
      const packContext = item.parentPackName
        ? ` <span style="color:#5a5a5a;font-size:12px;">(${escapeHtml(item.parentPackName)})</span>`
        : "";

      return `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e7dfd1;">
            <div style="font-weight:700;color:#1a1a1a;">${escapeHtml(item.name)}${packContext}</div>
          </td>
          <td style="padding:12px 0;border-bottom:1px solid #e7dfd1;text-align:center;color:#1a1a1a;">${item.quantity}</td>
          <td style="padding:12px 0;border-bottom:1px solid #e7dfd1;text-align:right;color:#1a1a1a;">${formatPrice(item.unitPrice)}</td>
          <td style="padding:12px 0;border-bottom:1px solid #e7dfd1;text-align:right;color:#1a1a1a;font-weight:700;">${formatPrice(item.lineTotal)}</td>
        </tr>
      `;
    })
    .join("");
}

function buildTotalsHtml(order: CmsOrder): string {
  const deliveryFee = Number.isFinite(order.deliveryFee) ? Number(order.deliveryFee ?? 0) : 0;
  const discountAmount = Number.isFinite(order.discountAmount)
    ? Number(order.discountAmount ?? 0)
    : 0;

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="font-size:14px;color:#1a1a1a;">
      <tr>
        <td style="padding:6px 0;">Sous-total HT</td>
        <td style="padding:6px 0;text-align:right;">${formatPrice(order.totalHt)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;">TVA</td>
        <td style="padding:6px 0;text-align:right;">${formatPrice(order.totalVat)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;">Livraison</td>
        <td style="padding:6px 0;text-align:right;">${formatPrice(deliveryFee)}</td>
      </tr>
      ${discountAmount > 0
        ? `
      <tr>
        <td style="padding:6px 0;">Remise${order.promoCode ? ` (${escapeHtml(order.promoCode)})` : ""}</td>
        <td style="padding:6px 0;text-align:right;">- ${formatPrice(discountAmount)}</td>
      </tr>`
        : ""}
      <tr>
        <td style="padding:10px 0 0;font-size:16px;font-weight:800;border-top:2px solid #1a1a1a;">Total TTC</td>
        <td style="padding:10px 0 0;text-align:right;font-size:16px;font-weight:800;border-top:2px solid #1a1a1a;">${formatPrice(order.totalAmount)}</td>
      </tr>
    </table>
  `;
}

function buildDeliveryHtml(order: CmsOrder): string {
  if (order.deliveryMethod === "relay") {
    return formatAddressBlock([
      order.relayName || order.relayId,
      order.relayAddress,
      [order.relayPostalCode, order.relayCity].filter(Boolean).join(" "),
      order.relayCountry,
    ]);
  }

  return formatAddressBlock([
    order.shippingAddress,
    [order.shippingPostalCode, order.shippingCity].filter(Boolean).join(" "),
    order.shippingCountry,
    order.shippingPhone,
  ]);
}

function buildEmailShell(input: {
  preheader: string;
  title: string;
  intro: string;
  order: CmsOrder;
  spotlightHtml?: string;
  footerNote?: string;
}): string {
  return `
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</div>
    <div style="margin:0;padding:24px;background:#f7f4ee;font-family:Arial,sans-serif;color:#1a1a1a;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:720px;margin:0 auto;background:#ffffff;border:2px solid #1a1a1a;border-radius:18px;overflow:hidden;">
        <tr>
          <td style="padding:24px;background:#0a7b61;color:#ffffff;">
            <div style="font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;opacity:0.9;">Les Chanvriers Bretons</div>
            <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;">${escapeHtml(input.title)}</h1>
            <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#effaf7;">${escapeHtml(input.intro)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;">
            <div style="background:#f7f4ee;border-radius:14px;padding:16px 18px;margin-bottom:20px;">
              <div style="font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#5a5a5a;">Commande</div>
              <div style="margin-top:8px;font-size:20px;font-weight:800;">#${escapeHtml(input.order.id)}</div>
              <div style="margin-top:6px;font-size:14px;color:#5a5a5a;">Passée le ${escapeHtml(formatDate(input.order.createdAt))}</div>
              <div style="margin-top:6px;font-size:14px;color:#5a5a5a;">Client : ${escapeHtml(input.order.customerName || input.order.customerEmail || "Client")}</div>
            </div>

            ${input.spotlightHtml ?? ""}

            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:20px;font-size:14px;">
              <tr>
                <td style="padding:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#5a5a5a;">Produit</td>
                <td style="padding:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#5a5a5a;text-align:center;">Qté</td>
                <td style="padding:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#5a5a5a;text-align:right;">Prix unit.</td>
                <td style="padding:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#5a5a5a;text-align:right;">Total</td>
              </tr>
              ${buildItemsHtml(input.order)}
            </table>

            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:24px;">
              <tr>
                <td valign="top" style="width:50%;padding:0 12px 0 0;">
                  <div style="font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#5a5a5a;">Livraison</div>
                  <div style="margin-top:10px;font-size:14px;line-height:1.6;color:#1a1a1a;">${buildDeliveryHtml(input.order)}</div>
                </td>
                <td valign="top" style="width:50%;padding:0 0 0 12px;">
                  <div style="font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#5a5a5a;">Totaux</div>
                  <div style="margin-top:10px;">${buildTotalsHtml(input.order)}</div>
                </td>
              </tr>
            </table>

            <div style="margin-top:24px;padding:16px 18px;background:#f7f4ee;border-radius:14px;">
              <p style="margin:0 0 10px;font-size:14px;line-height:1.7;color:#1a1a1a;">
                Tu peux retrouver l'historique de ta commande dans ton espace client.
              </p>
              <a href="https://leschanvriersbretons.fr/profil?tab=commandes" style="display:inline-block;padding:12px 16px;background:#0a7b61;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;">
                Voir mes commandes
              </a>
            </div>

            ${input.footerNote
              ? `<p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#5a5a5a;">${escapeHtml(input.footerNote)}</p>`
              : ""}
          </td>
        </tr>
        <tr>
          <td style="padding:18px 24px;background:#1a1a1a;color:#f7f4ee;font-size:12px;line-height:1.7;">
            Les Chanvriers Bretons — CBD Naturel Direct Producteur<br />
            <a href="https://leschanvriersbretons.fr/mentions-legales" style="color:#f7f4ee;">Mentions légales</a>
            &nbsp;·&nbsp;
            <a href="https://leschanvriersbretons.fr/politique-confidentialite" style="color:#f7f4ee;">Politique de confidentialité</a>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function buildProcessingEmail(order: CmsOrder) {
  const subtotal = calculateOrderSubtotal(order);
  return {
    subject: `Commande #${order.id} prise en charge`,
    html: buildEmailShell({
      preheader: `Ta commande ${order.id} est en cours de préparation.`,
      title: "Commande prise en charge",
      intro: "Ta commande est bien prise en charge. Notre équipe la prépare actuellement avec soin.",
      order,
      footerNote: "Tu recevras un nouvel e-mail dès que la commande sera expédiée.",
    }),
    text:
      `Commande #${order.id} prise en charge\n\n` +
      `Ta commande est en cours de préparation.\n` +
      `Montant total: ${formatPrice(order.totalAmount)}\n` +
      `Sous-total articles: ${formatPrice(subtotal)}\n` +
      `Voir mes commandes: https://leschanvriersbretons.fr/profil?tab=commandes\n`,
  };
}

function buildShippedEmail(order: CmsOrder) {
  const trackingUrl = getTrackingUrl(order);
  const trackingNumber = order.trackingNumber?.trim() || "";
  return {
    subject: `Commande #${order.id} expediée`,
    html: buildEmailShell({
      preheader: `Ta commande ${order.id} a ete expediée.`,
      title: "Commande expediée",
      intro: "Bonne nouvelle : ta commande a quitté nos ateliers.",
      order,
      spotlightHtml: trackingNumber
        ? `
      <div style="margin-top:20px;padding:18px 20px;background:#0a7b61;border-radius:16px;color:#ffffff;">
        <div style="font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;opacity:0.9;">Numero de suivi</div>
        <div style="margin-top:8px;font-size:24px;font-weight:800;letter-spacing:0.04em;">${escapeHtml(trackingNumber)}</div>
        ${trackingUrl
          ? `<a href="${trackingUrl}" style="display:inline-block;margin-top:14px;padding:10px 14px;background:#ffffff;color:#0a7b61;text-decoration:none;border-radius:10px;font-weight:700;">Suivre mon colis</a>`
          : `<div style="margin-top:12px;font-size:13px;line-height:1.6;opacity:0.95;">Conserve ce numero de suivi pour suivre l'expedition.</div>`}
      </div>`
        : "",
      footerNote: trackingNumber
        ? trackingUrl
          ? "Le bouton de suivi ouvre la page officielle Mondial Relay."
          : "Le numero de suivi est inclus dans cet e-mail."
        : "Aucun numero de suivi n'a ete renseigne pour cette expedition.",
    }),
    text:
      `Commande #${order.id} expediée\n\n` +
      `Ta commande a ete expediée.\n` +
      (trackingNumber ? `Numero de suivi: ${trackingNumber}\n` : "") +
      (trackingUrl ? `Suivi: ${trackingUrl}\n` : "") +
      `Voir mes commandes: https://leschanvriersbretons.fr/profil?tab=commandes\n`,
  };
}

async function sendOrderEmail(
  order: CmsOrder,
  buildEmail: (input: CmsOrder) => { subject: string; html: string; text: string },
): Promise<void> {
  const recipient = order.customerEmail?.trim().toLowerCase();
  if (!recipient) {
    throw new Error("Adresse e-mail commande manquante.");
  }

  const config = getNewsletterSmtpConfig();
  const transporter = getTransporter(config);
  const email = buildEmail(order);

  await transporter.sendMail({
    from: formatEmailSender(config),
    to: recipient,
    replyTo: config.replyTo,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
}

export async function sendOrderProcessingEmail(order: CmsOrder): Promise<void> {
  await sendOrderEmail(order, buildProcessingEmail);
}

export async function sendOrderShippedEmail(order: CmsOrder): Promise<void> {
  await sendOrderEmail(order, buildShippedEmail);
}
