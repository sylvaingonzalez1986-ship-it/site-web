export const formatPrice = (value: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(value);

export const cn = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(" ");
