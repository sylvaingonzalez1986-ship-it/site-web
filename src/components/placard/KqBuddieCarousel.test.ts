import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { KQ_BUDDIES } from "@/lib/kanab-quest-game";
import { KqBuddieCarousel } from "./KqBuddieCarousel";

vi.mock("@/components/lottery/BuddieCard", () => ({ BuddieCard: () => createElement("span", null, "Carte Buddie") }));
vi.mock("@/lib/kanab-quest-buddie-varieties", () => ({ getKqBuddieVariety: () => undefined }));

const buddies = KQ_BUDDIES.slice(0, 6);
const props = { buddies, artwork: {}, selectedCode: buddies[0].code, onSelect: () => undefined };
const cards = (html: string) => html.match(/<article\b[^>]*>[\s\S]*?<\/article>/g) ?? [];

describe("Buddie rotation in culture preparation", () => {
  it("keeps variety information accessible while blocking selection of recently used Buddies", () => {
    const html = renderToStaticMarkup(createElement(KqBuddieCarousel, {
      ...props,
      artwork: { [buddies[0].code]: { imageUrl: "", ownedCopies: 4 } },
      rotation: { requiredDistinctBuddies: 2, recentBuddieCodes: buddies.slice(0, 2).map(buddie => buddie.code) },
    }));
    const renderedCards = cards(html);
    expect(renderedCards).toHaveLength(6);
    for (const card of renderedCards.slice(0, 2)) {
      expect(card.match(/disabled=""/g)).toHaveLength(1);
      const informationButton = card.match(/<button[^>]*aria-haspopup="dialog"[^>]*>/)?.[0];
      expect(informationButton).toBeDefined();
      expect(informationButton).not.toContain('disabled=""');
      expect(informationButton).toContain("Voir la fiche de");
      expect(card).not.toContain('aria-pressed="true"');
    }
    expect(renderedCards[0]).toContain("Encore 2 autres Buddies différents");
    expect(renderedCards[1]).toContain("Encore 1 autre Buddie différent");
    expect(renderedCards.slice(2).every(card => !card.includes('disabled=""'))).toBe(true);
  });

  it("makes the favorite available again after two other distinct Buddies", () => {
    const html = renderToStaticMarkup(createElement(KqBuddieCarousel, {
      ...props,
      rotation: { requiredDistinctBuddies: 2, recentBuddieCodes: buddies.slice(1, 3).map(buddie => buddie.code) },
    }));
    expect(cards(html)[0]).not.toContain('disabled=""');
    expect(cards(html)[0]).toContain('aria-pressed="true"');
  });

  it("explains the three-variety minimum only for collections that cannot cycle", () => {
    for (const count of [1, 2, 3]) {
      const html = renderToStaticMarkup(createElement(KqBuddieCarousel, {
        ...props, buddies: buddies.slice(0, count),
        rotation: { requiredDistinctBuddies: 2, recentBuddieCodes: [] },
      }));
      expect(html.includes("Avec au moins 3 Buddies différents")).toBe(count < 3);
      expect(html).not.toContain("6 Buddies");
    }
  });

  it("waits for official rotation history while keeping local prototypes available", () => {
    const official = renderToStaticMarkup(createElement(KqBuddieCarousel, { ...props, rotation: null }));
    expect(cards(official).every(card => (card.match(/disabled=""/g) ?? []).length === 1)).toBe(true);
    const local = renderToStaticMarkup(createElement(KqBuddieCarousel, props));
    expect(cards(local).every(card => !card.includes('disabled=""'))).toBe(true);
  });
});
