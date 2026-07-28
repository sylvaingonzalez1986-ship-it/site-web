"use client";

import Link from "next/link";
import { KanabQuestDicePrototype } from "./KanabQuestDicePrototype";
import { KqSupportBoosterShop } from "./KqSupportBoosterShop";

export function PlacardPlayerShell() {
  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="px-4 pt-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-charcoal">
              Kanab Quest · L’Arène
            </p>
            <h1 className="mt-2 font-display text-5xl uppercase leading-none md:text-7xl">
              Le Placard
            </h1>
            <p className="mt-3 max-w-2xl font-semibold text-charcoal">
              Compose ton deck depuis ton album, conduis six étapes aux dés puis présente ta Fleur au jury.
            </p>
          </div>
          <Link
            href="/arene"
            className="border-2 border-ink bg-white px-5 py-3 font-black uppercase shadow-[3px_3px_0_#1a1a1a]"
          >
            Retour à L’Arène
          </Link>
        </div>
      </header>
      <KqSupportBoosterShop />
      <KanabQuestDicePrototype apiScope="player" />
    </div>
  );
}
