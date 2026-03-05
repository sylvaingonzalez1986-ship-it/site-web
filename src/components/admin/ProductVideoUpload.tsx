"use client";

import { useState } from "react";

type ProductVideoUploadProps = {
  value?: string;
  onChange: (nextVideoUrl: string | undefined) => void;
};

export function ProductVideoUpload({ value, onChange }: ProductVideoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const RECOMMENDED_MAX_SIZE_BYTES = 12 * 1024 * 1024;
  const RECOMMENDED_MAX_DURATION_SECONDS = 12;

  const inspectVideoDuration = async (file: File): Promise<number | null> => {
    try {
      const objectUrl = URL.createObjectURL(file);
      const duration = await new Promise<number | null>((resolve) => {
        const video = document.createElement("video");
        const timeout = window.setTimeout(() => resolve(null), 4000);

        video.preload = "metadata";
        video.onloadedmetadata = () => {
          window.clearTimeout(timeout);
          const nextDuration = Number.isFinite(video.duration) ? video.duration : null;
          resolve(nextDuration);
          URL.revokeObjectURL(objectUrl);
        };
        video.onerror = () => {
          window.clearTimeout(timeout);
          resolve(null);
          URL.revokeObjectURL(objectUrl);
        };
        video.src = objectUrl;
      });
      return duration;
    } catch {
      return null;
    }
  };

  const buildVideoWarnings = async (file: File): Promise<string[]> => {
    const nextWarnings: string[] = [];

    if (file.size > RECOMMENDED_MAX_SIZE_BYTES) {
      nextWarnings.push(
        "Video lourde: vise idealement < 12 Mo (H.264/AAC, 720p, 1.5-3 Mbps).",
      );
    }

    const duration = await inspectVideoDuration(file);
    if (typeof duration === "number" && duration > RECOMMENDED_MAX_DURATION_SECONDS) {
      nextWarnings.push("Video longue: vise 6-12 secondes pour une boucle fluide.");
    }

    return nextWarnings;
  };

  const uploadVideo = async (file: File) => {
    setError(null);
    setIsUploading(true);

    try {
      // Step 1: Get a signed upload URL from the server (lightweight JSON request).
      const signedUrlRes = await fetch("/api/admin/products/video/signed-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, fileSize: file.size }),
      });

      const signedUrlData = (await signedUrlRes.json().catch(() => null)) as
        | { signedUrl?: string; token?: string; publicUrl?: string; contentType?: string; error?: string }
        | null;

      if (!signedUrlRes.ok || !signedUrlData?.signedUrl) {
        setError(signedUrlData?.error ?? "Impossible de preparer l'upload.");
        return;
      }

      // Step 2: Upload the file directly to Supabase Storage (bypasses Vercel body limit).
      const uploadRes = await fetch(signedUrlData.signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": signedUrlData.contentType ?? file.type,
        },
        body: file,
      });

      if (!uploadRes.ok) {
        const detail = await uploadRes.text().catch(() => "");
        setError(`Echec de l'envoi video (${uploadRes.status}). ${detail}`.trim());
        return;
      }

      if (!signedUrlData.publicUrl) {
        setError("URL publique video indisponible.");
        return;
      }

      onChange(signedUrlData.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Echec de l'envoi video.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="grid gap-2">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-charcoal">
        Video fiche produit (courte, bouclee et compressee)
      </p>
      {value ? (
        <div className="grid gap-2 rounded-[12px] border-2 border-[#1a1a1a] bg-[#f7f4ee] p-3">
          <video
            src={value}
            className="h-40 w-full rounded-[10px] border border-[#1a1a1a] object-cover"
            muted
            loop
            playsInline
            autoPlay
            preload="metadata"
          />
          <button
            type="button"
            className="btn-cartoon btn-secondary h-9 px-3 text-xs"
            onClick={() => onChange(undefined)}
            disabled={isUploading}
          >
            Supprimer la video
          </button>
        </div>
      ) : (
        <label className="flex h-11 cursor-pointer items-center justify-center rounded-[10px] border-2 border-dashed border-[#1a1a1a] bg-white text-xs font-semibold uppercase tracking-[0.08em] text-charcoal">
          <input
            type="file"
            accept="video/mp4,video/quicktime"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void (async () => {
                  const nextWarnings = await buildVideoWarnings(file);
                  setWarnings(nextWarnings);
                  await uploadVideo(file);
                })();
                event.currentTarget.value = "";
              }
            }}
            disabled={isUploading}
          />
          {isUploading ? "Upload..." : "Ajouter une video"}
        </label>
      )}

      {error && (
        <p className="text-xs font-semibold text-red-700">{error}</p>
      )}
      {warnings.length > 0 && !error && (
        <div className="rounded-[10px] border-2 border-[#1a1a1a] bg-[#fff7e4] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink">
            Recommandations avant publication
          </p>
          <ul className="mt-1 grid gap-1 text-[11px] text-charcoal">
            {warnings.map((warning) => (
              <li key={warning}>- {warning}</li>
            ))}
          </ul>
        </div>
      )}
      {!error && (
        <div className="rounded-[10px] border-2 border-[#1a1a1a] bg-[#f7f4ee] p-3 text-[11px] text-charcoal">
          <p className="font-semibold uppercase tracking-[0.08em] text-ink">Guide upload (qualite/perf)</p>
          <ul className="mt-1 grid gap-1">
            <li>- Format: MP4 (H.264 + AAC)</li>
            <li>- Resolution conseillee: 720p</li>
            <li>- Duree conseillee: 6-12 secondes</li>
            <li>- Taille conseillee: &lt; 12 Mo</li>
            <li>- iPhone .MOV accepte (compatibilite lecture selon navigateur)</li>
            <li>- Astuce: preset HandBrake &quot;Fast 720p30&quot;</li>
          </ul>
        </div>
      )}
    </div>
  );
}
