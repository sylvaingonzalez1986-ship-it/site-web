import "server-only";

import nodemailer from "nodemailer";

export type SmtpConfig = {
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

export function requireConfigValue(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Configuration e-mail manquante: ${name}.`);
  }
  return value;
}

export function getNewsletterSmtpConfig(): SmtpConfig {
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

export function getTransporter(config: SmtpConfig): nodemailer.Transporter {
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

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatEmailSender(config: SmtpConfig): string {
  return `"${config.fromName}" <${config.fromEmail}>`;
}
