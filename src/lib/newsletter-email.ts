import "server-only";

import {
  escapeHtml,
  formatEmailSender,
  getNewsletterSmtpConfig,
  getTransporter,
} from "@/lib/email-smtp";

export async function sendNewsletterConfirmationEmail(input: {
  email: string;
  alreadySubscribed: boolean;
}): Promise<void> {
  const recipient = input.email.trim().toLowerCase();
  if (!recipient) {
    throw new Error("Adresse e-mail invalide.");
  }

  const config = getNewsletterSmtpConfig();
  const transporter = getTransporter(config);

  const subject = input.alreadySubscribed
    ? "Newsletter Les Chanvriers Bretons: vous êtes déjà inscrit(e)"
    : "Confirmation d'inscription à la newsletter";

  const safeRecipient = escapeHtml(recipient);
  const intro = input.alreadySubscribed
    ? "Votre adresse est déjà inscrite à notre newsletter."
    : "Votre inscription à notre newsletter est bien confirmée.";

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1a1a1a;">
      <h1 style="font-size: 18px; margin-bottom: 12px;">Les Chanvriers Bretons</h1>
      <p>${intro}</p>
      <p>Adresse enregistrée: <strong>${safeRecipient}</strong></p>
      <p>Vous recevrez nos actualités et offres à venir.</p>
      <p style="margin-top: 20px;">Si vous n'êtes pas à l'origine de cette demande, contactez-nous à
      <a href="mailto:leschanvriersbretons@gmail.com">leschanvriersbretons@gmail.com</a>.</p>
    </div>
  `;

  await transporter.sendMail({
    from: formatEmailSender(config),
    to: recipient,
    replyTo: config.replyTo,
    subject,
    html,
    text: `${intro}\nAdresse enregistrée: ${recipient}\nSi vous n'êtes pas à l'origine de cette demande, contactez-nous à leschanvriersbretons@gmail.com.`,
  });
}
