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
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("./ArenaJourneyEntry", () => ({ ArenaJourneyEntry: () => createElement("div", { "data-inline-account": true }, "Aide") }));
vi.mock("./ArenaPrelaunchCharacter", () => ({ ArenaPrelaunchCharacter: () => createElement("button", {}, "Créer mon personnage") }));

describe("Arena home", () => {
  it("maps three direct activity links and the profile without the neighborhood tutorial", () => {
    const html = renderToStaticMarkup(createElement(ContestArenaHub));
    for (const [id, mode] of Object.entries(ARENA_LOBBY_MODES)) {
      const link = html.match(new RegExp(`<a[^>]*data-arena-activity="${id}"[^>]*>`))?.[0];
      expect(link).toContain(`href="${mode.href}"`);
      expect(html).toContain(id === "jouer" ? "JOUER" : mode.name);
    }
    expect(html.match(/data-arena-activity=/g)).toHaveLength(3);
    expect(html.match(/data-arena-profile-trigger/g)).toHaveLength(1);
    expect(html).toMatch(/<button[^>]*data-arena-profile-trigger/);
    expect(html).toContain("data-arena-map");
    expect(html).toContain('id="arena-map-viewport"');
    expect(html).toMatch(/<button[^>]*data-arena-map-zoom[^>]*aria-pressed="false"/);
    expect(html).toContain("Aide");
    expect(html).not.toContain("La relève · Apprendre à jouer");
    expect(html).not.toContain("data-arena-learning-trigger");
    expect(html).not.toContain("data-arena-first-culture");
    expect(html).not.toContain("<dialog");
    expect(html).not.toContain("data-lobby-enter");
    expect(html).not.toContain("Pack des Pionniers");
    expect(html).not.toContain("Mes missions");
    expect(html).not.toContain("Des fleurs à gagner en fin de saison");
    expect(html).not.toContain("Un village. Mille façons de te faire un nom.");
  });

  it.each(["jouer", "carnet", "classement"] as const)("uses one illustrated desk and highlights the %s destination", initialMode => {
    const html = renderToStaticMarkup(createElement(ContestArenaHub, { initialMode }));
    expect(html.match(/<img /g)).toHaveLength(1);
    expect(html).toContain('/contest/map/arena-desk-sylvain-v6.webp');
    expect(html).toContain(`data-arena-scene="${initialMode}"`);
    expect(html.match(new RegExp(`<a[^>]*data-arena-activity="${initialMode}"[^>]*>`))?.[0]).toContain('data-current="true"');
    expect(html.match(/data-current="true"/g)).toHaveLength(1);
    expect(existsSync(resolve("public/contest/map/arena-desk-sylvain-v6.webp"))).toBe(true);
    for (const mode of Object.values(ARENA_LOBBY_MODES)) {
      expect(existsSync(resolve("public" + mode.image))).toBe(true);
    }
    expect(existsSync(resolve("public/contest/mascot/arena-lobby-sylvain-v1.png"))).toBe(true);
  });

  it.each([false, true])("opens the notebook while the game waits for its opening date (notice %s)", initialNotice => {
    const html = renderToStaticMarkup(createElement(ContestArenaHub, { activitiesLocked: true, initialNotice }));
    expect(html).toContain(ARENA_OPENING_MESSAGE);
    expect(html).toContain("Créer mon personnage");
    expect(html).not.toContain("La relève · Apprendre à jouer");
    expect(html).not.toContain("Ta première culture");
    expect(html).toContain("Le Carnet est ouvert");
    expect(html.match(/Bientôt/g)).toHaveLength(2);
    expect(html.match(/aria-disabled="true"/g)).toHaveLength(2);
    expect(html.match(/data-arena-profile-trigger/g)).toHaveLength(1);
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toMatch(/<a[^>]*data-arena-activity="carnet"[^>]*href="\/arene\/carnet\/regular"/);
    expect(html).not.toContain('href="/arene/placard"');
    expect(html).not.toContain("data-inline-account");
    expect(html).not.toContain("data-lobby-enter");
  });

  it("honors the notebook emergency switch without announcing an open notebook", () => {
    const html = renderToStaticMarkup(createElement(ContestArenaHub, { activitiesLocked: true, notebookOpen: false }));
    expect(html).not.toContain("Le Carnet est ouvert");
    expect(html).not.toContain("<a ");
    expect(html.match(/aria-disabled="true"/g)).toHaveLength(3);
    expect(html).toContain("Indisponible");
  });

});
