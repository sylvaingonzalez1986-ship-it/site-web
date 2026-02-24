"use client";

import { useMemo } from "react";
import { ProductImageCarousel } from "@/components/boutique/ProductImageCarousel";

type HomeSeasonGalleryProps = {
  title: string;
  images: string[];
  zIndex: number;
};

export function HomeSeasonGallery({
  title,
  images,
  zIndex,
}: HomeSeasonGalleryProps) {
  const galleryImages = useMemo(() => {
    const uniqueImages: string[] = [];
    const seen = new Set<string>();

    for (const rawImage of images) {
      const image = rawImage.trim();
      if (!image || seen.has(image)) {
        continue;
      }

      seen.add(image);
      uniqueImages.push(image);
    }

    return uniqueImages;
  }, [images]);

  return (
    <section
      id="cultures-saison"
      className="section-band bg-cream halftone-overlay paper-grain"
      style={{ zIndex }}
    >
      <div className="retro-container">
        <div className="cartoon-border bg-[#f1eee7] p-6 md:p-8">
          <h2 className="section-title text-ink">{title}</h2>

          {galleryImages.length === 0 ? (
            <div className="mt-6 border-2 border-dashed border-[#1a1a1a] bg-white p-6 text-sm font-semibold text-charcoal">
              Aucune photo de culture pour le moment.
            </div>
          ) : (
            <div className="mt-6 w-full md:mx-auto md:w-1/2">
              <ProductImageCarousel
                images={galleryImages}
                alt="Cultures de la saison"
                className="aspect-[16/9] border-2 border-[#1a1a1a] bg-white"
                sizes="(max-width: 768px) 94vw, 39vw"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}


