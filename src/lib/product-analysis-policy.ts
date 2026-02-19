export const PRODUCT_ANALYSIS_PUBLIC_UPLOAD_PREFIX = "/uploads/product-analyses/";
export const PRODUCT_ANALYSIS_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
export const PRODUCT_ANALYSIS_ACCEPT_ATTRIBUTE = ".pdf";

export const PRODUCT_ANALYSIS_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/x-pdf",
] as const;

export type ProductAnalysisMimeType = (typeof PRODUCT_ANALYSIS_ALLOWED_MIME_TYPES)[number];

export function isSupportedProductAnalysisMimeType(
  mimeType: string,
): mimeType is ProductAnalysisMimeType {
  return PRODUCT_ANALYSIS_ALLOWED_MIME_TYPES.includes(mimeType as ProductAnalysisMimeType);
}

