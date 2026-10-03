import type { MailingContact, MailingDraftInput, MailingKind } from "@/types/mailing";

export const MAILING_MAX_RECIPIENTS = 10_000;
export const MAILING_MAX_BODY_LENGTH = 20_000;

export class MailingValidationError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "MailingValidationError";
  }
}

export function normalizeMailingEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isValidMailingEmail(value: string): boolean {
  return value.length <= 254 && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(value);
}

export function isMailingContactEligible(contact: MailingContact, kind: MailingKind): boolean {
  return !contact.unsubscribed && (kind === "marketing" ? contact.subscribed : contact.customer);
}

export function isMailingUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new MailingValidationError("Requête invalide.");
  }
  return value as Record<string, unknown>;
}

function field(value: unknown, label: string, max: number, singleLine = false): string {
  if (typeof value !== "string" || !value.trim() || value.length > max || /\u0000/.test(value)) {
    throw new MailingValidationError(`${label} requis (maximum ${max} caractères).`);
  }
  if (singleLine && /[\r\n]/.test(value)) {
    throw new MailingValidationError(`${label} doit tenir sur une seule ligne.`);
  }
  return value.trim();
}

export function parseMailingMessage(input: unknown): { subject: string; body: string } {
  const value = record(input);
  return {
    subject: field(value.subject, "Objet", 200, true),
    body: field(value.body, "Message", MAILING_MAX_BODY_LENGTH),
  };
}

export function parseMailingDraft(input: unknown): MailingDraftInput {
  const value = record(input);
  if (typeof value.id !== "string" || !isMailingUuid(value.id)) {
    throw new MailingValidationError("Identifiant de campagne invalide.");
  }
  if (value.kind !== "marketing" && value.kind !== "information") {
    throw new MailingValidationError("Choisis le type de campagne.");
  }
  if (!Array.isArray(value.recipientEmails) || value.recipientEmails.length > MAILING_MAX_RECIPIENTS) {
    throw new MailingValidationError(`La campagne accepte jusqu’à ${MAILING_MAX_RECIPIENTS} destinataires.`);
  }
  const recipientEmails = [...new Set(value.recipientEmails.map(normalizeMailingEmail))];
  if (recipientEmails.some((email) => !isValidMailingEmail(email))) {
    throw new MailingValidationError("La sélection contient une adresse e-mail invalide.");
  }
  return {
    id: value.id,
    name: field(value.name, "Nom de campagne", 120, true),
    ...parseMailingMessage(value),
    kind: value.kind,
    recipientEmails,
  };
}

export function personalizeMailingText(value: string, firstName: string): string {
  const name = firstName.replace(/[\r\n\u0000]/g, " ").trim().slice(0, 80) || "cher client";
  return value.replace(/\{\{\s*prenom\s*\}\}/gi, () => name);
}
