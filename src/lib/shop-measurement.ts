export const SHOP_MEASUREMENT_PREVIEW_EVENT = "shop:measurement-preview";
export const SHOP_IMPRESSION_THRESHOLD = 0.5;
export const SHOP_IMPRESSION_DELAY_MS = 1_000;

export const SHOP_LIST_SURFACES = ["market", "category", "region", "producer-panel"] as const;
export const SHOP_PRODUCT_CONTROLS = ["title", "view", "format", "reviews"] as const;
export const SHOP_MARKET_SELECTIONS = ["products", "neighbors", "copains", "regions"] as const;

export type ShopListSurface = typeof SHOP_LIST_SURFACES[number];
export type ShopProductControl = typeof SHOP_PRODUCT_CONTROLS[number];

export type ShopListContext = {
  surface: ShopListSurface;
  position: number;
  selection?: typeof SHOP_MARKET_SELECTIONS[number];
};

export type ShopMeasurementEvent =
  | ({ name: "shop_card_impression"; productId: string } & ShopListContext)
  | ({ name: "shop_product_open"; productId: string; control: ShopProductControl } & ShopListContext)
  | ({
      name: "shop_cart_add_success";
      productId: string;
      variantId: string | null;
    } & (ShopListContext | { surface: "detail" }));

const publicCatalogIdPattern = /^[\p{L}\p{N}_-]{1,100}$/u;

export function isShopCatalogId(value: unknown): value is string {
  return typeof value === "string" && publicCatalogIdPattern.test(value);
}

export function isLocalShopMeasurementHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

export function getShopListFilters(params: Pick<URLSearchParams, "get">) {
  const selection = SHOP_MARKET_SELECTIONS.find((item) => item === params.get("selection")) ?? "products";
  const filters = ["categorie", "culture", "producteur", "region"].map((key) => {
    const value = params.get(key);
    return isShopCatalogId(value) && value !== "all" ? value : null;
  });
  return { selection, filters };
}

export function createShopImpressionDwell(onVisible: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (eligible: boolean) => {
    if (!eligible) {
      clearTimeout(timer);
      timer = undefined;
    } else if (timer === undefined) {
      timer = setTimeout(() => {
        timer = undefined;
        onVisible();
      }, SHOP_IMPRESSION_DELAY_MS);
    }
  };
}

type CartAdditionReporter = (control: Element | null, productId: string, variantId: string | null) => void;
let reportCartAddition: CartAdditionReporter | undefined;

export function registerShopCartAdditionReporter(reporter: CartAdditionReporter) {
  reportCartAddition = reporter;
  return () => {
    if (reportCartAddition === reporter) reportCartAddition = undefined;
  };
}

export function reportShopCartAddition(control: Element | null, productId: string, variantId?: string) {
  if (!reportCartAddition) return;
  const [baseId, embeddedVariant] = productId.split("::");
  const chosenVariant = variantId || embeddedVariant || null;
  if (!isShopCatalogId(baseId) || (chosenVariant !== null && !isShopCatalogId(chosenVariant))) return;
  reportCartAddition(control, baseId, chosenVariant);
}
