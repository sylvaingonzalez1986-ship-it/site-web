"use client";

import { useState } from "react";
import { IPhoneMockup } from "@/components/application/IPhoneMockup";

const APP_SCREEN_ITEMS = [
  {
    id: "market",
    src: "/app/screens/market-list.png",
    alt: "Screenshot Les Chanvriers Unis - Marché local",
    title: "Marché Local",
    caption: "Sélection de département et producteurs",
  },
  {
    id: "lottery",
    src: "/app/screens/lottery.png",
    alt: "Screenshot Les Chanvriers Unis - Tirage",
    title: "Tirage",
    caption: "Système de raretés et tickets",
  },
  {
    id: "producer",
    src: "/app/screens/producer-card.png",
    alt: "Screenshot Les Chanvriers Unis - Fiche producteur",
    title: "Fiche Producteur",
    caption: "Profil détaillé et produits en direct",
  },
] as const;

export function AppScreensShowcase() {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="cartoon-border app-showcase bg-cream p-6 md:p-8">
      <div className="mb-6 md:mb-8">
        <p className="pill-cartoon px-4 py-2 text-xs uppercase tracking-[0.12em]">
          Expérience mobile
        </p>
        <h2 className="mt-4 font-display text-3xl text-ink md:text-4xl">Les Chanvriers Unis en action</h2>
        <p className="mt-2 max-w-2xl text-sm text-charcoal md:text-base">
          Une mise en scène claire du parcours client: marché local, tirage et fiche producteur.
        </p>
      </div>

      <div
        className={`app-showcase-row hidden min-h-[620px] items-end justify-center gap-5 lg:flex ${
          hoveredId ? "has-hover" : ""
        }`}
      >
        {APP_SCREEN_ITEMS.map((item, index) => (
          <div
            key={item.id}
            className="app-showcase-slot"
            onMouseEnter={() => setHoveredId(item.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <IPhoneMockup
              src={item.src}
              alt={item.alt}
              title={item.title}
              caption={item.caption}
              priority={index === 1}
              className={`app-showcase-phone ${
                hoveredId === item.id
                  ? "is-active"
                  : hoveredId
                    ? "is-inactive"
                    : ""
              }`}
            />
          </div>
        ))}
      </div>

      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 lg:hidden">
        {APP_SCREEN_ITEMS.map((item, index) => (
          <IPhoneMockup
            key={item.id}
            src={item.src}
            alt={item.alt}
            title={item.title}
            caption={item.caption}
            priority={index === 0}
            className="min-w-[78vw] snap-center sm:min-w-[58vw]"
          />
        ))}
      </div>
    </div>
  );
}
