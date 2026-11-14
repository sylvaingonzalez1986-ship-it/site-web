import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createKqOperationsLesson, getKqOperationsStorage } from "@/lib/kanab-quest-operations-lesson";
import { KqWarehouseHarvests } from "./KqWarehouseHarvests";
import type { KqStorageSnapshot } from "@/lib/kanab-quest-api";
import { createKqTutorialApi, KqTutorialApiProvider } from "./KqTutorialApiContext";

type StoredTrim = KqStorageSnapshot["lots"][number]["trim"];

function storageWithTrim(trim: StoredTrim) {
  const storage: KqStorageSnapshot = getKqOperationsStorage(createKqOperationsLesson("warehouse"));
  storage.lots = [storage.lots[0]];
  const lot = storage.lots[0];
  lot.flowerStatus = "available";
  lot.projection.stage = "ready";
  lot.projection.capacity!.overflowUnits = 0;
  lot.trim = trim;
  return storage;
}

function renderStorage(storage: KqStorageSnapshot, props: Partial<Parameters<typeof KqWarehouseHarvests>[0]> = {}) {
  return renderToStaticMarkup(createElement(KqWarehouseHarvests, {
    storage, onOpenWorkshop: vi.fn(), onSellOverflow: vi.fn(), ...props,
  }));
}

describe("jury links from stored harvests", () => {
  it.each(["empty", "unknown"])("distinguishes %s bulk from a sale to prepare", state => {
    const storage = getKqOperationsStorage(createKqOperationsLesson("warehouse"));
    const lot = storage.lots[0];
    lot.flowerStatus = "burned";
    lot.projection.stage = "ready";
    Object.assign(lot.projection.capacity!, { totalUnits: state === "empty" ? 0 : undefined, overflowUnits: 0 });
    const html = renderToStaticMarkup(createElement(KqWarehouseHarvests, {
      storage, onRetry: vi.fn(), onOpenWorkshop: vi.fn(), onSellOverflow: vi.fn(), onPlace: vi.fn(),
    }));
    expect(html).toContain(state === "empty" ? "Voir mon stock en vente" : "Vérifier le lot");
    expect(html).toContain(state === "empty" ? "Plus de vrac" : "Stock à vérifier");
    expect(html).not.toContain("Préparer la vente");
    expect(html).not.toContain("Voir l’offre grossiste");
    if (state === "empty") expect(html).not.toContain("Choisir un contenant");
  });
  it("offers verification instead of jury or sale when the verdict status is unknown", () => {
    const storage: KqStorageSnapshot = getKqOperationsStorage(createKqOperationsLesson("warehouse"));
    storage.lots[0].flowerStatus = "unknown";
    storage.lots[0].projection.stage = "ready";
    const html = renderToStaticMarkup(createElement(KqWarehouseHarvests, {
      storage, onRetry: vi.fn(), onOpenWorkshop: vi.fn(), onSellOverflow: vi.fn(),
    }));
    expect(html).toContain("Vérifier le lot");
    expect(html).not.toContain("data-open-jury=");
    expect(html).not.toContain("data-open-commerce=");
  });
  it.each(["harvests", "workshop"] as const)("returns to the selected lot in %s storage", juryReturnView => {
    const storage = getKqOperationsStorage(createKqOperationsLesson("warehouse"));
    const lot = storage.lots[0];
    lot.flowerId = "selected-lot";
    lot.flowerStatus = "available";
    lot.projection.stage = "ready";
    lot.trim = { status: "ready", totalGrams: null, completedGrams: null };
    const html = renderToStaticMarkup(createElement(KqWarehouseHarvests, {
      storage, juryReturnView, onOpenWorkshop: vi.fn(), onSellOverflow: vi.fn(),
    }));
    const href = html.match(/<a[^>]*data-open-jury="selected-lot"[^>]*href="([^"]+)"/)?.[1];
    expect(href).toBeDefined();
    const query = new URL(href!.replaceAll("&amp;", "&"), "https://game.test").searchParams;
    expect(Object.fromEntries(query)).toEqual({
      view: "arena", flower: lot.flowerId, from: juryReturnView, fromSection: "storage", fromFlower: lot.flowerId,
    });
  });
});

