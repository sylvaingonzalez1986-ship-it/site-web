export class ContestReviewVersionConflictError extends Error {
  constructor(message = "Cet avis a changé depuis son chargement. Relis sa nouvelle version avant de le modérer.") {
    super(message);
    this.name = "ContestReviewVersionConflictError";
  }
}

export function isContestReviewVersion(value: unknown): value is string {
  return typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value));
}
