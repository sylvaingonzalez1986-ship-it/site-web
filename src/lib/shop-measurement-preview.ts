import {
  SHOP_IMPRESSION_THRESHOLD,
  SHOP_LIST_SURFACES,
  SHOP_MEASUREMENT_PREVIEW_EVENT,
  SHOP_PRODUCT_CONTROLS,
  createShopImpressionDwell,
  getShopListFilters,
  isShopCatalogId,
  registerShopCartAdditionReporter,
  type ShopListContext,
  type ShopMeasurementEvent,
} from "./shop-measurement";

const listSelector = "[data-shop-list-view]";
const cardSelector = "[data-shop-product-id]";
const titleSelector = "[data-shop-impression-title]";
const priceSelector = "[data-shop-impression-price]";
const modalSelector = "dialog[open], [role='dialog'][aria-modal='true']";

type ShopCard = {
  element: HTMLElement;
  productId: string;
  viewKey: string;
  title: Element;
  price: Element;
  visibleTargets: Set<Element>;
  interruptions: number;
  updateDwell: ReturnType<typeof createShopImpressionDwell>;
};

type ListView = {
  key: string;
  surface: ShopListContext["surface"];
  selection: ShopListContext["selection"];
  cards: HTMLElement[];
};

function readListView(element: HTMLElement): ListView | null {
  const surface = SHOP_LIST_SURFACES.find((item) => item === element.dataset.shopListView);
  if (!surface) return null;

  const { selection: activeSelection, filters } = getShopListFilters(new URLSearchParams(window.location.search));
  const selection = surface === "market" ? activeSelection : undefined;
  const key = JSON.stringify([surface, window.location.pathname, activeSelection, ...filters]);
  const cards = Array.from(element.querySelectorAll<HTMLElement>(cardSelector))
    .filter((card) => card.closest(listSelector) === element);

  return { key, surface, selection, cards };
}

function describeCard(card: HTMLElement, view: ListView, index: number) {
  const productId = card.dataset.shopProductId;
  if (!isShopCatalogId(productId) || index < 0) return null;

  const context: ShopListContext = { surface: view.surface, position: index + 1 };
  if (view.selection) context.selection = view.selection;
  return { productId, context };
}

function describeControl(control: Element) {
  const card = control.closest<HTMLElement>(cardSelector);
  const list = card?.closest<HTMLElement>(listSelector);
  const view = list && readListView(list);
  return card && view ? describeCard(card, view, view.cards.indexOf(card)) : null;
}

function activeModal() {
  return Array.from(document.querySelectorAll(modalSelector)).at(-1);
}

