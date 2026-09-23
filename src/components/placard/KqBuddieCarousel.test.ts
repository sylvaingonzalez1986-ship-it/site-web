import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { KQ_BUDDIES } from "@/lib/kanab-quest-game";
import { KqBuddieCarousel } from "./KqBuddieCarousel";

vi.mock("@/components/lottery/BuddieCard", () => ({ BuddieCard: () => createElement("span", null, "Carte Buddie") }));

const buddies = KQ_BUDDIES.slice(0, 6);
const props = { buddies, artwork: {}, selectedCode: buddies[0].code, onSelect: () => undefined };
const cards = (html: string) => html.match(/<article\b[^>]*>[\s\S]*?<\/article>/g) ?? [];

describe("Buddie rotation in culture preparation", () => {
  it("blocks both selection buttons for recently used Buddies, even when selected and owned in multiple copies", () => {
    const html = renderToStaticMarkup(createElement(KqBuddieCarousel, {
      ...props,
      artwork: { [buddies[0].code]: { imageUrl: "", ownedCopies: 4 } },
      rotation: { requiredDistinctBuddies: 5, recentBuddieCodes: buddies.slice(0, 5).map(buddie => buddie.code) },
    }));
    const renderedCards = cards(html);
    expect(renderedCards).toHaveLength(6);
    for (const card of renderedCards.slice(0, 5)) {
      expect(card.match(/disabled=""/g)).toHaveLength(2);
      expect(card).not.toContain('aria-pressed="true"');
    }
    expect(renderedCards[0]).toContain("Encore 5 autres Buddies différents");
    expect(renderedCards[4]).toContain("Encore 1 autre Buddie différent");
    expect(renderedCards[5]).not.toContain('disabled=""');
  });

  it("makes the favorite available again after five other distinct Buddies", () => {
    const html = renderToStaticMarkup(createElement(KqBuddieCarousel, {
      ...props,
      rotation: { requiredDistinctBuddies: 5, recentBuddieCodes: buddies.slice(1).map(buddie => buddie.code) },
    }));
    expect(cards(html)[0]).not.toContain('disabled=""');
    expect(cards(html)[0]).toContain('aria-pressed="true"');
  });

  it("waits for official rotation history while keeping local prototypes available", () => {
    const official = renderToStaticMarkup(createElement(KqBuddieCarousel, { ...props, rotation: null }));
    expect(cards(official).every(card => (card.match(/disabled=""/g) ?? []).length === 2)).toBe(true);
    const local = renderToStaticMarkup(createElement(KqBuddieCarousel, props));
    expect(cards(local).every(card => !card.includes('disabled=""'))).toBe(true);
  });
});
