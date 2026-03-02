"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import {
  PRODUCT_ANALYSIS_ACCEPT_ATTRIBUTE,
  PRODUCT_ANALYSIS_UPLOAD_MAX_BYTES,
  isSupportedProductAnalysisMimeType,
} from "@/lib/product-analysis-policy";

type ProductAnalysisUploadProps = {
  value?: string;
  onChange: (nextAnalysisPath: string | undefined) => void;
};

function formatMaxSizeLabel(): string {
  const maxSizeMb = PRODUCT_ANALYSIS_UPLOAD_MAX_BYTES / (1024 * 1024);
  return `${maxSizeMb.toFixed(0)} Mo max`;
}

export function ProductAnalysisUpload({ value, onChange }: ProductAnalysisUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const validateClientFile = (file: File): string | null => {
    if (
      file.type &&
      !isSupportedProductAnalysisMimeType(file.type.toLowerCase())
    ) {
      return "Format non autorise. Utilise un PDF.";
    }

    if (file.size <= 0) {
      return "Le fichier est vide.";
    }

    if (file.size > PRODUCT_ANALYSIS_UPLOAD_MAX_BYTES) {
      return `Fichier trop volumineux (${formatMaxSizeLabel()}).`;
    }

    return null;
  };

  const uploadFile = async (file: File) => {
    if (isUploading) {
      return;
    }

    const validationError = validateClientFile(file);
    if (validationError) {
      setNotice(null);
      setError(validationError);
      return;
    }

    setIsUploading(true);
    setError(null);
    setNotice(null);

    try {
      const formData = new FormData();
      formData.set("file", file);

      const response = await fetch("/api/admin/products/analysis/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Echec de l'envoi du PDF.");
        return;
      }

      const payload = (await response.json()) as { analysisPath?: string };
      if (!payload.analysisPath) {
        setError("Reponse serveur invalide.");
        return;
      }

      onChange(payload.analysisPath);
      setNotice("PDF uploade. Clique sur Sauvegarder pour enregistrer le produit.");
    } catch {
      setError("Echec de l'envoi du PDF.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSelectClick = () => {
    inputRef.current?.click();
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    void uploadFile(file);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }

    void uploadFile(file);
  };

  return (
    <div className="grid gap-3">
      <div
        className={`rounded border-2 border-dashed p-3 text-sm ${
          isDragging ? "border-[#0a7b61] bg-[#e8f7f2]" : "border-[#1a1a1a] bg-[#f7f4ee]"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-charcoal">Analyse PDF: clic ou glisser/deposer</p>
          <button
            type="button"
            className="btn-cartoon btn-secondary"
            onClick={handleSelectClick}
            disabled={isUploading}
          >
            {isUploading ? "Envoi..." : "Choisir un PDF"}
          </button>
        </div>
        <p className="mt-2 text-xs text-charcoal">
          PDF uniquement - {formatMaxSizeLabel()} - l&apos;adresse postale detectee est masquee
          automatiquement.
        </p>
        <p className="mt-1 text-[11px] text-charcoal/80">
          Les PDF image/scannes sans texte exploitable sont refuses pour securite.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={PRODUCT_ANALYSIS_ACCEPT_ATTRIBUTE}
          className="hidden"
          onChange={handleInputChange}
        />
      </div>

      <div className="grid gap-2 md:grid-cols-[1fr,auto,auto] md:items-center">
        <input
          className="h-10 border-2 border-[#1a1a1a] bg-white px-2 text-xs text-charcoal"
          value={value ?? ""}
          readOnly
          placeholder="Aucun PDF d'analyse"
          aria-label="Chemin PDF analyse"
        />
        <a
          href={value || "#"}
          target="_blank"
          rel="noreferrer"
          className={`btn-cartoon btn-secondary h-10 px-3 text-xs ${
            value ? "" : "pointer-events-none opacity-50"
          }`}
        >
          Ouvrir
        </a>
        <button
          type="button"
          className="btn-cartoon btn-primary h-10 px-3 text-xs"
          disabled={!value}
          onClick={() => {
            setError(null);
            setNotice(null);
            onChange(undefined);
          }}
        >
          Retirer
        </button>
      </div>

      {notice && <p className="text-xs font-semibold text-[#0a7b61]">{notice}</p>}
      {error && <p className="text-xs font-semibold text-[#9f1d1d]">{error}</p>}
    </div>
  );
}

