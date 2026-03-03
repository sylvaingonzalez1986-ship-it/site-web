"use client";

import {
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import {
  DOM_TOM_REGIONS,
  FRENCH_REGION_LABELS,
  type FrenchRegion,
} from "@/data/france-geo";
import {
  FRANCE_REGION_MAP_VIEWBOX,
  FRANCE_REGION_PATHS,
} from "@/data/france-region-map";

type FranceRegionMapProps = {
  selectedRegion: FrenchRegion | null;
  onRegionClick: (region: FrenchRegion) => void;
  producerCountByRegion: Partial<Record<FrenchRegion, number>>;
};

type TooltipState = {
  region: FrenchRegion;
  x: number;
  y: number;
} | null;

const REGION_FILL_TINTS = ["#e8d8b8", "#d4c9a8", "#c5d4b2", "#d5c4a1"] as const;

const REGION_LABEL_LINES: Partial<Record<FrenchRegion, string[]>> = {
  "Centre-Val de Loire": ["Centre-Val", "de Loire"],
  "Bourgogne-Franche-Comte": ["Bourgogne-", "Franche-Comte"],
  "Pays de la Loire": ["Pays de", "la Loire"],
  "Nouvelle-Aquitaine": ["Nouvelle-", "Aquitaine"],
  "Auvergne-Rhone-Alpes": ["Auvergne-", "Rhone-Alpes"],
  "Provence-Alpes-Cote d'Azur": ["Provence-Alpes-", "Cote d'Azur"],
};

const REGION_LABEL_OFFSETS: Partial<
  Record<FrenchRegion, { x?: number; y?: number; textAnchor?: "start" | "middle" | "end" }>
> = {
  "Ile-de-France": { x: 34, y: -18, textAnchor: "start" },
  "Hauts-de-France": { y: -8 },
  "Pays de la Loire": { x: -6, y: 10 },
  Bretagne: { x: -18, y: -6 },
  "Provence-Alpes-Cote d'Azur": { x: 20, y: 18, textAnchor: "start" },
  Corse: { x: -20, y: 0, textAnchor: "end" },
};

const DOM_TOM_SHAPE_PATH =
  "M8 12C12 5 26 5 31 11C35 15 35 23 27 27C21 30 10 28 7 22C5 18 6 14 8 12Z";

function getRegionLabelLines(region: FrenchRegion): string[] {
  return REGION_LABEL_LINES[region] ?? [FRENCH_REGION_LABELS[region]];
}

function getRegionHoverFill(fill: string): string {
  if (fill === "#ebe6dd") {
    return "#e1dbd2";
  }

  return fill;
}

function regionHasProducers(
  producerCountByRegion: Partial<Record<FrenchRegion, number>>,
  region: FrenchRegion,
): boolean {
  return (producerCountByRegion[region] ?? 0) > 0;
}

export function FranceRegionMap({
  selectedRegion,
  onRegionClick,
  producerCountByRegion,
}: FranceRegionMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<FrenchRegion | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>(null);

  const fillByRegion = useMemo(() => {
    const filledRegions = FRANCE_REGION_PATHS.filter((feature) =>
      regionHasProducers(producerCountByRegion, feature.region as FrenchRegion),
    );

    return new Map(
      filledRegions.map((feature, index) => [
        feature.region as FrenchRegion,
        REGION_FILL_TINTS[index % REGION_FILL_TINTS.length],
      ]),
    );
  }, [producerCountByRegion]);

  const showTooltip = (region: FrenchRegion, clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    setTooltip({
      region,
      x: clientX - rect.left,
      y: clientY - rect.top,
    });
  };

  const hideTooltip = () => {
    setTooltip(null);
  };

  const handleMouseMove = (region: FrenchRegion, event: MouseEvent<SVGPathElement>) => {
    setHoveredRegion(region);
    showTooltip(region, event.clientX, event.clientY);
  };

  const handleFocus = (region: FrenchRegion, event: FocusEvent<SVGPathElement>) => {
    setHoveredRegion(region);
    const rect = event.currentTarget.getBoundingClientRect();
    showTooltip(region, rect.left + rect.width / 2, rect.top + rect.height / 2);
  };

  const handleKeyDown =
    (region: FrenchRegion) => (event: KeyboardEvent<SVGPathElement | HTMLButtonElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onRegionClick(region);
      }
    };

  return (
    <div ref={containerRef} className="region-map-shell">
      <svg
        className="region-map-svg"
        viewBox={`0 0 ${FRANCE_REGION_MAP_VIEWBOX.width} ${FRANCE_REGION_MAP_VIEWBOX.height}`}
        role="img"
        aria-label="Carte des producteurs par region"
      >
        {FRANCE_REGION_PATHS.map((feature) => {
          const region = feature.region as FrenchRegion;
          const count = producerCountByRegion[region] ?? 0;
          const isSelected = selectedRegion === region;
          const hasProducers = count > 0;
          const baseFill = isSelected
            ? "var(--yellow)"
            : fillByRegion.get(region) ?? "#ebe6dd";
          const labelLines = getRegionLabelLines(region);
          const labelOffset = REGION_LABEL_OFFSETS[region];
          const labelX = feature.labelX + (labelOffset?.x ?? 0);
          const labelY = feature.labelY + (labelOffset?.y ?? 0);
          const textAnchor = labelOffset?.textAnchor ?? "middle";
          const pinActive = hoveredRegion === region || isSelected;

          return (
            <g key={region} className="region-map-region">
              <path
                d={feature.path}
                role="button"
                tabIndex={0}
                aria-label={`${FRENCH_REGION_LABELS[region]}${count > 0 ? `, ${count} producteur${count > 1 ? "s" : ""}` : ", aucun producteur"}`}
                aria-pressed={isSelected}
                className={`region-path ${hasProducers ? "region-path--has-producers" : "region-path--empty"} ${isSelected ? "region-path--selected" : ""}`}
                style={
                  {
                    fill: baseFill,
                    "--region-hover-fill": getRegionHoverFill(baseFill),
                  } as CSSProperties
                }
                onClick={() => onRegionClick(region)}
                onKeyDown={handleKeyDown(region)}
                onMouseMove={(event) => handleMouseMove(region, event)}
                onMouseLeave={() => {
                  setHoveredRegion((current) => (current === region ? null : current));
                  hideTooltip();
                }}
                onFocus={(event) => handleFocus(region, event)}
                onBlur={() => {
                  setHoveredRegion((current) => (current === region ? null : current));
                  hideTooltip();
                }}
              />

              {hasProducers && (
                <g
                  className={`region-pin ${pinActive ? "region-pin--active" : ""}`}
                  transform={`translate(${feature.labelX}, ${feature.labelY - 18})`}
                >
                  <path d="M0 -10C4.5 -10 8 -6.5 8 -2C8 3 0 11 0 11S-8 3 -8 -2C-8 -6.5 -4.5 -10 0 -10Z" />
                  <circle cx="0" cy="-2.5" r="2.8" fill="var(--cream)" stroke="var(--ink)" />
                </g>
              )}

              <text
                x={labelX}
                y={labelY}
                textAnchor={textAnchor}
                className="region-label"
                aria-hidden="true"
              >
                {labelLines.map((line, index) => (
                  <tspan
                    key={`${region}-${line}`}
                    x={labelX}
                    dy={index === 0 ? 0 : 14}
                  >
                    {line}
                  </tspan>
                ))}
                {count > 0 && (
                  <tspan x={labelX} dy={14} className="region-label-count">
                    ({count})
                  </tspan>
                )}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="domtom-inset-grid" aria-label="Encarts DOM-TOM">
        {DOM_TOM_REGIONS.map((region) => {
          const count = producerCountByRegion[region] ?? 0;
          const isSelected = selectedRegion === region;

          return (
            <button
              key={region}
              type="button"
              className={`region-domtom-card cartoon-border-sm ${isSelected ? "region-domtom-card--selected" : ""}`}
              onClick={() => onRegionClick(region)}
              onKeyDown={handleKeyDown(region)}
              aria-pressed={isSelected}
            >
              <svg
                className="region-domtom-shape"
                viewBox="0 0 40 34"
                aria-hidden="true"
              >
                <path d={DOM_TOM_SHAPE_PATH} className="region-domtom-shape-fill" />
              </svg>
              <span className="region-domtom-label">{FRENCH_REGION_LABELS[region]}</span>
              <span className="region-domtom-count">
                {count > 0 ? `${count} producteur${count > 1 ? "s" : ""}` : "Aucun producteur"}
              </span>
            </button>
          );
        })}
      </div>

      {tooltip && (
        <div
          className="region-map-tooltip cartoon-border-sm"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <strong className="font-display text-lg leading-none text-ink">
            {FRENCH_REGION_LABELS[tooltip.region]}
          </strong>
          <span className="font-handwritten text-base text-charcoal">
            {producerCountByRegion[tooltip.region] ?? 0} producteur
            {(producerCountByRegion[tooltip.region] ?? 0) > 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  );
}
