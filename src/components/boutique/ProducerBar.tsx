"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import { ProducerBadge } from "@/components/boutique/ProducerBadge";
import { ProducerDetailPanel } from "@/components/boutique/ProducerDetailPanel";
import { ProducerHoverCard } from "@/components/boutique/ProducerHoverCard";
import type { Product } from "@/data/products";
import type { Producer } from "@/types/store";

type ProducerBarProps = {
  producers: Producer[];
  products: Product[];
  addButtonLabel: string;
  producerPartnerLabel: string;
  producerWebsiteLabel: string;
  onOpenQuickView?: (productId: string, sourceProducts: Product[]) => void;
};

type HoverPosition = {
  x: number;
  y: number;
};

const HOVER_CARD_WIDTH = 300;
const HOVER_CARD_HEIGHT = 240;

function clampHoverPosition(clientX: number, clientY: number): HoverPosition {
  const padding = 12;
  const offset = 18;
  const maxX = Math.max(
    padding,
    window.innerWidth - HOVER_CARD_WIDTH - padding,
  );
  const maxY = Math.max(
    padding,
    window.innerHeight - HOVER_CARD_HEIGHT - padding,
  );

  return {
    x: Math.min(Math.max(clientX + offset, padding), maxX),
    y: Math.min(Math.max(clientY + offset, padding), maxY),
  };
}

export function ProducerBar({
  producers,
  products,
  addButtonLabel,
  producerPartnerLabel,
  producerWebsiteLabel,
  onOpenQuickView,
}: ProducerBarProps) {
  const [selectedProducerId, setSelectedProducerId] = useState<string | null>(null);
  const [hoveredProducerId, setHoveredProducerId] = useState<string | null>(null);
  const [hoverPosition, setHoverPosition] = useState<HoverPosition>({ x: 0, y: 0 });
  const [canHover, setCanHover] = useState(false);

  const rafRef = useRef<number | null>(null);
  const latestHoverRef = useRef<HoverPosition>({ x: 0, y: 0 });

  const producerById = useMemo(
    () => new Map(producers.map((producer) => [producer.id, producer])),
    [producers],
  );

  const productsByProducerId = useMemo(() => {
    const grouped = new Map<string, Product[]>();

    for (const product of products) {
      if (!product.producerId) {
        continue;
      }

      const list = grouped.get(product.producerId) ?? [];
      list.push(product);
      grouped.set(product.producerId, list);
    }

    return grouped;
  }, [products]);

  const producersWithProducts = useMemo(
    () => producers.filter((producer) => productsByProducerId.has(producer.id)),
    [producers, productsByProducerId],
  );

  const selectedProducer = selectedProducerId
    ? producerById.get(selectedProducerId) ?? null
    : null;

  const selectedProducts = selectedProducerId
    ? productsByProducerId.get(selectedProducerId) ?? []
    : [];

  const hoveredProducer =
    canHover && hoveredProducerId
      ? producerById.get(hoveredProducerId) ?? null
      : null;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const updateCapability = () => {
      setCanHover(mediaQuery.matches);
    };

    updateCapability();
    mediaQuery.addEventListener("change", updateCapability);

    return () => {
      mediaQuery.removeEventListener("change", updateCapability);
    };
  }, []);

  useEffect(() => {
    if (!canHover && hoveredProducerId) {
      setHoveredProducerId(null);
    }
  }, [canHover, hoveredProducerId]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedProducerId) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedProducerId(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedProducerId]);

  const queueHoverPosition = (clientX: number, clientY: number) => {
    if (!canHover) {
      return;
    }

    latestHoverRef.current = clampHoverPosition(clientX, clientY);
    if (rafRef.current !== null) {
      return;
    }

    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      setHoverPosition(latestHoverRef.current);
    });
  };

  const onBadgeClick = (producerId: string) => {
    setHoveredProducerId(null);
    setSelectedProducerId((current) => (current === producerId ? null : producerId));
  };

  if (producersWithProducts.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4">
        {producersWithProducts.map((producer) => (
          <ProducerBadge
            key={producer.id}
            producer={producer}
            isSelected={selectedProducerId === producer.id}
            controlsId={`producer-panel-${producer.id}`}
            onClick={() => onBadgeClick(producer.id)}
            onMouseEnter={(event) => {
              if (!canHover) {
                return;
              }
              setHoveredProducerId(producer.id);
              queueHoverPosition(event.clientX, event.clientY);
            }}
            onMouseMove={(event) => {
              queueHoverPosition(event.clientX, event.clientY);
            }}
            onMouseLeave={() => {
              setHoveredProducerId(null);
            }}
          />
        ))}
      </div>

      {hoveredProducer && !selectedProducer && (
        <ProducerHoverCard
          producer={hoveredProducer}
          x={hoverPosition.x}
          y={hoverPosition.y}
        />
      )}

      {selectedProducer ? (
        <ProducerDetailPanel
          producer={selectedProducer}
          products={selectedProducts}
          addButtonLabel={addButtonLabel}
          producerPartnerLabel={producerPartnerLabel}
          producerWebsiteLabel={producerWebsiteLabel}
          onOpenQuickView={onOpenQuickView}
          onClose={() => setSelectedProducerId(null)}
        />
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              producer={
                product.producerId ? producerById.get(product.producerId) : undefined
              }
              addButtonLabel={addButtonLabel}
              onOpenQuickView={
                onOpenQuickView
                  ? () => onOpenQuickView(product.id, products)
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
