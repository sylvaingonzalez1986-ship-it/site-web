import { createElement, type AnchorHTMLAttributes } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ArenaRankingBoard, type ArenaRankingBoardProps, type ArenaRankingRow } from "./ArenaRankingBoard";

vi.mock("@/components/navigation/NavigationLink", () => ({ default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => createElement("a", props) }));
vi.mock("./LeaderboardAvatar", () => ({ LeaderboardAvatar: ({ pseudo }: { pseudo: string }) => createElement("span", { role: "img", "aria-label": `Avatar de ${pseudo}` }) }));

const rows: ArenaRankingRow[] = Array.from({ length: 100 }, (_, index) => ({
  key: `player-${index + 1}`,
  rank: index + 1,
  pseudo: `Joueur ${index + 1}`,
  detail: "",
  score: 1000 - index,
  scoreLabel: "pts Arène",
  rewardGrams: index === 0 ? 25 : null,
  href: "",
  contributions: { notebook: 300, duels: 500 - index, business: 200 },
}));

const props: ArenaRankingBoardProps = {
  id: "ranking-test",
  mode: "general",
  scope: "season",
  rows,
  loading: false,
  unavailable: false,
  viewerPseudo: "Joueur 86",
  onModeChange: () => undefined,
  onScopeChange: () => undefined,
  onRetry: () => undefined,
};
const render = (overrides: Partial<ArenaRankingBoardProps> = {}) => renderToStaticMarkup(createElement(ArenaRankingBoard, { ...props, ...overrides }));

describe("village ranking board", () => {
  it("keeps all 100 ranked players accessible and locates a viewer outside the former top ten", () => {
    const html = render();
    expect(html.match(/<li value=/g)).toHaveLength(100);
    expect(html).toContain("Joueur 100");
    expect(html).toContain("Ma place <b>#86</b>");
    expect(html.match(/data-viewer="true"/g)).toHaveLength(1);
    expect(html).toContain('role="region" aria-label="Le classement général" aria-busy="false" tabindex="0"');
    expect(html).toContain("≈ 25 g");
  });

  it("shows the general contributions without turning the enterprise caps into a player's private breakdown", () => {
    const html = render({ rows: [{ ...rows[0], contributions: { notebook: 0, duels: 400, business: 125 }, score: 525 }], viewerPseudo: undefined });
    expect(html).toContain("Carnet <b>0</b>");
    expect(html).toContain("Duels <b>400</b>");
    expect(html).toContain("Entreprise <b>125</b>");
    expect(html).toContain("Chiffre d’affaires <b>80</b>");
    expect(html).toContain("Production <b>60</b>");
    expect(html).toContain("Valeur nette <b>60</b>");
    expect(html).not.toContain("Ma place");
  });

  it("distinguishes loading, failures and an empty ranking instead of showing stale results", () => {
    const loading = render({ loading: true });
    expect(loading).toContain('aria-busy="true"');
    expect(loading).toContain("Chargement du classement.");
    expect(loading).not.toContain("Joueur 86");
    const failed = render({ unavailable: true });
    expect(failed).toContain("momentanément indisponible");
    expect(failed).toContain("Réessayer");
    expect(failed).not.toContain("Joueur 86");
    const empty = render({ rows: [] });
    expect(empty).toContain("Termine un duel officiel");
    expect(empty).not.toContain("Réessayer");
  });

  it("preserves tasting profile links and the selected period without the company score rules", () => {
    const html = render({ mode: "tasting", scope: "global", rows: [{ ...rows[0], contributions: undefined, href: "/arene/profils/Joueur%201?track=expert", detail: "Fin connaisseur · 12 critiques", scoreLabel: "pts Carnet" }] });
    expect(html).toContain('href="/arene/profils/Joueur%201?track=expert"');
    expect(html).toMatch(/aria-pressed="true">Global<\/button>/);
    expect(html).toContain("Fin connaisseur · 12 critiques");
    expect(html).not.toContain("Valeur nette <b>60</b>");
  });

  it("keeps the full Kanab Quest score separate from its enterprise contribution", () => {
    const html = render({ mode: "placard", rows: [{ ...rows[0], contributions: undefined, score: 1400, businessScore: 125, scoreLabel: "Score Kanab Quest", detail: "Cote 1100 · 8 V · 2 D" }] });
    expect(html).toContain((1400).toLocaleString("fr-FR"));
    expect(html).toContain("Entreprise <b>125 / 200</b>");
    expect(html).toContain("Cote 1100 · 8 V · 2 D");
    expect(html).not.toContain("Score / 1 000");
  });
});
