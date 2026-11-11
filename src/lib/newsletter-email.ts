import "server-only";
import { escapeHtml, formatEmailSender, getNewsletterSmtpConfig, getTransporter } from "@/lib/email-smtp";
import { getSiteUrl } from "@/lib/site-url";

export async function sendNewsletterConfirmationEmail(input: { email: string; token: string }): Promise<void> {
  const config = getNewsletterSmtpConfig();
  const url = `${getSiteUrl()}/newsletter/confirmation?token=${encodeURIComponent(input.token)}`;
  const text = `Confirme ton inscription à la newsletter des Chanvriers Bretons : ${url}\nCe lien expire dans 24 heures. Si tu n'as pas demandé cette inscription, ignore cet e-mail : aucune inscription ne sera activée.`;
  await getTransporter(config).sendMail({
    from: formatEmailSender(config), to: input.email, replyTo: config.replyTo,
    subject: "Confirme ton inscription à la newsletter",
    text,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.5"><h1>Confirmer mon inscription</h1><p>Pour recevoir les actualités et offres des Chanvriers Bretons, confirme ton inscription.</p><p><a href="${escapeHtml(url)}">Confirmer mon inscription</a></p><p>Ce lien expire dans 24 heures. Si tu n’es pas à l’origine de cette demande, ignore cet e-mail : aucune inscription ne sera activée.</p></div>`,
  });
}
