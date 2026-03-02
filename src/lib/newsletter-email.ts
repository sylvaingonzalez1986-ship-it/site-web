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

export async function sendContactRequestEmail(input: {
  name: string;
  email: string;
  phone: string;
  message: string;
}): Promise<void> {
  const senderName = input.name.trim();
  const senderEmail = input.email.trim().toLowerCase();
  const senderPhone = (input.phone || "").trim();
  const senderMessage = input.message.trim();

  if (!senderName || !senderEmail || !senderMessage) {
    throw new Error("Informations de contact invalides.");
  }

  const destination =
    process.env.CONTACT_RECEIVER_EMAIL?.trim() || "leschanvriersbretons@gmail.com";

  const config = getNewsletterSmtpConfig();
  const transporter = getTransporter(config);
  const now = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });

  const safeName = escapeHtml(senderName);
  const safeEmail = escapeHtml(senderEmail);
  const safePhone = escapeHtml(senderPhone || "-");
  const safeMessage = escapeHtml(senderMessage).replaceAll("\n", "<br />");

  await transporter.sendMail({
    from: formatEmailSender(config),
    to: destination,
    replyTo: senderEmail,
    subject: `Nouveau message contact - ${senderName}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.55; color: #1a1a1a;">
        <h1 style="font-size: 18px; margin-bottom: 12px;">Nouveau message depuis le site</h1>
        <p><strong>Nom :</strong> ${safeName}</p>
        <p><strong>Email :</strong> ${safeEmail}</p>
        <p><strong>Téléphone :</strong> ${safePhone}</p>
        <p><strong>Date :</strong> ${escapeHtml(now)}</p>
        <hr style="margin: 16px 0; border: 0; border-top: 1px solid #ddd;" />
        <p><strong>Message :</strong></p>
        <p>${safeMessage}</p>
      </div>
    `,
    text:
      `Nouveau message depuis le site\n\n` +
      `Nom: ${senderName}\n` +
      `Email: ${senderEmail}\n` +
      `Téléphone: ${senderPhone || "-"}\n` +
      `Date: ${now}\n\n` +
      `Message:\n${senderMessage}\n`,
  });
}
