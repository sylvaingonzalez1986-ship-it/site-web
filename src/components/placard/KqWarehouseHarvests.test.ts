import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createKqOperationsLesson, getKqOperationsStorage } from "@/lib/kanab-quest-operations-lesson";
import { KqWarehouseHarvests } from "./KqWarehouseHarvests";
import type { KqStorageSnapshot } from "@/lib/kanab-quest-api";

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
