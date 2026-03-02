export const MISSION_PROOF_BUCKET = "mission-proofs";
export const MISSION_PROOF_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
export const MISSION_PROOF_ACCEPT_ATTRIBUTE = "image/*";

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
