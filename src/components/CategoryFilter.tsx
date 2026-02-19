"use client";

import { categoryLabels, type ProductCategory } from "@/data/products";
import { cn } from "@/lib/utils";

type FilterValue = "all" | "promos" | ProductCategory;

type CategoryFilterProps = {
  selected: FilterValue;
  onChange: (value: FilterValue) => void;
};

const allFilters: FilterValue[] = [
  "all",
  "promos",
  ...(Object.keys(categoryLabels) as ProductCategory[]),
];

export function CategoryFilter({ selected, onChange }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {allFilters.map((filter) => {
        const label = filter === "all"
          ? "Tout"
          : filter === "promos"
            ? "🔥 Promos"
            : categoryLabels[filter];

        return (
          <button
            key={filter}
            type="button"
            onClick={() => onChange(filter)}
            className={cn(
              "pill-cartoon min-h-[44px] px-4 py-2 text-sm uppercase tracking-wide transition",
              selected === filter
                ? "bg-[#d35400] text-white border-[#1a1a1a]"
                : "bg-[#f7f4ee] text-[#1a1a1a]",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
