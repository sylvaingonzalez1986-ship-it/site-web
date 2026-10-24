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
    const helpTrigger = html.match(/<button\b[^>]*data-arena-help-trigger[^>]*>/)?.[0];
    const helpPanel = html.match(/<div\b[^>]*id="([^"]+)"[^>]*hidden=""[^>]*>([\s\S]*?)<\/div>/);
    expect(html).toContain("data-arena-account-controls");
    expect(html.match(/data-arena-help-trigger/g)).toHaveLength(1);
    expect(helpTrigger).toContain('aria-expanded="false"');
    expect(helpPanel).not.toBeNull();
    expect(helpTrigger).toContain(`aria-controls="${helpPanel?.[1]}"`);
    // The manual launcher belongs only to the collapsed help panel. It stays
    // disabled until the player's identity and isolated learning save are ready.
    expect(html.match(/data-arena-learning-trigger/g)).toHaveLength(1);
    const learningTrigger = helpPanel?.[2].match(/<button\b[^>]*data-arena-learning-trigger[^>]*>/)?.[0];
    expect(learningTrigger).toContain('aria-haspopup="dialog"');
    expect(learningTrigger).toContain('disabled=""');
    expect(html).not.toContain("Lire le guide");
    expect(html).not.toContain("Approfondir avec le parcours complet");
    expect(html).not.toContain("data-arena-trial-trigger");
    expect(html).not.toContain("<dialog");
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
