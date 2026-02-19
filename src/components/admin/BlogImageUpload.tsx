"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import Image from "next/image";
import {
  BLOG_IMAGE_ACCEPT_ATTRIBUTE,
  BLOG_IMAGE_UPLOAD_MAX_BYTES,
  isSupportedBlogImageMimeType,
} from "@/lib/blog-image-policy";

type BlogImageUploadProps = {
  value: string;
  onChange: (nextImagePath: string) => void;
};

function formatMaxSizeLabel(): string {
  const maxSizeMb = BLOG_IMAGE_UPLOAD_MAX_BYTES / (1024 * 1024);
  return `${maxSizeMb.toFixed(0)} Mo max`;
}

export function BlogImageUpload({ value, onChange }: BlogImageUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateClientFile = (file: File): string | null => {
    if (!isSupportedBlogImageMimeType(file.type)) {
      return "Format non autorise. Utilise JPG, PNG ou WEBP.";
    }

    if (file.size <= 0) {
      return "Le fichier est vide.";
    }

    if (file.size > BLOG_IMAGE_UPLOAD_MAX_BYTES) {
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
      setError(validationError);
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("file", file);

      const response = await fetch("/api/admin/blog/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Echec de l'envoi de l'image.");
        return;
      }

      const payload = (await response.json()) as { imagePath?: string };
      if (!payload.imagePath) {
        setError("Reponse serveur invalide.");
        return;
      }

      onChange(payload.imagePath);
    } catch {
      setError("Echec de l'envoi de l'image.");
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
          <p className="text-charcoal">Image de couverture: clic ou glisser/deposer</p>
          <button
            type="button"
            className="btn-cartoon btn-secondary"
            onClick={handleSelectClick}
            disabled={isUploading}
          >
            {isUploading ? "Envoi..." : "Choisir une image"}
          </button>
        </div>
        <p className="mt-2 text-xs text-charcoal">JPG, PNG, WEBP - {formatMaxSizeLabel()}</p>
        <input
          ref={inputRef}
          type="file"
          accept={BLOG_IMAGE_ACCEPT_ATTRIBUTE}
          className="hidden"
          onChange={handleInputChange}
        />
      </div>

      <div className="grid gap-2 md:grid-cols-[120px,1fr]">
        <div className="relative h-[90px] overflow-hidden rounded border-2 border-[#1a1a1a] bg-white">
          {value ? (
            <Image src={value} alt="Apercu image de couverture" fill sizes="120px" className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-charcoal">
              Sans image
            </div>
          )}
        </div>
        <input
          className="h-10 border-2 border-[#1a1a1a] bg-white px-2 text-xs text-charcoal"
          value={value}
          readOnly
          aria-label="Chemin image de couverture"
        />
      </div>

      {error && <p className="text-xs font-semibold text-[#9f1d1d]">{error}</p>}
    </div>
  );
}

