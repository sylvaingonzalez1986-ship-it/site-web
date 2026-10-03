import "server-only";

import nodemailer from "nodemailer";
import { escapeHtml, getNewsletterSmtpConfig } from "@/lib/email-smtp";
import { personalizeMailingText } from "@/lib/mailing-policy";
import { getMailingUnsubscribeSecret, getMailingUnsubscribeUrls } from "@/lib/mailing-unsubscribe";
import { getSiteUrl } from "@/lib/site-url";
import type { MailingSettings } from "@/types/mailing";

export function getMailingSettings(): MailingSettings {
  try {
    const config = getNewsletterSmtpConfig();
    getMailingUnsubscribeSecret();
    const url = new URL(getSiteUrl());
    if (!["https:", "http:"].includes(url.protocol) || (process.env.NODE_ENV === "production" && url.protocol !== "https:")) {
      throw new Error("Configure NEXT_PUBLIC_SITE_URL avec l’adresse HTTPS publique du site.");
    }
    return { configured: true, fromEmail: config.fromEmail, fromName: config.fromName, replyTo: config.replyTo ?? "", error: null };
  } catch (error) {
    return { configured: false, fromEmail: "", fromName: "Les Chanvriers Bretons", replyTo: "", error: error instanceof Error ? error.message : "Configuration e-mail indisponible." };
  }
}

export function renderMailingEmail(input: { subject: string; body: string; firstName: string; unsubscribeUrl?: string }): { subject: string; html: string; text: string } {
  const subject = personalizeMailingText(input.subject, input.firstName);
  const body = personalizeMailingText(input.body, input.firstName);
  const footer = input.unsubscribeUrl
    ? `Se désinscrire des envois groupés : ${input.unsubscribeUrl}`
    : "Aperçu — le lien personnel de désinscription sera ajouté à l’envoi.";
  return {
    subject,
    text: `Les Chanvriers Bretons\n\n${subject}\n\n${body}\n\n${footer}`,
    html: `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f4f1ea;color:#1a1a1a;font-family:Arial,sans-serif"><div style="max-width:620px;margin:24px auto;background:#ffffff;border-radius:8px;overflow:hidden"><div style="padding:24px;background:#003f30;color:#fffaf1;font-weight:bold;font-size:20px">Les Chanvriers Bretons</div><div style="padding:28px"><h1 style="font-size:24px;line-height:1.3">${escapeHtml(subject)}</h1><div style="font-size:16px;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(body).replace(/\r?\n/g, "<br>")}</div></div><div style="padding:20px 28px;background:#f4f1ea;font-size:12px;line-height:1.6;color:#43554c">Les Chanvriers Bretons<br>${input.unsubscribeUrl ? `<a style="color:#003f30" href="${escapeHtml(input.unsubscribeUrl)}">Se désinscrire des envois groupés</a>` : escapeHtml(footer)}</div></div></body></html>`,
  };
}

// A transport per delivery bounds connection time and never holds a pool open in a route.
export async function sendMailingEmail(input: { email: string; firstName: string; subject: string; body: string; recipientId?: string; test?: boolean }): Promise<void> {
  const config = getNewsletterSmtpConfig();
  const urls = getMailingUnsubscribeUrls(input.email);
  const message = renderMailingEmail({ ...input, unsubscribeUrl: input.test ? undefined : urls.confirmation });
  const transporter = nodemailer.createTransport({
    host: config.host, port: config.port, secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    connectionTimeout: 8_000, greetingTimeout: 8_000, socketTimeout: 15_000,
    disableFileAccess: true, disableUrlAccess: true,
  });
  try {
    const result = await transporter.sendMail({
      from: { name: config.fromName, address: config.fromEmail },
      to: { address: input.email, name: input.firstName },
      replyTo: config.replyTo,
      subject: input.test ? `[TEST] ${message.subject}` : message.subject,
      html: message.html, text: message.text,
      ...(input.recipientId ? { messageId: `<mailing-${input.recipientId}@${new URL(getSiteUrl()).hostname}>` } : {}),
      ...(!input.test ? { headers: { "List-Unsubscribe": `<${urls.oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {}),
    });
    if (!result.accepted?.length) {
      throw Object.assign(new Error("Adresse refusée par le serveur e-mail."), { code: "EENVELOPE" });
    }
  } finally {
    transporter.close();
  }
}

export function classifyMailingSendError(error: unknown): { status: "failed" | "uncertain"; message: string; pause: boolean } {
  const smtp = error && typeof error === "object" ? error as { code?: string; responseCode?: number; command?: string } : {};
  // An explicit SMTP rejection is safe to classify. A broken connection after DATA
  // may already have delivered; never automatically retry that recipient.
  if ((smtp.responseCode && smtp.responseCode >= 400) || ["EAUTH", "EENVELOPE", "EDNS"].includes(smtp.code ?? "")) {
    return {
      status: "failed",
      message: smtp.code === "EAUTH" ? "Authentification SMTP refusée. Vérifie la configuration avant de reprendre." : "Envoi refusé par le serveur e-mail. Vérifie l’adresse et les limites du fournisseur.",
      // Pause on a provider/configuration problem so the remaining audience is
      // retained. A permanent rejection of one address does not stop the queue.
      pause: smtp.code === "EAUTH" || smtp.code === "EDNS" || Boolean(smtp.responseCode && smtp.responseCode < 500),
    };
  }
  return { status: "uncertain", message: "Connexion interrompue : la remise ne peut pas être confirmée. L’envoi est arrêté ; vérifie la connexion avant de reprendre. Ce destinataire ne sera pas renvoyé automatiquement.", pause: true };
}
