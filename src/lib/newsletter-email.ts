import "server-only";

import nodemailer from "nodemailer";

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
};

let cachedTransporter: nodemailer.Transporter | null = null;
let cachedConfigKey: string | null = null;

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (typeof value !== "string") {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

function parsePort(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error("Configuration e-mail invalide: NEWSLETTER_SMTP_PORT.");
  }
  return parsed;
}

function requireConfigValue(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Configuration e-mail manquante: ${name}.`);
  }
  return value;
}

function getNewsletterSmtpConfig(): SmtpConfig {
  const host = requireConfigValue("NEWSLETTER_SMTP_HOST");
  const port = parsePort(process.env.NEWSLETTER_SMTP_PORT);
  const user = requireConfigValue("NEWSLETTER_SMTP_USER");
  const pass = requireConfigValue("NEWSLETTER_SMTP_PASS");
  const fromEmail = requireConfigValue("NEWSLETTER_FROM_EMAIL");
  const fromName = process.env.NEWSLETTER_FROM_NAME?.trim() || "Les Chanvriers Bretons";
  const replyTo = process.env.NEWSLETTER_REPLY_TO?.trim() || undefined;
  const secure = parseBoolean(process.env.NEWSLETTER_SMTP_SECURE, port === 465);

  return {
    host,
    port,
    secure,
    user,
    pass,
    fromEmail,
    fromName,
    replyTo,
  };
}

function getTransporter(config: SmtpConfig): nodemailer.Transporter {
  const configKey = JSON.stringify({
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.user,
    fromEmail: config.fromEmail,
    fromName: config.fromName,
    replyTo: config.replyTo ?? "",
  });

  if (cachedTransporter && cachedConfigKey === configKey) {
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
  cachedConfigKey = configKey;

  return cachedTransporter;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

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
    from: `"${config.fromName}" <${config.fromEmail}>`,
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
    from: `"${config.fromName}" <${config.fromEmail}>`,
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