describe("trim prerequisites in stored harvests", () => {
  it.each([
    { status: "required", totalGrams: 120, completedGrams: 0, label: "Trim à faire", action: "Faire le trim" },
    { status: "in-progress", totalGrams: 120, completedGrams: 40, label: "Trim partiel", action: "Continuer le trim" },
  ] as const)("keeps a cured $status lot out of the jury and sale", ({ label, action, ...trim }) => {
    const storage = storageWithTrim(trim);
    const html = renderStorage(storage);
    expect(html).toContain(label);
    expect(html).toContain(action);
    expect(html).toContain(`data-open-trim="${storage.lots[0].flowerId}"`);
    expect(html).not.toContain("Prêt pour le jury");
    expect(html).not.toContain("data-open-jury=");
    expect(html).not.toContain("data-open-commerce=");
    if (trim.status === "in-progress") expect(html).toContain("40 g sur 120 g confirmés");
  });

  it.each(["required", "in-progress", "unknown"] as const)("offers %s trim while curing remains the current stage", status => {
    const storage = storageWithTrim(status === "unknown"
      ? { status, totalGrams: null, completedGrams: null }
      : { status, totalGrams: 120, completedGrams: status === "required" ? 0 : 40 });
    storage.lots[0].projection.stage = "curing";
    const html = renderStorage(storage, { onRetry: vi.fn() });
    expect(html).toContain("Affinage en cours");
    expect(html).toContain("data-open-trim=");
    expect(html).not.toContain("data-open-jury=");
    expect(html).not.toContain("Prêt pour le jury");
  });

  it.each([
    undefined,
    { status: "unknown", totalGrams: null, completedGrams: null },
    { status: "ready", totalGrams: -1, completedGrams: 0 },
  ])("offers verification and refresh when trim is absent or unconfirmed: %j", value => {
    const storage = storageWithTrim(value as StoredTrim);
    const html = renderStorage(storage, { onRetry: vi.fn() });
    expect(html).toContain("Trim à vérifier");
    expect(html).toContain("Vérifier le trim");
    expect(html).toContain(`data-refresh-trim="${storage.lots[0].flowerId}"`);
    expect(html).toContain("Actualiser");
    expect(html).not.toContain("g sur");
    expect(html).not.toContain("Prêt pour le jury");
    expect(html).not.toContain("data-open-jury=");
    expect(html).not.toContain("data-open-commerce=");
  });

  it.each([
    { status: "ready", totalGrams: 120, completedGrams: 120 },
    { status: "ready", totalGrams: null, completedGrams: null },
  ] as const)("allows the jury for completed or explicitly exempt trim: %j", trim => {
    const html = renderStorage(storageWithTrim(trim));
    expect(html).toContain("Prêt pour le jury");
    expect(html).toContain("data-open-jury=");
    expect(html).not.toContain("data-open-trim=");
    expect(html).not.toContain("data-refresh-trim=");
  });

  it("does not allow the jury before curing even when trim is ready", () => {
    const storage = storageWithTrim({ status: "ready", totalGrams: 120, completedGrams: 120 });
    storage.lots[0].projection.stage = "curing";
    const html = renderStorage(storage);
    expect(html).toContain("Affinage en cours");
    expect(html).not.toContain("data-open-jury=");
    expect(html).not.toContain("data-open-trim=");
  });

  it.each(["harvests", "workshop"] as const)("targets the selected lot and returns to %s storage", juryReturnView => {
    const storage = storageWithTrim({ status: "required", totalGrams: 120, completedGrams: 0 });
    const selected = structuredClone(storage.lots[0]);
    selected.flowerId = "lot-selected & second";
    storage.lots.push(selected);
    const html = renderStorage(storage, { initialFlowerId: selected.flowerId, juryReturnView });
    const selectedArticle = html.match(/<article[^>]*data-selected="true"[^>]*>[\s\S]*?<\/article>/)?.[0];
    expect(selectedArticle).toBeDefined();
    expect(selectedArticle).toContain("Lot sélectionné");
    const href = selectedArticle!.match(/<a[^>]*data-open-trim="[^"]+"[^>]*href="([^"]+)"/)?.[1];
    expect(href).toBeDefined();
    const query = new URL(href!.replaceAll("&amp;", "&"), "https://game.test").searchParams;
    expect(Object.fromEntries(query)).toEqual({
      view: "workshop", section: "processing", workshop: "trim", flower: selected.flowerId,
      from: juryReturnView, fromFlower: selected.flowerId, fromSection: "storage",
    });
  });

  it("disables navigation from a stale source but keeps refresh available", () => {
    const html = renderStorage(storageWithTrim(undefined), { error: "Stockage indisponible", onRetry: vi.fn() });
    expect(html).toContain("Stockage indisponible");
    expect(html.match(/<a[^>]*data-open-trim=[^>]*>/)?.[0]).toContain('aria-disabled="true"');
    const refresh = html.match(/<button[^>]*data-refresh-trim=[^>]*>/)?.[0];
    expect(refresh).toBeDefined();
    expect(refresh).not.toContain("disabled");
    expect(html).not.toContain("data-open-jury=");
  });

  it("disables a previously ready jury action when the source cannot be refreshed", () => {
    const html = renderStorage(storageWithTrim({ status: "ready", totalGrams: 120, completedGrams: 120 }), { error: "Stockage indisponible" });
    expect(html.match(/<a[^>]*data-open-jury=[^>]*>/)?.[0]).toContain('aria-disabled="true"');
  });

  it.each(["queued", "locked", "burned"] as const)("preserves %s actions without requiring trim again", status => {
    const storage = storageWithTrim(undefined);
    storage.lots[0].flowerStatus = status;
    const html = renderStorage(storage);
    expect(html).not.toContain("data-open-trim=");
    expect(html).not.toContain("Trim à vérifier");
    expect(html).toContain(status === "burned" ? "Préparer la vente" : "Suivre le duel");
  });

  it("keeps tutorial trim verification inside its simulated flow", () => {
    const tutorial = {
      api: createKqTutorialApi(vi.fn()),
      children: createElement(KqWarehouseHarvests, {
        storage: storageWithTrim(undefined), onOpenWorkshop: vi.fn(), onSellOverflow: vi.fn(), onRetry: vi.fn(),
      }),
    };
    const html = renderToStaticMarkup(createElement(KqTutorialApiProvider, tutorial));
    expect(html).not.toContain("data-open-trim=");
    expect(html).not.toContain("data-open-jury=");
    expect(html).toContain("data-refresh-trim=");
  });
});
