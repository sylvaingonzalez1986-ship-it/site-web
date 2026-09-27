import { createElement, type AnchorHTMLAttributes, type ImgHTMLAttributes } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ContestArenaHub } from "./ContestArenaHub";
import { ARENA_LOBBY_MODES } from "@/lib/arena-lobby";
import { ARENA_OPENING_MESSAGE } from "@/lib/arena-opening";

vi.mock("@/components/navigation/NavigationLink", () => ({ default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => createElement("a", props) }));
vi.mock("next/image", () => ({
  default: ({ src, alt }: ImgHTMLAttributes<HTMLImageElement>) => createElement("img", { src, alt }),
}));
vi.mock("./ArenaJourneyEntry", () => ({ ArenaJourneyEntry: () => createElement("div", { "data-inline-account": true }, "Ma carte · Aide") }));
vi.mock("./ArenaPrelaunchCharacter", () => ({ ArenaPrelaunchCharacter: () => createElement("button", {}, "Créer mon personnage") }));

describe("Arena home", () => {
  it("offers three direct activity links without a preview or second entry action", () => {
    const html = renderToStaticMarkup(createElement(ContestArenaHub));
    for (const [id, mode] of Object.entries(ARENA_LOBBY_MODES)) {
      expect(html).toMatch(new RegExp(`<a[^>]*data-arena-activity="${id}"[^>]*href="${mode.href.replace("?", "\\?")}"`));
    }
    expect(html.match(/data-arena-activity=/g)).toHaveLength(3);
    expect(html).toContain("Déguster");
    expect(html).toContain("Cultiver");
    expect(html).toContain("Voir le classement");
    expect(html).toContain("Ma carte · Aide");
    expect(html).toContain("Des fleurs à gagner en fin de saison");
    expect(html).not.toContain("data-lobby-enter");
    expect(html).not.toContain("aria-pressed");
    expect(html).not.toContain("Pack des Pionniers");
    expect(html).not.toContain("Mes missions");
  });

  it.each(["jouer", "carnet", "classement"] as const)("loads only the displayed %s scene and preserves the other illustrations", initialMode => {
    const html = renderToStaticMarkup(createElement(ContestArenaHub, { initialMode }));
    expect(html.match(/<img /g)).toHaveLength(1);
    expect(html).toContain(ARENA_LOBBY_MODES[initialMode].image);
    for (const mode of Object.values(ARENA_LOBBY_MODES)) {
      expect(existsSync(resolve("public" + mode.image))).toBe(true);
    }
    expect(existsSync(resolve("public/contest/mascot/arena-lobby-sylvain-v1.png"))).toBe(true);
  });

  it.each([false, true])("shows the opening date and character creation without unavailable activity links (notice %s)", initialNotice => {
    const html = renderToStaticMarkup(createElement(ContestArenaHub, { activitiesLocked: true, initialNotice }));
    expect(html).toContain(ARENA_OPENING_MESSAGE);
    expect(html).toContain("Créer mon personnage");
    expect(html.match(/Bientôt/g)).toHaveLength(3);
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("data-inline-account");
    expect(html).not.toContain("data-lobby-enter");
  });
});
