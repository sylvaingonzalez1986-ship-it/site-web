import "server-only";

import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import {
  MISSION_PROOF_BUCKET,
  MISSION_PROOF_UPLOAD_MAX_BYTES,
  MISSION_PROOF_MAX_PIXELS,
  isMissionUuid,
  isSupportedMissionProofMimeType,
} from "@/lib/mission-proof-policy";

type DetectedImageType = {
  extension: "jpg" | "png" | "webp";
  mimeType: "image/jpeg" | "image/png" | "image/webp";
};

export class MissionProofUploadError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "MissionProofUploadError";
  }
}

function sanitizeMimeType(mimeType: string): string {
  if (mimeType === "image/jpg") {
    return "image/jpeg";
  }

  return mimeType;
}

function detectImageType(bytes: Uint8Array): DetectedImageType | null {
  if (bytes.length >= 8) {
    const isPng =
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a;

    if (isPng) {
      return { extension: "png", mimeType: "image/png" };
    }
  }

  if (bytes.length >= 3) {
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (isJpeg) {
      return { extension: "jpg", mimeType: "image/jpeg" };
    }
  }

  if (bytes.length >= 12) {
    const isWebp =
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50;

    if (isWebp) {
      return { extension: "webp", mimeType: "image/webp" };
    }
  }

  return null;
}

export async function saveMissionProofUpload(file: File, userId: string): Promise<{
  storagePath: string;
  contentType: string;
  fileSize: number;
}> {
  if (!isMissionUuid(userId)) throw new MissionProofUploadError("Compte invalide.", 400);
  if (file.size <= 0) {
    throw new MissionProofUploadError("Fichier vide.", 400);
  }

  if (file.size > MISSION_PROOF_UPLOAD_MAX_BYTES) {
    throw new MissionProofUploadError("Image trop volumineuse.", 413);
  }

  const sanitizedMimeType = sanitizeMimeType(file.type);
  if (!isSupportedMissionProofMimeType(sanitizedMimeType)) {
    throw new MissionProofUploadError(
      "Format non supporte. Utilise JPG, PNG ou WEBP.",
      415,
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const detected = detectImageType(bytes);
  if (!detected) {
    throw new MissionProofUploadError("Format d'image invalide.", 415);
  }

  if (detected.mimeType !== sanitizedMimeType) {
    throw new MissionProofUploadError(
      "Le contenu du fichier ne correspond pas au type declare.",
      415,
    );
  }

  let normalized: Buffer;
  try {
    const image = sharp(bytes, { limitInputPixels: MISSION_PROOF_MAX_PIXELS, animated: false, failOn: "warning" });
    const metadata = await image.metadata();
    if ((metadata.pages ?? 1) !== 1 || !metadata.width || !metadata.height) throw new Error();
    normalized = await image.rotate().webp({ quality: 92 }).toBuffer();
  } catch {
    throw new MissionProofUploadError("Image illisible ou trop grande. Utilise une capture JPG, PNG ou WEBP.", 415);
  }
  if (normalized.length > MISSION_PROOF_UPLOAD_MAX_BYTES) throw new MissionProofUploadError("Image trop volumineuse.", 413);
  const objectPath = `${userId}/${randomUUID()}.webp`;
  const supabase = createSupabaseServiceClient();
  const uploadResult = await supabase.storage
    .from(MISSION_PROOF_BUCKET)
    .upload(objectPath, normalized, {
      contentType: "image/webp",
      upsert: false,
    });

  if (uploadResult.error) {
    throw new MissionProofUploadError("Impossible d’enregistrer la capture. Réessaie plus tard.", 503);
  }

  return {
    storagePath: objectPath,
    contentType: "image/webp",
    fileSize: normalized.length,
  };
}

export async function createMissionProofSignedUrl(
  storagePath: string,
  expiresInSeconds = 60 * 10,
): Promise<string | null> {
  if (!storagePath.trim()) {
    return null;
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase.storage
    .from(MISSION_PROOF_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (result.error || !result.data?.signedUrl) {
    return null;
  }

  return result.data.signedUrl;
}

export async function deleteMissionProof(storagePath: string): Promise<void> {
  if (!storagePath.trim()) {
    return;
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase.storage.from(MISSION_PROOF_BUCKET).remove([storagePath]);
  if (result.error) {
    throw new MissionProofUploadError("Impossible de supprimer la capture inutilisée.", 503);
  }
}

/** Enumerate only this user's flat private folder, including previous revisions and unreferenced uploads. */
export async function listMissionProofPathsForUser(userId: string): Promise<string[]> {
  if (!isMissionUuid(userId)) throw new MissionProofUploadError("Compte invalide.", 400);
  const bucket = createSupabaseServiceClient().storage.from(MISSION_PROOF_BUCKET);
  const paths: string[] = [];
  const pageSize = 100;
  const maximumObjects = 10000;
  for (let offset = 0; offset <= maximumObjects; offset += pageSize) {
    const result = await bucket.list(userId, { limit: pageSize, offset, sortBy: { column: "name", order: "asc" } });
    if (result.error) throw new MissionProofUploadError("Impossible de préparer la suppression des captures.", 503);
    const rows = result.data ?? [];
    for (const row of rows) {
      if (!row.id || typeof row.name !== "string" || !/^[0-9a-f-]{36}\.(?:jpg|png|webp)$/i.test(row.name)) {
        throw new MissionProofUploadError("Une capture nécessite une vérification avant suppression du compte.", 503);
      }
      paths.push(userId + "/" + row.name);
      if (paths.length > maximumObjects) throw new MissionProofUploadError("Trop de captures pour une suppression immédiate. Contacte l’équipe.", 503);
    }
    if (rows.length < pageSize) return [...new Set(paths)];
  }
  throw new MissionProofUploadError("La suppression des captures doit être réessayée.", 503);
}
