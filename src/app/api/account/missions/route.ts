import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { deleteMissionProof, MissionProofUploadError, saveMissionProofUpload } from "@/lib/mission-proof-storage";
import { isMissionUuid, isSameOriginMissionRequest, normalizeMissionProofUrl, MissionRequestError, MISSION_PROOF_TEXT_MAX_LENGTH, MISSION_PROOF_UPLOAD_MAX_BYTES } from "@/lib/mission-proof-policy";
import { getCustomerMissionsByBackend, getReferralPendingRewardsByBackend, submitMissionProofByBackend } from "@/lib/missions-backend";
import { getRequestIp, hitRateLimit } from "@/lib/security-rate-limit";

export const runtime = "nodejs";
const privateHeaders = { "Cache-Control": "private, no-store" };

export async function GET() {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401, headers: privateHeaders });
  try {
    const [missions, pendingRewards] = await Promise.all([
      getCustomerMissionsByBackend(session.customerId),
      getReferralPendingRewardsByBackend(session.customerId),
    ]);
    return NextResponse.json({ missions, pendingRewards }, { headers: privateHeaders });
  } catch {
    return NextResponse.json({ error: "Impossible de charger les missions pour le moment." }, { status: 503, headers: privateHeaders });
  }
}

async function readBoundedBody(request: Request, limit: number): Promise<Uint8Array<ArrayBuffer>> {
  if (Number(request.headers.get("content-length") ?? 0) > limit) throw new MissionRequestError("Envoi trop volumineux.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new MissionRequestError("Envoi vide.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > limit) {
        await reader.cancel();
        throw new MissionRequestError("Envoi trop volumineux.", 413);
      }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

export async function POST(request: Request) {
  if (!isSameOriginMissionRequest(request)) return NextResponse.json({ error: "Origine de la demande invalide." }, { status: 403 });
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const ip = getRequestIp(request);
  const limit = await hitRateLimit({ key: `mission_proof_submit:${session.customerId}`, windowSeconds: 600, maxHits: 12 });
  if (!limit.allowed) return NextResponse.json({ error: "Trop de tentatives. Réessaie plus tard." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });

  let uploadedProofPath: string | null = null;
  try {
    const contentType = request.headers.get("content-type") ?? "";
    const multipart = contentType.includes("multipart/form-data");
    if (!multipart && !contentType.includes("application/json")) throw new MissionRequestError("Format de demande invalide.", 415);
    const bytes = await readBoundedBody(request, multipart ? MISSION_PROOF_UPLOAD_MAX_BYTES + 65536 : 16384);
    let values: Record<string, unknown>;
    let file: File | null = null;
    try {
      if (multipart) {
        const data = await new Response(bytes, { headers: { "content-type": contentType } }).formData();
        values = Object.fromEntries(data.entries());
        const candidate = data.get("file");
        if (candidate instanceof File && candidate.size > 0) file = candidate;
      } else {
        values = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
        if (!values || typeof values !== "object" || Array.isArray(values)) throw new Error();
      }
    } catch { throw new MissionRequestError("Le formulaire est illisible."); }
    const text = (key: string) => typeof values[key] === "string" ? values[key].trim() : "";
    const missionId = text("missionId");
    const requestKey = text("requestKey");
    const submissionId = text("submissionId") || undefined;
    const rawRevision = values.expectedRevision;
    const expectedRevision = rawRevision == null || rawRevision === "" ? undefined : Number(rawRevision);
    if (!isMissionUuid(missionId) || !isMissionUuid(requestKey) || (submissionId && !isMissionUuid(submissionId)) ||
      (submissionId && (!Number.isSafeInteger(expectedRevision) || (expectedRevision ?? 0) < 1)) ||
      (!submissionId && expectedRevision !== undefined)) throw new MissionRequestError("Données de participation invalides.");
    const proofUrl = normalizeMissionProofUrl(text("proofUrl"));
    const proofText = text("proofText");
    if (proofText.length > MISSION_PROOF_TEXT_MAX_LENGTH) throw new MissionRequestError("Ton message est trop long.");
    const upload = file ? await saveMissionProofUpload(file, session.customerId) : null;
    uploadedProofPath = upload?.storagePath ?? null;
    // An uncertain RPC failure may have committed: retain the private upload rather than delete a valid proof.
    const submission = await submitMissionProofByBackend({
      userId: session.customerId, missionId, requestKey, submissionId, expectedRevision,
      proofUrl: proofUrl || undefined, proofText: proofText || undefined,
      proofStoragePath: upload?.storagePath, proofContentType: upload?.contentType, proofFileSize: upload?.fileSize,
    });
    if (upload && submission.proofStoragePath !== upload.storagePath) {
      try { await deleteMissionProof(upload.storagePath); } catch { console.error("[missions] unused replay upload cleanup deferred"); }
    }
    void logAuditEvent({ eventType: "upload_mission_proof", ip, metadata: { missionId, submissionId: submission.id, revision: submission.revision } });
    return NextResponse.json({ submission }, { headers: privateHeaders });
  } catch (error) {
    if (uploadedProofPath && error instanceof MissionRequestError && error.transactionRolledBack) {
      try { await deleteMissionProof(uploadedProofPath); } catch { console.error("[missions] rejected upload cleanup deferred"); }
    }
    if (error instanceof MissionRequestError || error instanceof MissionProofUploadError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: privateHeaders });
    }
    return NextResponse.json({ error: "Impossible d’envoyer ta preuve pour le moment. Réessaie avec le même envoi." }, { status: 503, headers: privateHeaders });
  }
}
