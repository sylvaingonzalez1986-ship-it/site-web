import { PRODUCT_CULTURE_LABELS, type ProductCultureType } from "@/data/products";

type ProductCultureBadgeProps = {
  cultureMode: ProductCultureType;
  className?: string;
};

export function ProductCultureBadge({
  cultureMode,
  className = "",
}: ProductCultureBadgeProps) {
  const label = PRODUCT_CULTURE_LABELS[cultureMode];
  const normalizedClassName = className.trim();

  return (
    <span
      className={`product-culture-badge product-culture-badge--${cultureMode}${
        normalizedClassName ? ` ${normalizedClassName}` : ""
      }`}
      aria-label={`Mode de culture: ${label}`}
    >
      {label}
    </span>
  );
}
