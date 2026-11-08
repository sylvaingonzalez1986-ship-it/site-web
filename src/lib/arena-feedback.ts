export type ArenaFeedbackKind = "bug" | "idea";
export type ArenaFeedbackStatus = "new" | "reviewing" | "planned" | "resolved" | "declined";

export const ARENA_FEEDBACK_KIND_LABELS: Record<ArenaFeedbackKind, string> = {
  bug: "Signaler un bug", idea: "Proposer une idée",
};
export const ARENA_FEEDBACK_STATUS_LABELS: Record<ArenaFeedbackStatus, string> = {
  new: "Reçu", reviewing: "En cours de lecture", planned: "Prévu", resolved: "Traité", declined: "Non retenu",
};
export const ARENA_FEEDBACK_LIMITS = {
  subjectMin: 4, subjectMax: 120, messageMin: 20, messageMax: 4000,
  replyMax: 2000, dailySubmissions: 5, maxRewardPacks: 5,
} as const;

export type ArenaFeedback = {
  id: string;
  kind: ArenaFeedbackKind;
  subject: string;
  message: string;
  pagePath: string | null;
  status: ArenaFeedbackStatus;
  reply: string | null;
  rewardPacks: number;
  rewardGrantedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type AdminArenaFeedback = ArenaFeedback & { userId: string; reviewedBy: string | null };
export type ArenaFeedbackList<T = ArenaFeedback> = { items: T[]; total: number; hasMore: boolean };
export type ArenaFeedbackSubmission = {
  requestId: string; kind: ArenaFeedbackKind; subject: string; message: string; pagePath: string | null;
};
export type ArenaFeedbackReview = { id: string; status: ArenaFeedbackStatus; reply: string | null; rewardPacks: number; expectedUpdatedAt: string | null };

export class ArenaFeedbackError extends Error {
  constructor(message: string, public readonly status = 400, public readonly retryAfterSeconds?: number) {
    super(message);
    this.name = "ArenaFeedbackError";
  }
}

export function isArenaFeedbackKind(value: unknown): value is ArenaFeedbackKind {
  return value === "bug" || value === "idea";
}
export function isArenaFeedbackStatus(value: unknown): value is ArenaFeedbackStatus {
  return typeof value === "string" && Object.hasOwn(ARENA_FEEDBACK_STATUS_LABELS, value);
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ArenaFeedbackError("Demande invalide.");
  return value as Record<string, unknown>;
}
function uuid(value: unknown) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new ArenaFeedbackError("Identifiant de demande invalide.");
  }
  return value.toLowerCase();
}
function text(value: unknown, min: number, max: number, label: string) {
  if (typeof value !== "string") throw new ArenaFeedbackError(`${label} invalide.`);
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  // Reject invisible control characters; keep ordinary multiline plain text.
  if (normalized.length < min || normalized.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized)) {
    throw new ArenaFeedbackError(`${label} : entre ${min} et ${max} caractères.`);
  }
  return normalized;
}

export function parseArenaFeedbackSubmission(value: unknown): ArenaFeedbackSubmission {
  const body = record(value);
  if (!isArenaFeedbackKind(body.kind)) throw new ArenaFeedbackError("Choisis un bug ou une idée.");
  const subject = text(body.subject, 4, 120, "Le titre");
  if (/[\n\t]/.test(subject)) throw new ArenaFeedbackError("Le titre doit tenir sur une ligne.");
  let pagePath: string | null = null;
  if (body.pagePath !== undefined && body.pagePath !== null && body.pagePath !== "") {
    if (typeof body.pagePath !== "string" || body.pagePath.length > 300 || !/^\/(?!\/)[^?#\\\s]*$/.test(body.pagePath)) {
      throw new ArenaFeedbackError("La page concernée doit être un chemin du site, sans paramètres.");
    }
    pagePath = body.pagePath;
  }
  return { requestId: uuid(body.requestId), kind: body.kind, subject,
    message: text(body.message, 20, 4000, "Le message"), pagePath };
}

export function parseArenaFeedbackReview(value: unknown): ArenaFeedbackReview {
  const body = record(value);
  if (!isArenaFeedbackStatus(body.status)) throw new ArenaFeedbackError("Statut inconnu.");
  const reply = body.reply === null ? null : text(body.reply, 0, 2000, "La réponse") || null;
  const rewardPacks = body.rewardPacks === undefined ? 0 : body.rewardPacks;
  if (typeof rewardPacks !== "number" || !Number.isInteger(rewardPacks) || rewardPacks < 0 || rewardPacks > 5) {
    throw new ArenaFeedbackError("La récompense doit être un nombre entier de 0 à 5 packs.");
  }
  if (rewardPacks > 0 && (body.status === "new" || body.status === "declined")) {
    throw new ArenaFeedbackError("Passe le message en cours de lecture, prévu ou traité avant de le récompenser.");
  }
  let expectedUpdatedAt: string | null = null;
  if (body.expectedUpdatedAt !== undefined && body.expectedUpdatedAt !== null) {
    if (typeof body.expectedUpdatedAt !== "string" || body.expectedUpdatedAt.length > 40 || !/^\d{4}-\d{2}-\d{2}T/.test(body.expectedUpdatedAt) || !Number.isFinite(Date.parse(body.expectedUpdatedAt))) {
      throw new ArenaFeedbackError("Version du message invalide.");
    }
    expectedUpdatedAt = body.expectedUpdatedAt;
  }
  return { id: uuid(body.id), status: body.status, reply, rewardPacks, expectedUpdatedAt };
}

export function parseArenaFeedbackOffset(value: string | null) {
  if (value === null) return 0;
  if (!/^\d{1,7}$/.test(value)) throw new ArenaFeedbackError("Page invalide.");
  return Number(value);
}
