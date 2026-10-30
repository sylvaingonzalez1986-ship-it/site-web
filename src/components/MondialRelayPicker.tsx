"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MondialRelayPoint } from "@/lib/shipping";
import { normalizeShippingCountryCode } from "@/lib/shipping-country";

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
  const [lookupFailed, setLookupFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const onSelectRef = useRef(onSelect);

  const pickerHeightClassName = minHeightClassName.trim() || "min-h-[420px]";
  const normalizedPostalCode = useMemo(() => postalCode.trim(), [postalCode]);
  const normalizedCity = useMemo(() => city.trim(), [city]);
  const normalizedCountry = useMemo(() => normalizeShippingCountryCode(country), [country]);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!normalizedCountry) {
      setPoints([]);
      setStatus("Renseigne le pays de livraison (par exemple : Belgique).");
      setIsLoading(false);
      setLookupFailed(false);
      return;
    }
    const hasPostalCode = normalizedPostalCode.length >= 4;
    if (!hasPostalCode) {
      setPoints([]);
      setStatus("Renseigne un code postal pour afficher les Points Relais.");
      setIsLoading(false);
      setLookupFailed(false);
      return;
    }

    const controller = new AbortController();
    let disposed = false;
    const timeoutId = window.setTimeout(async () => {
      setIsLoading(true);
      setLookupFailed(false);
      setStatus("Recherche des Points Relais...");
      const requestTimeout = window.setTimeout(() => controller.abort(), 12_000);

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
        if (disposed) return;
        if (!data || controller.signal.aborted) throw new Error("Réponse de livraison indisponible");
        if (!response.ok) {
          setPoints([]);
          setLookupFailed(true);
          setStatus(data?.error ?? "Impossible de charger les Points Relais.");
          return;
        }

        const nextPoints = Array.isArray(data?.points)
          ? data.points.filter((point) => normalizeShippingCountryCode(point.country) === normalizedCountry)
          : [];
        setPoints(nextPoints);

        if (nextPoints.length === 0) {
          setStatus(data?.message ?? "Aucun Point Relais trouvé. Essaie un autre code postal proche.");
          return;
        }

        setStatus(null);
      } catch {
        if (disposed) {
          return;
        }
        setPoints([]);
        setLookupFailed(true);
        setStatus("La recherche des Points Relais n’a pas abouti. Réessaie sans ressaisir ton adresse, ou choisis la livraison à domicile.");
      } finally {
        window.clearTimeout(requestTimeout);
        if (!disposed) {
          setIsLoading(false);
        }
      }
    }, 250);

    return () => {
      disposed = true;
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [attempt, normalizedCity, normalizedCountry, normalizedPostalCode]);

  return (
    <div className="mondial-relay-widget grid gap-2">
      <div
        className={`${pickerHeightClassName} overflow-y-auto rounded-[2px] border-2 border-[#00563f] bg-[#fffaf1] p-2`}
      >
        {points.length > 0 ? (
          <div className="grid gap-2">
            {points.map((point) => {
              const isSelected = selectedPoint?.id === point.id &&
                normalizeShippingCountryCode(selectedPoint.country) === normalizeShippingCountryCode(point.country);
              return (
                <button
                  key={`${point.country}-${point.id}`}
                  type="button"
                  aria-pressed={isSelected}
                  className={`w-full rounded-[2px] border-2 px-3 py-3 text-left transition-colors ${
                    isSelected
                      ? "border-[#00563f] bg-[#e8efe4]"
                      : "border-[#00563f40] bg-[#fffaf1] hover:bg-[#e8efe4]"
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
          <div className="flex h-full min-h-[120px] items-center justify-center rounded-[2px] border-2 border-dashed border-[#00563f] bg-[#fffaf1] p-4 text-center text-sm text-charcoal">
            {isLoading ? "Recherche en cours..." : "Aucun Point Relais chargé."}
          </div>
        )}
      </div>

      {status && (
        <p role="status" aria-live="polite" className="text-sm font-semibold text-charcoal md:text-xs">
          {status}
        </p>
      )}
      {lookupFailed && (
        <button type="button" className="btn-cartoon btn-secondary min-h-11" disabled={isLoading} onClick={() => setAttempt((value) => value + 1)}>
          Réessayer la recherche
        </button>
      )}

      {selectedPoint && (
        <p className="text-sm text-charcoal md:text-xs">
          Point sélectionné: {selectedPoint.name}, {selectedPoint.postalCode} {selectedPoint.city}
        </p>
      )}
    </div>
  );
}

