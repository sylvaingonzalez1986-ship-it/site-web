"use client";

import Image from "next/image";
import { useMemo } from "react";
import { ProductImageCarousel } from "@/components/boutique/ProductImageCarousel";

type HomeSeasonGalleryProps = {
  title: string;
  images: string[];
  zIndex: number;
  decorativeBackgroundSrc: string;
  mascotSrc: string;
};

export function HomeSeasonGallery({
  title,
  images,
  zIndex,
  decorativeBackgroundSrc,
  mascotSrc,
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

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(230px,300px)_1fr] lg:items-center">
            <div className="relative mx-auto h-[230px] w-[230px] sm:h-[270px] sm:w-[270px]">
              <div className="absolute -left-2 -top-2 h-full w-full rounded-[2rem] border-2 border-[#1a1a1a]/80 bg-[#ead6b6]" />
              <div className="absolute inset-0 overflow-hidden rounded-[2rem] border-[3px] border-[#1a1a1a] bg-[#f7f4ee] shadow-[6px_6px_0_rgba(26,26,26,0.2)]">
                <Image
                  src={decorativeBackgroundSrc}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 230px, 270px"
                  className="absolute inset-0 object-cover"
                  aria-hidden="true"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a]/20 via-transparent to-transparent" />
                <div className="absolute inset-0 z-10 grid place-items-center p-3">
                  <div className="season-sylvain-animate relative h-[84%] w-[84%]">
                    <Image
                      src={mascotSrc}
                      alt="Sylvain"
                      fill
                      sizes="(max-width: 768px) 230px, 270px"
                      className="object-contain object-center drop-shadow-[0_10px_12px_rgba(26,26,26,0.28)]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {galleryImages.length === 0 ? (
              <div className="border-2 border-dashed border-[#1a1a1a] bg-white p-6 text-sm font-semibold text-charcoal">
                Aucune photo de culture pour le moment.
              </div>
            ) : (
              <ProductImageCarousel
                images={galleryImages}
                alt="Cultures de la saison"
                className="aspect-[16/9] border-2 border-[#1a1a1a] bg-white"
                sizes="(max-width: 1024px) 94vw, 56vw"
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
