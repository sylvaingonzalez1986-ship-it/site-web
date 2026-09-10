import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const component = readFileSync(
  join(process.cwd(), "src/components/placard/KqEquipmentCatalogModal.tsx"),
  "utf8",
);
const styles = readFileSync(
  join(process.cwd(), "src/components/placard/KqEquipmentCatalogModal.module.css"),
  "utf8",
);

describe("Placard mobile equipment cart", () => {
  it("keeps the scrim in the same stacking context and behind the cart drawer", () => {
    const catalogBody = component.indexOf('<div className={styles.catalogBody}>');
    const cartPanel = component.indexOf('<aside className={styles.cartPanel}', catalogBody);
    const mobileScrim = component.indexOf('className={styles.mobileScrim}', cartPanel);
    const productDetail = component.indexOf("{selectedEquipment ?", mobileScrim);

    expect(catalogBody).toBeGreaterThan(-1);
    expect(cartPanel).toBeGreaterThan(catalogBody);
    expect(mobileScrim).toBeGreaterThan(cartPanel);
    expect(productDetail).toBeGreaterThan(mobileScrim);
    expect(component.slice(cartPanel, mobileScrim)).toContain("</aside>");
    expect(component.slice(mobileScrim, productDetail)).toMatch(
      /className=\{styles\.mobileScrim\}[\s\S]*?\/> : null\}\s*<\/div>\s*$/,
    );
    expect(styles).toContain(".catalogBody{isolation:isolate");
    expect(styles).toMatch(/\.cartPanel\{position:absolute;z-index:15;/);
    expect(styles).toMatch(/\.mobileScrim\{position:absolute;z-index:14;/);
  });

  it("preserves mobile touch targets, scrolling and the bottom safe area", () => {
    expect(styles).toContain("overflow:hidden;pointer-events:auto");
    expect(styles).toContain("padding-bottom:max(.7rem,env(safe-area-inset-bottom))");
    expect(styles).toContain(".cartFooter>button{min-height:48px;touch-action:manipulation}");
    expect(styles).toContain(".checkoutOverlay footer button,.purchaseOverlay footer button{min-height:48px;touch-action:manipulation}");
  });
});
