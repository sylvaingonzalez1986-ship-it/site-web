import { createElement, type AnchorHTMLAttributes, type ImgHTMLAttributes } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ArenaSceneHeader } from "./ArenaSceneHeader";
import { ARENA_LOBBY_MODES } from "@/lib/arena-lobby";

vi.mock("next/link", () => ({ default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => createElement("a", props) }));
vi.mock("next/image", () => ({ default: ({ src, alt }: ImgHTMLAttributes<HTMLImageElement>) => createElement("img", { src, alt }) }));

describe("Shared arena scene navigation", () => {
  it.each(["carnet", "jouer", "classement"] as const)("keeps one title and one active destination for %s", (mode) => {
    const html = renderToStaticMarkup(createElement(ArenaSceneHeader, { mode }));
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html.match(/<a /g)).toHaveLength(4);
    expect(html).toContain(ARENA_LOBBY_MODES[mode].image);
    expect(html).toContain('href="/arene"');
  });
  it("respects disabled player access while keeping tasting and rankings available", () => {
    const html = renderToStaticMarkup(createElement(ArenaSceneHeader, { mode: "carnet", isPlacardPlayerEnabled: false }));
    expect(html).not.toContain('href="/arene/placard"');
    expect(html).toContain('href="/arene/carnet/regular"');
    expect(html).toContain('href="/arene?vue=classement"');
  });
});
