"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Gamepad2, ShoppingBag, Swords } from "lucide-react";
import { useState } from "react";

function PlacardViewLoading() {
  return (
    <div className="mx-auto grid min-h-[55vh] max-w-6xl place-items-center px-4 py-12" role="status">
      <span className="border-2 border-ink bg-white px-5 py-4 font-black uppercase shadow-[4px_4px_0_#111]">
        Chargement…
      </span>
    </div>
  );
}

const KanabQuestDicePrototype = dynamic(
  () => import("./KanabQuestDicePrototype").then((module) => module.KanabQuestDicePrototype),
  { loading: PlacardViewLoading },
);
const KqSupportBoosterShop = dynamic(
  () => import("./KqSupportBoosterShop").then((module) => module.KqSupportBoosterShop),
  { loading: PlacardViewLoading },
);

type PlacardView = "hub" | "shop" | "game" | "arena";

const HUB_DESTINATIONS = [
  {
    id: "shop" as const,
    number: "01",
    eyebrow: "Collection",
    title: "La Boutique",
    image: "/placard/booster-shop-front-v2.webp",
    imageClassName: "object-cover object-center",
    icon: ShoppingBag,
    accent: "bg-yellow",
  },
  {
    id: "game" as const,
    number: "02",
    eyebrow: "Culture",
    title: "Le Jeu",
    image: "/sylvain-culture-hero.webp",
    imageClassName: "object-contain object-center p-3 sm:p-5",
    icon: Gamepad2,
    accent: "bg-mint",
  },
  {
    id: "arena" as const,
    number: "03",
    eyebrow: "Compétition",
    title: "Fleur vs Fleur",
    image: "/contest/mascot/arena-duo.webp",
    imageClassName: "object-contain object-center p-3 sm:p-5",
    icon: Swords,
    accent: "bg-[#167d6b]",
  },
];

export function PlacardPlayerShell() {
  const [view, setView] = useState<PlacardView>("hub");

  if (view !== "hub") {
    const currentTitle =
      view === "shop" ? "La Boutique" : view === "game" ? "Le Jeu" : "Fleur vs Fleur";

    return (
      <div className="min-h-screen bg-cream text-ink">
        <nav className="sticky top-0 z-[80] border-b-2 border-ink bg-cream/95 px-3 py-3 backdrop-blur sm:px-5" aria-label="Navigation du Placard">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setView("hub")}
              className="pointer-events-auto inline-flex min-h-11 touch-manipulation items-center gap-2 border-2 border-ink bg-white px-3 font-black uppercase shadow-[3px_3px_0_#111] transition hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#111]"
            >
              <ArrowLeft aria-hidden="true" size={18} strokeWidth={3} />
              <span className="hidden sm:inline">Retour au Placard</span>
              <span className="sm:hidden">Placard</span>
            </button>
            <p className="truncate font-display text-xl uppercase sm:text-2xl">{currentTitle}</p>
            <Link
              href="/arene"
              className="hidden min-h-11 items-center border-2 border-ink bg-white px-3 font-black uppercase shadow-[3px_3px_0_#111] transition hover:-translate-y-0.5 sm:inline-flex"
            >
              L’Arène
            </Link>
          </div>
        </nav>

        {view === "shop" ? (
          <KqSupportBoosterShop autoOpen onExit={() => setView("hub")} />
        ) : (
          <KanabQuestDicePrototype
            apiScope="player"
            viewMode={view === "arena" ? "arena" : "game"}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="border-b-2 border-ink px-4 py-6 sm:py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-charcoal">
              Kanab Quest · L’Arène
            </p>
            <h1 className="mt-2 font-display text-5xl uppercase leading-[0.9] md:text-7xl">
              Le Placard
            </h1>
          </div>
          <Link
            href="/arene"
            className="inline-flex min-h-12 items-center border-2 border-ink bg-white px-5 font-black uppercase shadow-[4px_4px_0_#111] transition hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#111]"
          >
            Retour à L’Arène
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-7 sm:py-10">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#167d6b]">3 espaces</p>
            <h2 className="mt-1 font-display text-3xl uppercase leading-none sm:text-4xl">
              Que veux-tu faire ?
            </h2>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {HUB_DESTINATIONS.map((destination) => {
            const Icon = destination.icon;
            return (
              <button
                key={destination.id}
                type="button"
                onClick={() => setView(destination.id)}
                className="group grid grid-cols-[118px_1fr] overflow-hidden border-2 border-ink bg-white text-left shadow-[5px_5px_0_#111] transition duration-200 hover:-translate-y-1 hover:shadow-[8px_8px_0_#111] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[#167d6b] sm:grid-cols-[160px_1fr] md:block"
                aria-label={`Ouvrir ${destination.title}`}
              >
                <span className={`relative block min-h-36 overflow-hidden border-r-2 border-ink md:aspect-[16/10] md:min-h-0 md:border-b-2 md:border-r-0 ${destination.accent}`}>
                  <Image
                    src={destination.image}
                    alt=""
                    fill
                    sizes="(max-width: 767px) 100vw, 33vw"
                    className={`${destination.imageClassName} transition duration-300 group-hover:scale-[1.04]`}
                  />
                  <span className="absolute left-2 top-2 grid h-9 w-9 place-items-center border-2 border-ink bg-white shadow-[2px_2px_0_#111] md:left-3 md:top-3 md:h-11 md:w-11 md:shadow-[3px_3px_0_#111]">
                    <Icon aria-hidden="true" size={20} strokeWidth={2.7} />
                  </span>
                  <span className="absolute bottom-2 left-2 border-2 border-ink bg-ink px-2 py-1 text-[10px] font-black text-white md:bottom-auto md:left-auto md:right-3 md:top-3 md:text-xs">
                    {destination.number}
                  </span>
                </span>

                <span className="flex min-h-36 flex-col p-3 sm:p-4 md:min-h-40 md:p-5">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-[#167d6b]">
                    {destination.eyebrow}
                  </span>
                  <span className="mt-1 font-display text-2xl uppercase leading-none md:text-3xl">
                    {destination.title}
                  </span>
                  <span className="mt-auto pt-2 text-xs font-black uppercase md:pt-4 md:text-sm">
                    Ouvrir <span aria-hidden="true">→</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
