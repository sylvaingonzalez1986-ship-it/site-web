import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const playerShell = readFileSync(
  join(process.cwd(), "src/components/placard/PlacardPlayerShell.tsx"),
  "utf8",
);

describe("Kanab Quest Placard navigation position", () => {
  it("resets the viewport before and after every internal screen change", () => {
    expect(playerShell).toContain("resetPlacardScrollPosition");
    expect(playerShell).toContain("resetScroll();\n    if (nextView === view) return;");
    expect(playerShell).toContain("window.requestAnimationFrame");
    expect(playerShell).toContain("SCROLL_SETTLE_MS");
    expect(playerShell).toContain("useLayoutEffect(() =>");
  });

  it("covers the scrolling element and mobile body fallbacks", () => {
    expect(playerShell).toContain("document.scrollingElement.scrollTop = 0");
    expect(playerShell).toContain("document.documentElement.scrollTop = 0");
    expect(playerShell).toContain("document.body.scrollTop = 0");
    expect(playerShell).toContain("document.activeElement.blur()");
  });

  it("prevents browser history from restoring the previous bottom position", () => {
    expect(playerShell).toContain('window.history.scrollRestoration = "manual"');
    expect(playerShell).toContain("previousScrollRestoration");
  });
});
