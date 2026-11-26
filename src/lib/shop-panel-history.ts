type ShopParameter = "selection" | "categorie" | "culture" | "region" | "producteur";
type PanelAction = "open" | "switch" | "close";

const PARENT = "lcbShopPanelParent";

function panelPath(url: URL) {
  const params = new URLSearchParams(url.search);
  params.delete("resume");
  params.sort();
  const search = params.toString();
  return `${url.pathname}${search ? `?${search}` : ""}`;
}

export function changeShopUrl(changes: Partial<Record<ShopParameter, string | null>>, panelAction?: PanelAction) {
  const current = new URL(window.location.href);
  const next = new URL(current.href);
  next.searchParams.delete("resume");
  if (next.hash.startsWith("#shop-card-")) next.hash = "";
  for (const [key, value] of Object.entries(changes)) {
    if (value) next.searchParams.set(key, value);
    else next.searchParams.delete(key);
  }
  if (panelPath(next) === panelPath(current)) return;

  const href = next.pathname + next.search + next.hash;
  const parent: unknown = window.history.state?.[PARENT];
  if (panelAction === "close" && parent === panelPath(next)) {
    window.history.back();
  } else if (panelAction === "close" || panelAction === "switch") {
    window.history.replaceState(panelAction === "switch" && typeof parent === "string" ? { [PARENT]: parent } : null, "", href);
  } else {
    window.history.pushState(panelAction === "open" ? { [PARENT]: panelPath(current) } : null, "", href);
  }
}
