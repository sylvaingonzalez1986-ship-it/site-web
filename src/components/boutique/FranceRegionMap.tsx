"use client";

import {
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import styles from "./RegionMarket.module.css";
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
  onRegionClick: (region: FrenchRegion, source?: { x: number; y: number }) => void;
  producerCountByRegion: Partial<Record<FrenchRegion, number>>;
};

type TooltipState = {
  region: FrenchRegion;
  x: number;
  y: number;
} | null;

const REGION_LABEL_LINES: Partial<Record<FrenchRegion, string[]>> = {
  "Centre-Val de Loire": ["Centre-Val", "de Loire"],
  "Bourgogne-Franche-Comte": ["Bourgogne-", "Franche-Comté"],
  "Pays de la Loire": ["Pays de", "la Loire"],
  "Nouvelle-Aquitaine": ["Nouvelle-", "Aquitaine"],
  "Auvergne-Rhone-Alpes": ["Auvergne-", "Rhône-Alpes"],
  "Provence-Alpes-Cote d'Azur": ["Provence-Alpes-", "Côte d'Azur"],
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

export function FranceRegionMap({
  selectedRegion,
  onRegionClick,
  producerCountByRegion,
}: FranceRegionMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>(null);

  const showTooltip = (region: FrenchRegion, clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    setTooltip({
      region,
      x: Math.max(8, Math.min(clientX - rect.left, rect.width - 208)),
      y: Math.max(80, clientY - rect.top),
    });
  };

  const hideTooltip = () => {
    setTooltip(null);
  };

  const handleMouseMove = (region: FrenchRegion, event: MouseEvent<SVGPathElement>) => {
    showTooltip(region, event.clientX, event.clientY);
  };

  const handleFocus = (region: FrenchRegion, event: FocusEvent<SVGPathElement>) => {
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

  const handleRegionClick = (
    region: FrenchRegion,
    event: MouseEvent<SVGPathElement> | MouseEvent<HTMLButtonElement>,
  ) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const source = rect
      ? {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        }
      : undefined;

    onRegionClick(region, source);
  };

  return (
    <div ref={containerRef} className={`region-map-shell ${styles.map}`}>
      <svg
        className="region-map-svg"
        viewBox={`0 0 ${FRANCE_REGION_MAP_VIEWBOX.width} ${FRANCE_REGION_MAP_VIEWBOX.height}`}
        role="group"
        aria-label="Carte des producteurs par région"
      >
        {FRANCE_REGION_PATHS.map((feature) => {
          const region = feature.region as FrenchRegion;
          const count = producerCountByRegion[region] ?? 0;
          const isSelected = selectedRegion === region;
          const hasProducers = count > 0;
          return (
            <g key={region} className="region-map-region" data-populated={hasProducers} data-selected={isSelected}>
              <path
                d={feature.path}
                role="button"
                tabIndex={0}
                aria-label={`${FRENCH_REGION_LABELS[region]}${count > 0 ? `, ${count} producteur${count > 1 ? "s" : ""}` : ", aucun producteur"}`}
                aria-pressed={isSelected}
                className={`region-path ${hasProducers ? "region-path--has-producers" : "region-path--empty"} ${isSelected ? "region-path--selected" : ""}`}
                onClick={(event) => handleRegionClick(region, event)}
                onKeyDown={handleKeyDown(region)}
                onMouseMove={(event) => handleMouseMove(region, event)}
                onMouseLeave={() => {
                  hideTooltip();
                }}
                onFocus={(event) => handleFocus(region, event)}
                onBlur={() => {
                  hideTooltip();
                }}
              />

            </g>
          );
        })}
        {/* Draw labels last so neighboring regions cannot cover them. */}
        {FRANCE_REGION_PATHS.map((feature) => {
          const region = feature.region as FrenchRegion;
          const count = producerCountByRegion[region] ?? 0;
          const hasProducers = count > 0;
          const labelLines = getRegionLabelLines(region);
          const labelOffset = REGION_LABEL_OFFSETS[region];
          const labelX = feature.labelX + (labelOffset?.x ?? 0);
          const labelY = feature.labelY + (labelOffset?.y ?? 0);
          const textAnchor = labelOffset?.textAnchor ?? "middle";

          return (
            <g key={region} data-populated={hasProducers} data-selected={selectedRegion === region} data-hovered={tooltip?.region === region} aria-hidden="true" pointerEvents="none">
              {hasProducers && (
                <g
                  className="region-pin"
                  aria-hidden="true"
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

      <div className={styles.legend} aria-label="Légende de la carte">
        <span><i data-kind="present" /> Producteurs présents</span>
        <span><i data-kind="selected" /> Région choisie</span>
      </div>
      <label className={styles.mobileSelect}>
        Choisir une région
        <select value={selectedRegion ?? ""} onChange={(event) => { if (event.target.value) onRegionClick(event.target.value as FrenchRegion); }}>
          <option value="" disabled>Toutes les régions</option>
          {Object.entries(FRENCH_REGION_LABELS).map(([region, label]) => <option key={region} value={region}>{label} ({producerCountByRegion[region as FrenchRegion] ?? 0})</option>)}
        </select>
      </label>
      <p className={styles.overseasLabel}>Les territoires d’outre-mer</p>
      <div className="domtom-inset-grid" aria-label="Producteurs en outre-mer">
        {DOM_TOM_REGIONS.map((region) => {
          const count = producerCountByRegion[region] ?? 0;
          const isSelected = selectedRegion === region;

          return (
            <button
              key={region}
              type="button"
              className={`region-domtom-card ${isSelected ? "region-domtom-card--selected" : ""}`}
              onClick={(event) => handleRegionClick(region, event)}
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
          className="region-map-tooltip" role="tooltip"
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
