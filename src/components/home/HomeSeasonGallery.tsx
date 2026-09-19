"use client";

import Image from "next/image";
import styles from "./HomeSeasonGallery.module.css";
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
      className={styles.section}
      style={{ zIndex }}
    >
      <div className="retro-container">
        <div className={styles.panel}>
          <p className={styles.eyebrow}>Au rythme des saisons</p>
          <h2 className={styles.title}>{title}</h2>

          <div className={styles.grid}>
            <div className={styles.portrait}>
              <div className={styles.portraitFrame}>
                <Image
                  src={decorativeBackgroundSrc}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 230px, 270px"
                  className={styles.backdrop}
                  aria-hidden="true"
                />
                <div className={styles.mascotStage}>
                  <div className={styles.mascot}>
                    <Image
                      src={mascotSrc}
                      alt="Sylvain"
                      fill
                      sizes="(max-width: 768px) 230px, 270px"
                      className="object-contain object-center"
                    />
                  </div>
                </div>
              </div>
            </div>

            {galleryImages.length === 0 ? (
              <div className={styles.empty}>
                Aucune photo de culture pour le moment.
              </div>
            ) : (
              <ProductImageCarousel
                images={galleryImages}
                alt="Cultures de la saison"
                className={styles.carousel}
                sizes="(max-width: 1024px) 94vw, 56vw"
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
