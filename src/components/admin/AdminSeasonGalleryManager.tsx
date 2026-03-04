"use client";

import { useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import {
  BLOG_IMAGE_ACCEPT_ATTRIBUTE,
  BLOG_IMAGE_UPLOAD_MAX_BYTES,
  isSupportedBlogImageMimeType,
} from "@/lib/blog-image-policy";
import type { CmsStore } from "@/types/store";

const MAX_SEASON_GALLERY_IMAGES = 12;

type AdminSeasonGalleryManagerProps = {
  draft: CmsStore;
  setDraft: Dispatch<SetStateAction<CmsStore>>;
};

function formatMaxSizeLabel(): string {
  const maxSizeMb = BLOG_IMAGE_UPLOAD_MAX_BYTES / (1024 * 1024);
  return `${maxSizeMb.toFixed(0)} Mo max`;
}

function buildUniqueImages(images: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const raw of images) {
    const value = raw.trim();
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    unique.push(value);
  }

  return unique.slice(0, MAX_SEASON_GALLERY_IMAGES);
}

export function AdminSeasonGalleryManager({
  draft,
  setDraft,
}: AdminSeasonGalleryManagerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState("");

  const seasonGalleryImages = buildUniqueImages(
    Array.isArray(draft.content.home.seasonGalleryImages)
      ? draft.content.home.seasonGalleryImages
      : [],
  );

  const updateSeasonGalleryImages = (nextImages: string[]) => {
    setDraft((current) => ({
      ...current,
      content: {
        ...current.content,
        home: {
          ...current.content.home,
          seasonGalleryImages: buildUniqueImages(nextImages),
        },
      },
    }));
  };

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

  const uploadFiles = async (files: File[]) => {
    if (isUploading || files.length === 0) {
      return;
    }

    if (seasonGalleryImages.length >= MAX_SEASON_GALLERY_IMAGES) {
      setError(`Limite atteinte: ${MAX_SEASON_GALLERY_IMAGES} images maximum.`);
      return;
    }

    setIsUploading(true);
    setError(null);

    const addedUrls: string[] = [];

    try {
      for (const file of files) {
        if (seasonGalleryImages.length + addedUrls.length >= MAX_SEASON_GALLERY_IMAGES) {
          break;
        }

        const validationError = validateClientFile(file);
        if (validationError) {
          setError(validationError);
          continue;
        }

        const formData = new FormData();
        formData.set("file", file);

        const response = await fetch("/api/admin/blog/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          setError(payload?.error ?? "Echec de l'envoi d'une image.");
          continue;
        }

        const payload = (await response.json()) as { imagePath?: string };
        if (!payload.imagePath) {
          setError("Reponse serveur invalide pour une image.");
          continue;
        }

        addedUrls.push(payload.imagePath);
      }

      if (addedUrls.length > 0) {
        updateSeasonGalleryImages([...seasonGalleryImages, ...addedUrls]);
      }
    } catch {
      setError("Echec de l'envoi des images.");
    } finally {
      setIsUploading(false);
    }
  };

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    void uploadFiles(files);
  };

  const removeImage = (index: number) => {
    updateSeasonGalleryImages(seasonGalleryImages.filter((_, currentIndex) => currentIndex !== index));
  };

  const moveImage = (index: number, delta: number) => {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= seasonGalleryImages.length) {
      return;
    }

    const nextImages = [...seasonGalleryImages];
    const [movedImage] = nextImages.splice(index, 1);
    nextImages.splice(nextIndex, 0, movedImage);
    updateSeasonGalleryImages(nextImages);
  };

  const addManualUrl = () => {
    const value = manualUrl.trim();
    if (!value) {
      return;
    }
    updateSeasonGalleryImages([...seasonGalleryImages, value]);
    setManualUrl("");
  };

  return (
    <section className="cartoon-border bg-cream p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-3xl">Cultures de la saison</h2>
        <button
          type="button"
          className="btn-cartoon btn-secondary"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading || seasonGalleryImages.length >= MAX_SEASON_GALLERY_IMAGES}
        >
          {isUploading ? "Envoi..." : "Ajouter des images"}
        </button>
      </div>

      <p className="mt-2 text-sm text-charcoal">
        {seasonGalleryImages.length}/{MAX_SEASON_GALLERY_IMAGES} images. Pense a cliquer sur
        &quot;Sauvegarder&quot; en haut apres modification.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept={BLOG_IMAGE_ACCEPT_ATTRIBUTE}
        multiple
        className="hidden"
        onChange={onInputChange}
      />

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr,auto]">
        <input
          className="h-10 border-2 border-[#1a1a1a] bg-white px-3 text-sm"
          placeholder="Ajouter une URL image (optionnel)"
          value={manualUrl}
          onChange={(event) => setManualUrl(event.target.value)}
        />
        <button type="button" className="btn-cartoon btn-secondary" onClick={addManualUrl}>
          Ajouter URL
        </button>
      </div>

      {error && <p className="mt-3 text-xs font-semibold text-[#9f1d1d]">{error}</p>}

      <div className="mt-5 grid gap-3">
        {seasonGalleryImages.length === 0 ? (
          <div className="rounded border-2 border-dashed border-[#1a1a1a] bg-white p-4 text-sm text-charcoal">
            Aucune image configuree pour le moment.
          </div>
        ) : (
          seasonGalleryImages.map((image, index) => (
            <article key={`${image}-${index}`} className="rounded border-2 border-[#1a1a1a] bg-white p-3">
              <div className="grid gap-3 md:grid-cols-[120px_1fr_auto] md:items-center">
                <div className="relative h-[90px] overflow-hidden rounded border-2 border-[#1a1a1a] bg-[#f7f4ee]">
                  <img
                    src={image}
                    alt={`Culture saison ${index + 1}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <input
                  className="h-10 border-2 border-[#1a1a1a] bg-white px-2 text-xs text-charcoal"
                  value={image}
                  readOnly
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-cartoon btn-secondary h-10 px-3"
                    onClick={() => moveImage(index, -1)}
                    disabled={index === 0}
                  >
                    Monter
                  </button>
                  <button
                    type="button"
                    className="btn-cartoon btn-secondary h-10 px-3"
                    onClick={() => moveImage(index, 1)}
                    disabled={index === seasonGalleryImages.length - 1}
                  >
                    Descendre
                  </button>
                  <button
                    type="button"
                    className="btn-cartoon btn-primary h-10 px-3"
                    onClick={() => removeImage(index)}
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
