import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KqSeasonBoard, type KqSeasonBoardProps } from "./KqSeasonBoard";

const props: KqSeasonBoardProps = {
  rank: 2,
  score: 1000,
  rating: 1000,
  seasonPoints: 0,
  reputation: 0,
  wins: 0,
  losses: 0,
  streak: 0,
  arenaExperience: 0,
  leaderboard: [],
};

describe("season board business development", () => {
  it("includes the official business bonus in the player's breakdown and shows each leader's own score", () => {
    const html = renderToStaticMarkup(createElement(KqSeasonBoard, {
      ...props,
      score: 1125,
      businessScore: 125,
      leaderboard: [
        { id: "rival", rank: 1, name: "Rival", placardScore: 1200, businessScore: 81, isPlayer: false },
        { id: "player", rank: 2, name: "Moi", placardScore: 1125, businessScore: 125, isPlayer: true },
      ],
    }));
    expect(html).toContain("Dont +125 pour ton entreprise");
    expect(html).toContain("Entreprise 81 pts");
    expect(html).toContain("Entreprise 125 pts");
    expect(html).not.toContain("Score calculé actuellement");
  });

  it("keeps a zero business bonus when local simulation has no official development data", () => {
    const html = renderToStaticMarkup(createElement(KqSeasonBoard, {
      ...props,
      local: true,
      leaderboard: [{ id: "local", rank: 2, name: "Moi", placardScore: 1000, isPlayer: true }],
    }));
    expect(html).toContain("Simulation locale");
    expect(html).toContain("Dont +0 pour ton entreprise");
    expect(html).toContain("Score d’entreprise non renseigné");
    expect(html).not.toContain("Entreprise 0 pts");
    expect(html).not.toContain("Score calculé actuellement");
  });

  it("distinguishes an unknown leaderboard business score from a confirmed zero", () => {
    const html = renderToStaticMarkup(createElement(KqSeasonBoard, {
      ...props,
      leaderboard: [
        { id: "unknown", rank: 1, name: "Score inconnu", placardScore: 1200, businessScore: null, isPlayer: false },
        { id: "zero", rank: 2, name: "Score confirmé", placardScore: 1000, businessScore: 0, isPlayer: false },
      ],
    }));
    expect(html.match(/Score d’entreprise non renseigné/g)).toHaveLength(1);
    expect(html.match(/Entreprise 0 pts/g)).toHaveLength(1);
  });

  it("preserves uncapped decimal business scores and explains the new criteria", () => {
    const html = renderToStaticMarkup(createElement(KqSeasonBoard, {
      ...props,
      score: 1426.5,
      businessScore: 426.5,
      leaderboard: [{ id: "player", rank: 2, name: "Moi", placardScore: 1426.5, businessScore: 426.5, isPlayer: true }],
    }));
    expect(html).toContain("Dont +426,5 pour ton entreprise");
    expect(html).toContain("Entreprise 426,5 pts");
    expect(html).toContain("réputation commerciale");
    expect(html).toContain("hors taxes et annulations");
    expect(html).not.toContain("/ 200");
    expect(html).not.toContain("Valeur nette");
    expect(html).not.toContain("Score calculé actuellement");
  });
});
