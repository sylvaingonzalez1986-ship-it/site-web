"use client";

import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import Image from "next/image";
import {
  PRODUCT_IMAGE_ACCEPT_ATTRIBUTE,
  PRODUCT_IMAGE_MAX_COUNT,
  PRODUCT_IMAGE_UPLOAD_MAX_BYTES,
  isSupportedProductImageMimeType,
} from "@/lib/product-image-policy";

type ProductImageUploadProps = {
  images?: string[];
  onChange: (nextImagePaths: string[]) => void;
};

function formatMaxSizeLabel(): string {
  const maxSizeMb = PRODUCT_IMAGE_UPLOAD_MAX_BYTES / (1024 * 1024);
  return `${maxSizeMb.toFixed(0)} Mo max`;
}

function sanitizeImagePaths(images: string[] | undefined): string[] {
  if (!images || images.length === 0) {
    return [];
  }

  const isSupportedPath = (value: string): boolean => {
    if (value.startsWith("/")) {
      return /\.(jpg|jpeg|png|webp)$/i.test(value);
    }

    try {
      const url = new URL(value);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return false;
      }
      return /\.(jpg|jpeg|png|webp)$/i.test(url.pathname);
    } catch {
      return false;
    }
  };

  const unique: string[] = [];
  for (const path of images) {
    if (!path || !isSupportedPath(path)) {
      continue;
    }

    if (unique.includes(path)) {
      continue;
    }

    unique.push(path);

    if (unique.length >= PRODUCT_IMAGE_MAX_COUNT) {
      break;
    }
  }

  return unique;
}

export function ProductImageUpload({ images, onChange }: ProductImageUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentImages = useMemo(() => sanitizeImagePaths(images), [images]);
  const hasCapacity = currentImages.length < PRODUCT_IMAGE_MAX_COUNT;

  const validateClientFile = (file: File): string | null => {
    if (!isSupportedProductImageMimeType(file.type)) {
      return "Format non autorise. Utilise JPG, PNG ou WEBP.";
    }

    if (file.size <= 0) {
      return "Le fichier est vide.";
    }

    if (file.size > PRODUCT_IMAGE_UPLOAD_MAX_BYTES) {
      return `Fichier trop volumineux (${formatMaxSizeLabel()}).`;
    }

    return null;
  };

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) {
      return;
    }

    if (isUploading) {
      return;
    }

    let nextImages = [...currentImages];
    setIsUploading(true);
    setError(null);

    try {
      for (const file of files) {
        if (nextImages.length >= PRODUCT_IMAGE_MAX_COUNT) {
          setError(`Maximum ${PRODUCT_IMAGE_MAX_COUNT} images par produit.`);
          break;
        }

        const validationError = validateClientFile(file);
        if (validationError) {
          setError(validationError);
          break;
        }

        const formData = new FormData();
        formData.set("file", file);

        const response = await fetch("/api/admin/products/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          setError(payload?.error ?? "Echec de l'envoi de l'image.");
          break;
        }

        const payload = (await response.json()) as { imagePath?: string };
        if (!payload.imagePath) {
          setError("Reponse serveur invalide.");
          break;
        }

        nextImages = sanitizeImagePaths([...nextImages, payload.imagePath]);
        onChange(nextImages);
      }
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
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    void uploadFiles(files);
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
    const files = Array.from(event.dataTransfer.files ?? []);

    void uploadFiles(files);
  };

  const handleRemoveImage = (index: number) => {
    const nextImages = currentImages.filter((_, imageIndex) => imageIndex !== index);
    onChange(nextImages);
    setError(null);
  };

  const handleSetPrimary = (index: number) => {
    const selected = currentImages[index];
    if (!selected) {
      return;
    }

    const rest = currentImages.filter((_, imageIndex) => imageIndex !== index);
    onChange([selected, ...rest]);
    setError(null);
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
          <p className="text-charcoal">
            Images produit: clic ou glisser/deposer ({currentImages.length}/{PRODUCT_IMAGE_MAX_COUNT})
          </p>
          <button
            type="button"
            className="btn-cartoon btn-secondary"
            onClick={handleSelectClick}
            disabled={isUploading || !hasCapacity}
          >
            {isUploading ? "Envoi..." : "Choisir une image"}
          </button>
        </div>
        <p className="mt-2 text-xs text-charcoal">JPG, PNG, WEBP - {formatMaxSizeLabel()}</p>
        <input
          ref={inputRef}
          type="file"
          accept={PRODUCT_IMAGE_ACCEPT_ATTRIBUTE}
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {Array.from({ length: PRODUCT_IMAGE_MAX_COUNT }).map((_, index) => {
          const imagePath = currentImages[index];
          if (!imagePath) {
            return (
              <div
                key={`empty-${index}`}
                className="flex h-28 items-center justify-center rounded border-2 border-dashed border-[#1a1a1a] bg-white text-xs text-charcoal"
              >
                Emplacement {index + 1}
              </div>
            );
          }

          return (
            <div key={imagePath} className="rounded border-2 border-[#1a1a1a] bg-white p-2">
              <div className="relative h-20 overflow-hidden rounded border border-[#1a1a1a]">
                <Image
                  src={imagePath}
                  alt={`Image produit ${index + 1}`}
                  fill
                  sizes="160px"
                  className="object-cover"
                />
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="btn-cartoon btn-secondary h-8 px-2 text-[10px]"
                  disabled={index === 0}
                  onClick={() => handleSetPrimary(index)}
                >
                  {index === 0 ? "Principale" : "Definir principale"}
                </button>
                <button
                  type="button"
                  className="btn-cartoon btn-primary h-8 px-2 text-[10px]"
                  onClick={() => handleRemoveImage(index)}
                >
                  Supprimer
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {error && <p className="text-xs font-semibold text-[#9f1d1d]">{error}</p>}
    </div>
  );
}
