import type { Product } from "@/data/products";

const UNSUPPORTED_EFFECT_SENTENCE =
  /Appréciée\s+pour\s+ses\s+effets\s+relaxants\s+et\s+équilibrés,\s+elle\s+procure\s+une\s+détente\s+douce\s+tout\s+en\s+conservant\s+une\s+sensation\s+de\s+clarté\s+mentale\.\s*/giu;

const CLAIM_WORD_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\brelaxants\b/giu, "aromatiques"],
  [/\brelaxantes\b/giu, "aromatiques"],
  [/\brelaxant\b/giu, "aromatique"],
  [/\brelaxante\b/giu, "aromatique"],
  [/\bapaisants\b/giu, "agréables"],
  [/\bapaisantes\b/giu, "agréables"],
  [/\bapaisant\b/giu, "agréable"],
  [/\bapaisante\b/giu, "agréable"],
];

export const UNSUPPORTED_PUBLIC_PRODUCT_CLAIM =
  /\b(?:effets?\s+(?:relaxants?|apaisants?|calmants?)|détente\s+(?:douce|profonde)|clarté\s+mentale|relaxants?|apaisants?|calmants?|anxiolytiques?|antalgiques?|anti-inflammatoires?|thérapeutiques?)\b/iu;

export function sanitizePublicProductDescription(description: string): string {
  let sanitized = description.replace(UNSUPPORTED_EFFECT_SENTENCE, "");

  for (const [pattern, replacement] of CLAIM_WORD_REPLACEMENTS) {
    sanitized = sanitized.replace(pattern, replacement);
  }

  return sanitized.replace(/\n{3,}/g, "\n\n").trim();
}

export function sanitizePublicProductCopy(product: Product): Product {
  const description = sanitizePublicProductDescription(product.description);
  return description === product.description ? product : { ...product, description };
}
