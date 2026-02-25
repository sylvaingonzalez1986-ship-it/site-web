type TutorialEventName =
  | "start"
  | "skip"
  | "complete"
  | "step_view"
  | "step_next"
  | "step_prev"
  | "missing_target";

type TutorialEventPayload = {
  stepId: string;
  stepIndex: number;
  totalSteps: number;
  pathname: string;
  source?: string;
};

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

export function trackTutorialEvent(eventName: TutorialEventName, payload: TutorialEventPayload): void {
  if (typeof window === "undefined") {
    return;
  }

  const event = `tutorial_${eventName}`;
  const eventPayload = {
    event,
    ...payload,
  };

  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push(eventPayload);
  }

  window.dispatchEvent(
    new CustomEvent("lcb:tutorial", {
      detail: eventPayload,
    }),
  );
}
