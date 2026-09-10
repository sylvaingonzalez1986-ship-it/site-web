import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type AnchorHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";
import { ArenaNavigation } from "./ArenaNavigation";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => createElement("a", props, children),
}));

describe("Arène retro navigation", () => {
  it("keeps the three destinations and highlights play without claiming an active page", () => {
    const html = renderToStaticMarkup(createElement(ArenaNavigation, { activeView: "hub" }));
    expect(html.match(/<a /g)).toHaveLength(3);
    expect(html).toContain('href="/arene/carnet/regular"');
    expect(html).toContain('href="/arene/placard"');
    expect(html).toContain('href="/arene?vue=classement"');
    expect(html.match(/data-featured="true"/g)).toHaveLength(1);
    expect(html).not.toContain('aria-current="page"');
  });

  it.each(["jouer", "carnet", "classement"] as const)("announces only the current %s tab", (activeView) => {
    const html = renderToStaticMarkup(createElement(ArenaNavigation, { activeView }));
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html.match(/<a /g)).toHaveLength(3);
    expect(html).toContain('aria-label="Espaces de l&#x27;Arène"');
  });
});
