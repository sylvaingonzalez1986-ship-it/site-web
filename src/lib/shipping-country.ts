/** Normalize checkout and carrier country values without guessing from a prefix. */
export function normalizeShippingCountryCode(value: string | null | undefined): string {
  const normalized = (value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  if (/^[A-Z]{2}$/.test(normalized)) {
    return normalized;
  }

  switch (normalized) {
    case "FRANCE":
      return "FR";
    case "BELGIQUE":
    case "BELGIUM":
    case "BELGIE":
    case "BELGIEN":
      return "BE";
    default:
      return "";
  }
}
