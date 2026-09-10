import { createElement, type AnchorHTMLAttributes, type ImgHTMLAttributes } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ContestArenaHub } from "./ContestArenaHub";
import { ARENA_LOBBY_MODES } from "@/lib/arena-lobby";

vi.mock("next/link", () => ({ default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => createElement("a", props) }));
vi.mock("next/image", () => ({
  default: ({ src, alt, width, height }: ImgHTMLAttributes<HTMLImageElement>) => createElement("img", { src, alt, width, height }),
}));
vi.mock("./ArenaFirstVisitTutorial", () => ({ ArenaFirstVisitTutorial: () => createElement("button", {}, "Comment fonctionne l’Arène ?") }));

describe("interactive Arena lobby", () => {
  it("starts with the Placard preview and sound disabled", () => {
    const html = renderToStaticMarkup(createElement(ContestArenaHub));
    expect(html).toContain('data-lobby-mode="jouer"');
    expect(html).toContain('aria-pressed="false" aria-label="Sons du menu"');
    expect(html).toContain("Entrer dans le Placard");
    expect(html).toContain("Comment fonctionne l’Arène ?");
    expect(html).not.toContain("autoplay");
  });

  it("offers one selector and one entry link without duplicate navigation", () => {
    const html = renderToStaticMarkup(createElement(ContestArenaHub));
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toContain('href="/arene/placard"');
    expect(html.match(/data-mode=/g)).toHaveLength(3);
    expect(html).toContain('aria-live="polite"');
  });

  it("uses three distinct local illustrations and preserves previous artwork", () => {
    const html = renderToStaticMarkup(createElement(ContestArenaHub));
    const images = Object.values(ARENA_LOBBY_MODES).map(mode => mode.image);
    expect(new Set(images).size).toBe(3);
    for (const path of images) {
      expect(html).toContain(path);
      expect(existsSync(resolve("public" + path))).toBe(true);
    }
    expect(html).not.toContain("arena-lobby-sylvain-v1.png");
    expect(existsSync(resolve("public/contest/mascot/arena-lobby-sylvain-v1.png"))).toBe(true);
  });
});
