type ContestAnalysisSource = {
  product?: {
    analysisPdf?: string;
  } | null;
  technicalSheet?: Record<string, unknown> | null;
};

const TECHNICAL_ANALYSIS_FIELDS = [
  "analysisPdf",
  "analysisUrl",
  "analysis_pdf",
  "labAnalysisUrl",
  "certificateUrl",
  "certificatePdf",
  "coaUrl",
  "coaPdf",
] as const;

export function normalizeContestAnalysisUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    return null;
  }

  return null;
}

export function getContestEntryAnalysisUrl(entry: ContestAnalysisSource): string | null {
  const productAnalysisUrl = normalizeContestAnalysisUrl(entry.product?.analysisPdf);
  if (productAnalysisUrl) {
    return productAnalysisUrl;
  }

  const technicalSheet = entry.technicalSheet ?? {};
  for (const field of TECHNICAL_ANALYSIS_FIELDS) {
    const analysisUrl = normalizeContestAnalysisUrl(technicalSheet[field]);
    if (analysisUrl) {
      return analysisUrl;
    }
  }

  return null;
}
