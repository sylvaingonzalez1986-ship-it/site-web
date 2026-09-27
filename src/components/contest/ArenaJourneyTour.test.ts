import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ArenaJourneyTour } from "./ArenaJourneyTour";
import { ChanvrierPlayerCard } from "./ChanvrierPlayerCard";
import type { ChanvrierProfile } from "@/lib/arena-chanvrier";

vi.mock("@/components/cookies/CookieConsentProvider", () => ({
  useCookieConsent: () => ({ showBanner: false }),
}));
vi.mock("next/dynamic", () => ({ default: () => () => null }));

const profile: ChanvrierProfile = {
  nickname: "Sylvain",
  gender: "male",
  clothing: "ochre",
  skin: "ivory",
  strength: "green-thumb",
};

describe("inline Arena account controls", () => {
  it("offers one collapsed help entry without opening the profile or trial", () => {
    const html = renderToStaticMarkup(createElement(ArenaJourneyTour));
    expect(html).toContain("data-arena-account-controls");
    expect(html.match(/data-arena-help-trigger/g)).toHaveLength(1);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toMatch(/<div[^>]*id="[^"]+"[^>]*hidden=""/);
    expect(html).toContain("Lire le guide");
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain("data-chanvrier-profile");
    expect(html).not.toContain("data-arena-journey-ui");
  });

  it("renders the same player card inline without opening its personal details", () => {
    const html = renderToStaticMarkup(createElement(ChanvrierPlayerCard, { profile, inline: true, onEdit: vi.fn() }));
    expect(html).toContain('data-inline="true"');
    expect(html).toContain("MA CARTE");
    expect(html).toContain("Sylvain");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("<dialog");
  });

  it("preserves the default player-card placement for other callers", () => {
    const html = renderToStaticMarkup(createElement(ChanvrierPlayerCard, { profile, onEdit: vi.fn() }));
    expect(html).toContain("data-chanvrier-card");
    expect(html).not.toContain("data-inline");
  });
});
