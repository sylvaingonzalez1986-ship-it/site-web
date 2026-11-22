import { createElement, type AnchorHTMLAttributes } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HomeRewardsSection } from "./HomeRewardsSection";

vi.mock("@/components/navigation/NavigationLink", () => ({
  default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => createElement("a", props),
}));

describe("Home game entry", () => {
  it("offers the open game without advertising season prizes during public testing", () => {
    const html = renderToStaticMarkup(createElement(HomeRewardsSection, { gameOpen: true, seasonPrizesOpen: false }));
    expect(html).toContain('href="/arene/placard"');
    expect(html).not.toContain("Pot de la Canopée");
    expect(html).not.toContain("Comment sont attribués les lots");
    expect(html).toContain("Le tirage du Carnet");
  });

  it("displays the prize terms when the prize season opens", () => {
    const html = renderToStaticMarkup(createElement(HomeRewardsSection, { gameOpen: true, seasonPrizesOpen: true }));
    expect(html).toContain("Pot de la Canopée");
    expect(html).toContain("Comment sont attribués les lots");
  });
});
