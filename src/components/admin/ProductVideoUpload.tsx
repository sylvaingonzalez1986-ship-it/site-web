"use client";

import { useState } from "react";

type ProductVideoUploadProps = {
  value?: string;
  onChange: (nextVideoUrl: string | undefined) => void;
};

export function ProductVideoUpload({ value, onChange }: ProductVideoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadVideo = async (file: File) => {
    setError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/admin/products/video/upload", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json().catch(() => null)) as
        | { path?: string; error?: string }
        | null;

      if (!response.ok || !data?.path) {
        setError(data?.error ?? "Echec de l'envoi video.");
        return;
      }

      onChange(data.path);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="grid gap-2">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-charcoal">
        Video produit (2-3s, boucle)
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
                void uploadVideo(file);
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
    </div>
  );
}
