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
  score: 1549 - index,
  scoreLabel: "pts Arène",
  rewardGrams: index === 0 ? 25 : null,
  href: "",
  contributions: { notebook: 1000, duels: 439.2 - index, business: 109.8 },
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
  it("offers four ranking categories with duels and business separate", () => {
    const html = render();
    const modeSwitch = html.split('aria-label="Type de classement">')[1].split('</div>')[0];
    expect(modeSwitch.match(/<button /g)).toHaveLength(4);
    expect(modeSwitch.match(/<strong>[^<]+<\/strong>/g)).toEqual([
      "<strong>Général</strong>", "<strong>Dégustation</strong>", "<strong>Duels</strong>", "<strong>Entreprise</strong>",
    ]);
  });

  it("keeps all 100 ranked players accessible and locates a viewer outside the former top ten", () => {
    const html = render();
    expect(html.match(/<li value=/g)).toHaveLength(100);
    expect(html).toContain("Joueur 100");
    expect(html).toContain("Ma place <b>#86</b>");
    expect(html.match(/data-viewer="true"/g)).toHaveLength(1);
    expect(html).toContain('role="region" aria-label="Le classement général" aria-busy="false" tabindex="0"');
    expect(html).toContain("≈ 25 g");
  });

  it("shows uncapped contributions rounded to one French decimal and the three business criteria", () => {
    const html = render({ rows: [{ ...rows[0], contributions: { notebook: 1800, duels: 504.44, business: 426.5 }, score: 2730.94 }], viewerPseudo: undefined });
    expect(html).toContain("Dégustation <b>1 800</b>");
    expect(html).toContain("Duels <b>504,4</b>");
    expect(html).toContain("Entreprise <b>426,5</b>");
    expect(html).toContain("<strong>2 730,9</strong>");
    expect(html).toContain("Surface cultivée</li>");
    expect(html).toContain("Chiffre d’affaires</li>");
    expect(html).toContain("Réputation</li>");
    expect(html).toContain("sans duel obligatoire");
    expect(html).not.toContain("pts max.");
    expect(html).not.toContain("Valeur nette");
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
    expect(empty).toContain("Une dégustation validée, un duel ou des points d’entreprise suffisent");
    expect(empty).not.toContain("Réessayer");
  });

  it("preserves tasting profile links and the selected period without the company score rules", () => {
    const html = render({ mode: "tasting", scope: "global", rows: [{ ...rows[0], contributions: undefined, href: "/arene/profils/Joueur%201?track=expert", detail: "12 découvertes", scoreLabel: "pts Dégustation" }] });
    expect(html).toContain('href="/arene/profils/Joueur%201?track=expert"');
    expect(html).toMatch(/aria-pressed="true">Global<\/button>/);
    expect(html).toContain("12 découvertes");
    expect(html).toContain("100 points par fleur différente achetée");
    expect(html).toContain("avec un nouvel achat et un nouvel avis validé");
    expect(html).not.toContain("Chiffre d’affaires</li>");
  });

  it("shows only duel points and rules in the duel category", () => {
    const html = render({ mode: "duels", rows: [{ ...rows[0], contributions: undefined, score: 400, scoreLabel: "pts Duels", detail: "Cote 1100 · 8 V · 2 D" }] });
    expect(html).toContain("Les champions des duels");
    expect(html).toContain("Points duels");
    expect(html).toContain("<strong>400</strong>");
    expect(html).toContain("Cote 1100 · 8 V · 2 D");
    expect(html).toContain("Les défis contre les bots sont exclus");
    expect(html).toContain("100 × log₂(1 + points de duels humains / 50)");
    expect(html).not.toContain("Chiffre d’affaires</li>");
    expect(html).not.toContain("Score Kanab Quest");
    expect(html).not.toContain("Score / 1 000");
  });

  it("gives business its own score, rules and empty state without duel eligibility", () => {
    const html = render({ mode: "business", rows: [{ ...rows[0], contributions: undefined, score: 125, scoreLabel: "pts Entreprise", detail: "", rewardGrams: null }] });
    expect(html).toContain("Les meilleures entreprises");
    expect(html).toContain("Points entreprise");
    expect(html).toContain("<strong>125</strong>");
    expect(html).toContain("même sans duel");
    expect(html).toContain("Chiffre d’affaires</li>");
    expect(html).toContain("moyennée sur les 30 derniers jours");
    expect(html).toContain("hors taxes et annulations");
    expect(html).toContain("réputation commerciale actuelle");
    expect(html).not.toContain("/ 200");
    expect(html).not.toContain("Un duel officiel terminé est requis");
    expect(html).not.toContain("pts Duels");
    const empty = render({ mode: "business", rows: [] });
    expect(empty).toContain("Pas encore d’entreprise classée");
    expect(empty).not.toContain("Termine un duel officiel");
  });

  it("exposes later pages and the viewer's position beyond the loaded players without duplicating it", () => {
    const viewerRow: ArenaRankingRow = { ...rows[0], key: "viewer", pseudo: "Moi", rank: 186 };
    const html = render({ viewerPseudo: "Moi", viewerRow, totalPlayers: 321, hasMore: true, onLoadMore: () => undefined });
    expect(html).toContain("321 joueurs au tableau");
    expect(html).toContain("100 joueurs affichés sur 321");
    expect(html).toContain("Ma place <b>#186</b>");
    expect(html).toContain("Ta place dans le classement");
    expect(html.match(/data-viewer="true"/g)).toHaveLength(1);
    expect(html.match(/<li value=/g)).toHaveLength(101);
    const loaded = render({ rows: [...rows, viewerRow], viewerPseudo: "Moi", viewerRow });
    expect(loaded).not.toContain("Ta place dans le classement");
    expect(loaded.match(/data-viewer="true"/g)).toHaveLength(1);
  });

  it("uses authenticated identity even when players share a display name", () => {
    const viewerRow = { ...rows[0], key: "real-viewer", rank: 186 };
    const html = render({ rows: [rows[0]], viewerPseudo: rows[0].pseudo, viewerRow });
    expect(html).toContain("Ma place <b>#186</b>");
    expect(html.match(/data-viewer="true"/g)).toHaveLength(1);
    expect(html.match(/<li value=/g)).toHaveLength(2);
    const absent = render({ rows: [rows[0]], viewerPseudo: rows[0].pseudo, viewerRow: null });
    expect(absent).not.toContain("Ma place");
    expect(absent).not.toContain('data-viewer="true"');
  });

  it("keeps loaded rows visible during pagination and provides a retry after failure", () => {
    const pending = render({ hasMore: true, loadingMore: true, onLoadMore: () => undefined });
    expect(pending).toContain('aria-busy="true"');
    expect(pending).toMatch(/<button[^>]+disabled=""[^>]+>.*?Chargement…<\/button>/);
    expect(pending).toContain("Joueur 100");
    const failed = render({ hasMore: true, loadMoreError: "Impossible de charger la suite. Réessaie.", onLoadMore: () => undefined });
    expect(failed).toContain("Joueur 100");
    expect(failed).toContain('role="status">Impossible de charger la suite. Réessaie.');
    expect(failed).not.toContain('disabled=""');
  });
});
