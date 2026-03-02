import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import {
  deleteMissionProof,
  MissionProofUploadError,
  saveMissionProofUpload,
} from "@/lib/mission-proof-storage";
import {
  getCustomerMissionsByBackend,
  getReferralPendingRewardsByBackend,
  submitMissionProofByBackend,
} from "@/lib/missions-backend";
import { getRequestIp, hitRateLimit } from "@/lib/security-rate-limit";

export const runtime = "nodejs";

export async function GET() {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  try {
    const [missions, pendingRewards] = await Promise.all([
      getCustomerMissionsByBackend(session.customerId),
      getReferralPendingRewardsByBackend(session.customerId),
    ]);

    return NextResponse.json({ missions, pendingRewards });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur chargement missions." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  const ip = getRequestIp(request);
  const rateLimit = await hitRateLimit({
    key: `mission_proof_submit:${session.customerId}:${ip}`,
    windowSeconds: 60 * 10,
    maxHits: 6,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Trop de tentatives. Reessaie plus tard." }, { status: 429 });
  }

  let uploadedProofPath: string | null = null;

  try {
    const contentType = request.headers.get("content-type") ?? "";
    let missionId = "";
    let proofText = "";
    let proofUrl = "";
    let proofStoragePath = "";
    let proofContentType = "";
    let proofFileSize = 0;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      missionId = typeof formData.get("missionId") === "string" ? String(formData.get("missionId")).trim() : "";
      proofText = typeof formData.get("proofText") === "string" ? String(formData.get("proofText")).trim() : "";
      const file = formData.get("file");

      if (file instanceof File && file.size > 0) {
        const upload = await saveMissionProofUpload(file, session.customerId);
        uploadedProofPath = upload.storagePath;
        proofStoragePath = upload.storagePath;
        proofContentType = upload.contentType;
        proofFileSize = upload.fileSize;
      }
    } else {
      const payload = (await request.json()) as {
        missionId?: string;
        proofUrl?: string;
        proofText?: string;
      };
      missionId = typeof payload.missionId === "string" ? payload.missionId.trim() : "";
      proofText = typeof payload.proofText === "string" ? payload.proofText.trim() : "";
      proofUrl = typeof payload.proofUrl === "string" ? payload.proofUrl.trim() : "";
    }

    if (!missionId) {
      return NextResponse.json({ error: "Mission manquante." }, { status: 400 });
    }

    const submission = await submitMissionProofByBackend({
      userId: session.customerId,
      missionId,
      proofUrl: proofUrl || undefined,
      proofStoragePath: proofStoragePath || undefined,
      proofContentType: proofContentType || undefined,
      proofFileSize: proofFileSize || undefined,
      proofText: proofText || undefined,
    });

    if (proofStoragePath) {
      logAuditEvent({
        eventType: "upload_mission_proof",
        ip,
        metadata: { missionId, proofStoragePath },
      });
    }

    return NextResponse.json({ submission });
  } catch (error) {
    if (uploadedProofPath) {
      try {
        await deleteMissionProof(uploadedProofPath);
      } catch (cleanupError) {
        console.error("[missions] orphan proof cleanup failed", {
          uploadedProofPath,
          cleanupError,
        });
      }
    }

    if (error instanceof MissionProofUploadError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur soumission mission." },
      { status: 400 },
    );
  }
}
