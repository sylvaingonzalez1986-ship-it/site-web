import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { isValidMailingEmail, normalizeMailingEmail } from "@/lib/mailing-policy";
import { getSiteUrl } from "@/lib/site-url";

export function getMailingUnsubscribeSecret(): string {
  const secret = process.env.MAILING_UNSUBSCRIBE_SECRET?.trim() || process.env.ADMIN_SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("Configure MAILING_UNSUBSCRIBE_SECRET avec au moins 32 caractères pour les liens de désinscription.");
  }
  return secret;
}

function signature(payload: string): string {
  return createHmac("sha256", getMailingUnsubscribeSecret()).update(`mailing-unsubscribe:v1:${payload}`).digest("base64url");
}

export function createMailingUnsubscribeToken(email: string): string {
  const normalized = normalizeMailingEmail(email);
  if (!isValidMailingEmail(normalized)) throw new Error("Adresse e-mail invalide.");
  const payload = Buffer.from(normalized, "utf8").toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function readMailingUnsubscribeToken(token: unknown): string | null {
  if (typeof token !== "string" || token.length > 512 || !/^[\w-]+\.[\w-]+$/.test(token)) return null;
  const [payload, received] = token.split(".");
  const expected = signature(payload);
  const actualBytes = Buffer.from(received, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) return null;
  const email = Buffer.from(payload, "base64url").toString("utf8");
  return isValidMailingEmail(email) && normalizeMailingEmail(email) === email ? email : null;
}

export function getMailingUnsubscribeUrls(email: string): { confirmation: string; oneClick: string } {
  const token = encodeURIComponent(createMailingUnsubscribeToken(email));
  const site = getSiteUrl();
  return {
    confirmation: `${site}/newsletter/desinscription?token=${token}`,
    oneClick: `${site}/api/newsletter/unsubscribe?token=${token}`,
  };
}
