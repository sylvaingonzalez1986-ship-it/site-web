export const MISSION_PROOF_BUCKET = "mission-proofs";
export const MISSION_PROOF_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
export const MISSION_PROOF_ACCEPT_ATTRIBUTE = "image/jpeg,image/png,image/webp";
export const MISSION_PROOF_MAX_PIXELS = 25_000_000;
export const MISSION_PROOF_TEXT_MAX_LENGTH = 2000;
export const MISSION_PROOF_URL_MAX_LENGTH = 2048;

export class MissionRequestError extends Error {
  constructor(message: string, public readonly status = 400, public readonly transactionRolledBack = false) {
    super(message);
    this.name = "MissionRequestError";
  }
}

export function isMissionUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function normalizeMissionProofUrl(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (raw.length > MISSION_PROOF_URL_MAX_LENGTH || url.protocol !== "https:" || url.username || url.password || !url.hostname.includes(".") || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) || /(?:^|\.)(?:localhost|local|internal)$/.test(url.hostname)) throw new Error();
    return url.href;
  } catch {
    throw new MissionRequestError("Utilise un lien HTTPS public valide, sans identifiants.");
  }
}

export function isSameOriginMissionRequest(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

export const MISSION_PROOF_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export type MissionProofMimeType = (typeof MISSION_PROOF_ALLOWED_MIME_TYPES)[number];

export function isSupportedMissionProofMimeType(
  mimeType: string,
): mimeType is MissionProofMimeType {
  return MISSION_PROOF_ALLOWED_MIME_TYPES.includes(mimeType as MissionProofMimeType);
}
