"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MondialRelayPoint } from "@/lib/shipping";

type MondialRelayPickerProps = {
  postalCode: string;
  city: string;
  country: string;
  selectedPoint: MondialRelayPoint | null;
  onSelect: (point: MondialRelayPoint) => void;
  minHeightClassName: string;
};

type RelayLookupResponse = {
  points?: MondialRelayPoint[];
  message?: string;
  error?: string;
};

function sanitizeCountry(value: string | undefined): string {
  const safe = (value || "FR").trim().toUpperCase();
  if (safe.length < 2) {
    return "FR";
  }
  return safe.slice(0, 2);
}

export function MondialRelayPicker({
  postalCode,
  city,
  country = "FR",
  selectedPoint,
  onSelect,
  minHeightClassName,
}: MondialRelayPickerProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [points, setPoints] = useState<MondialRelayPoint[]>([]);
  const onSelectRef = useRef(onSelect);

  const pickerHeightClassName = minHeightClassName.trim() || "min-h-[420px]";
  const normalizedPostalCode = useMemo(() => postalCode.trim(), [postalCode]);
  const normalizedCity = useMemo(() => city.trim(), [city]);
  const normalizedCountry = useMemo(() => sanitizeCountry(country), [country]);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const hasPostalCode = normalizedPostalCode.length >= 4;
    if (!hasPostalCode) {
      setPoints([]);
      setStatus("Renseigne un code postal pour afficher les Points Relais.");
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsLoading(true);
      setStatus("Recherche des Points Relais...");

      try {
        const query = new URLSearchParams({
          postalCode: normalizedPostalCode,
          country: normalizedCountry,
        });
        if (normalizedCity.length >= 2) {
          query.set("city", normalizedCity);
        }

        const response = await fetch(`/api/relay/points?${query.toString()}`, {
          method: "GET",
          signal: controller.signal,
          cache: "no-store",
        });

        const data = (await response.json().catch(() => null)) as RelayLookupResponse | null;
        if (!response.ok) {
          setPoints([]);
          setStatus(data?.error ?? "Impossible de charger les Points Relais.");
          return;
        }

        const nextPoints = Array.isArray(data?.points) ? data.points : [];
        setPoints(nextPoints);

        if (nextPoints.length === 0) {
          setStatus(data?.message ?? "Aucun Point Relais trouvé. Essaie un autre code postal proche.");
          return;
        }

        setStatus(null);
      } catch {
        if (controller.signal.aborted) {
          return;
        }
        setPoints([]);
        setStatus("Impossible de charger Mondial Relay. Réessaie dans quelques secondes.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [normalizedCity, normalizedCountry, normalizedPostalCode]);

  return (
    <div className="mondial-relay-widget grid gap-2">
      <div
        className={`${pickerHeightClassName} overflow-y-auto rounded-[12px] border-2 border-[#1a1a1a] bg-white p-2`}
      >
        {points.length > 0 ? (
          <div className="grid gap-2">
            {points.map((point) => {
              const isSelected = selectedPoint?.id === point.id;
              return (
                <button
                  key={point.id}
                  type="button"
                  className={`w-full rounded border-2 px-3 py-3 text-left transition-colors ${
                    isSelected
                      ? "border-[#0a7b61] bg-[#e6f5ef]"
                      : "border-[#1a1a1a] bg-[#fff8f0] hover:bg-[#f2ede2]"
                  }`}
                  onClick={() => onSelectRef.current(point)}
                >
                  <p className="text-sm font-bold text-ink">{point.name}</p>
                  <p className="mt-1 text-xs text-charcoal">{point.address}</p>
                  <p className="text-xs text-charcoal">
                    {point.postalCode} {point.city} ({point.country})
                  </p>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex h-full min-h-[120px] items-center justify-center rounded border-2 border-dashed border-[#1a1a1a] bg-[#f7f4ee] p-4 text-center text-sm text-charcoal">
            {isLoading ? "Recherche en cours..." : "Aucun Point Relais chargé."}
          </div>
        )}
      </div>

      {status && (
        <p role="status" aria-live="polite" className="text-sm font-semibold text-charcoal md:text-xs">
          {status}
        </p>
      )}

      {selectedPoint && (
        <p className="text-sm text-charcoal md:text-xs">
          Point sélectionné: {selectedPoint.name}, {selectedPoint.postalCode} {selectedPoint.city}
        </p>
      )}
    </div>
  );
}

