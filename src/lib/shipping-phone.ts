import { normalizeShippingCountryCode } from "@/lib/shipping-country";

// Belgian fixed lines have 8 subscriber digits; mobile numbers have 9 and start with 4.
const BELGIAN_SUBSCRIBER_NUMBER = /^(?:[1-9]\d{7}|4\d{8})$/;

/** Normalize a delivery contact number without assuming its prefix matches the destination. */
export function normalizeShippingPhone(
  value: string | null | undefined,
  country: string,
): string {
  const raw = value?.trim() ?? "";
  if (!raw || !/^[+\d\s()./-]+$/.test(raw)) {
    return "";
  }

  const compact = raw.replace(/[\s()./-]/g, "");
  let international = compact.startsWith("00") ? `+${compact.slice(2)}` : compact;

  if (!international.startsWith("+")) {
    const countryCode = normalizeShippingCountryCode(country);
    if (countryCode === "FR" && /^0[1-9]\d{8}$/.test(compact)) {
      international = `+33${compact.slice(1)}`;
    } else if (
      countryCode === "BE" &&
      compact.startsWith("0") &&
      BELGIAN_SUBSCRIBER_NUMBER.test(compact.slice(1))
    ) {
      international = `+32${compact.slice(1)}`;
    } else {
      return "";
    }
  }

  if (!/^\+[1-9]\d{7,14}$/.test(international)) {
    return "";
  }
  if (international.startsWith("+33") && !/^\+33[1-9]\d{8}$/.test(international)) {
    return "";
  }
  if (international.startsWith("+32") && !BELGIAN_SUBSCRIBER_NUMBER.test(international.slice(3))) {
    return "";
  }

  return international;
}