export function installShopMeasurementPreview(canMeasure: () => boolean): () => void {
  const cards = new Map<HTMLElement, ShopCard>();
  const targets = new Map<Element, ShopCard>();
  const impressions = new Map<string, Set<string>>();

  function emit(event: ShopMeasurementEvent) {
    if (!canMeasure()) return;
    window.dispatchEvent(new CustomEvent(SHOP_MEASUREMENT_PREVIEW_EVENT, { detail: event }));
  }

  function updateIntersections(entries: IntersectionObserverEntry[]) {
    for (const entry of entries) {
      const card = targets.get(entry.target);
      if (!card) continue;
      if (entry.isIntersecting && entry.intersectionRatio >= SHOP_IMPRESSION_THRESHOLD) {
        card.visibleTargets.add(entry.target);
      } else {
        card.visibleTargets.delete(entry.target);
      }
      const eligible = document.visibilityState === "visible" && card.visibleTargets.size === 2;
      if (!eligible) card.interruptions += 1;
      card.updateDwell(eligible);
    }
  }

  const observer = typeof IntersectionObserver === "function"
    ? new IntersectionObserver(updateIntersections, { threshold: SHOP_IMPRESSION_THRESHOLD })
    : null;

  function dropCard(card: ShopCard) {
    card.updateDwell(false);
    observer?.unobserve(card.title);
    observer?.unobserve(card.price);
    targets.delete(card.title);
    targets.delete(card.price);
    cards.delete(card.element);
  }

  function trackCard(element: HTMLElement, productId: string, title: Element, price: Element, view: ListView) {
    const card: ShopCard = {
      element,
      productId,
      viewKey: view.key,
      title,
      price,
      visibleTargets: new Set(),
      interruptions: 0,
      updateDwell: createShopImpressionDwell(() => {
        const interruptions = card.interruptions;
        // Consume a threshold crossing already queued for the observer before qualifying.
        updateIntersections(observer?.takeRecords() ?? []);
        if (interruptions !== card.interruptions || !canMeasure() || !element.isConnected
          || document.visibilityState !== "visible" || card.visibleTargets.size !== 2) return;
        const modal = activeModal();
        if (modal && !modal.contains(element)) return;

        const list = element.closest<HTMLElement>(listSelector);
        const currentView = list && readListView(list);
        if (!currentView || currentView.key !== view.key) return;
        const descriptor = describeCard(element, currentView, currentView.cards.indexOf(element));
        const seen = impressions.get(view.key);
        if (!descriptor || descriptor.productId !== productId || !seen) return;

        dropCard(card);
        if (seen.has(descriptor.productId)) return;
        seen.add(descriptor.productId);
        emit({ name: "shop_card_impression", productId: descriptor.productId, ...descriptor.context });
      }),
    };
    cards.set(element, card);
    targets.set(title, card);
    targets.set(price, card);
    observer?.observe(title);
    observer?.observe(price);
  }

  // A card can be replaced by a React render while its list and product stay the same.
  // Keep the impression set until the list context changes, including a filter change.
  function scanLists() {
    if (!observer) return;
    const lists = Array.from(document.querySelectorAll<HTMLElement>(listSelector))
      .map(readListView).filter((view): view is ListView => view !== null);
    const modal = activeModal();
    const activeViews = new Set(lists.map(({ key }) => key));
    if (activeViews.size > 0) {
      for (const key of impressions.keys()) {
        if (!activeViews.has(key)) impressions.delete(key);
      }
    }
    const stillObserved = new Set<HTMLElement>();
    for (const view of lists) {
      const seen = impressions.get(view.key) ?? new Set<string>();
      impressions.set(view.key, seen);
      view.cards.forEach((element, index) => {
        if (modal && !modal.contains(element)) return;
        const descriptor = describeCard(element, view, index);
        const title = element.querySelector(titleSelector);
        const price = element.querySelector(priceSelector);
        if (!title || !price || title === price || !descriptor || seen.has(descriptor.productId)) return;

        stillObserved.add(element);
        const previous = cards.get(element);
        if (previous && previous.title === title && previous.price === price
          && previous.viewKey === view.key && previous.productId === descriptor.productId) return;
        if (previous) dropCard(previous);
        trackCard(element, descriptor.productId, title, price, view);
      });
    }
    for (const card of cards.values()) {
      if (!stillObserved.has(card.element)) dropCard(card);
    }
  }

  function resetVisibility() {
    observer?.takeRecords();
    observer?.disconnect();
    for (const card of cards.values()) {
      card.updateDwell(false);
      card.visibleTargets.clear();
      card.interruptions += 1;
      if (document.visibilityState !== "visible") continue;
      observer?.observe(card.title);
      observer?.observe(card.price);
    }
  }

  function onProductOpen(event: MouseEvent) {
    const button = event.type === "auxclick" ? 1 : 0;
    if (event.button !== button || !(event.target instanceof Element)) return;
    const link = event.target.closest("a[data-shop-product-control]");
    const control = SHOP_PRODUCT_CONTROLS.find((item) => item === link?.getAttribute("data-shop-product-control"));
    if (!link || !control || link.getAttribute("aria-disabled") === "true") return;
    const descriptor = describeControl(link);
    if (!descriptor) return;
    emit({ name: "shop_product_open", productId: descriptor.productId, control, ...descriptor.context });
  }

  const unregisterCartReporter = registerShopCartAdditionReporter((control, productId, variantId) => {
    if (!control) {
      emit({ name: "shop_cart_add_success", productId, variantId, surface: "detail" });
      return;
    }
    const descriptor = describeControl(control);
    if (!descriptor || descriptor.productId !== productId) return;
    emit({ name: "shop_cart_add_success", productId, variantId, ...descriptor.context });
  });

  const mutations = new MutationObserver(scanLists);
  mutations.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-shop-list-view", "data-shop-product-id", "open", "aria-modal"],
  });
  document.addEventListener("visibilitychange", resetVisibility);
  document.addEventListener("click", onProductOpen, true);
  document.addEventListener("auxclick", onProductOpen, true);
  window.addEventListener("popstate", scanLists);
  scanLists();

  return () => {
    document.removeEventListener("visibilitychange", resetVisibility);
    document.removeEventListener("click", onProductOpen, true);
    document.removeEventListener("auxclick", onProductOpen, true);
    window.removeEventListener("popstate", scanLists);
    mutations.disconnect();
    observer?.disconnect();
    for (const card of cards.values()) card.updateDwell(false);
    unregisterCartReporter();
  };
}
