"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { TutorialOverlay } from "@/components/tutorial/TutorialOverlay";
import { HOME_TUTORIAL_STEPS, TUTORIAL_VERSION, type TutorialStep } from "@/data/tutorial-steps";
import { useCart } from "@/context/CartContext";
import { applyTutorialCmsPageOverrides } from "@/lib/tutorial-cms-pages";
import { trackTutorialEvent } from "@/lib/tutorial-analytics";
import type { CmsPage } from "@/types/cms-pages";

const TUTORIAL_STORAGE_KEY = "lcb_tutorial_state";
const AGE_GATE_COOKIE_NAME = "age_verified";
const AUTO_START_DELAY_MS = 1500;
const CMS_PAGES_UPDATED_EVENT = "lcb:cms-pages-updated";

type PersistedTutorialState = {
  version: number;
  completed: boolean;
  skipped: boolean;
  inProgress: boolean;
  currentStep: number;
};

type TutorialContextValue = {
  isEnabled: boolean;
  isActive: boolean;
  restartTutorial: () => void;
};

const TutorialContext = createContext<TutorialContextValue | null>(null);

const DEFAULT_PERSISTED_STATE: PersistedTutorialState = {
  version: TUTORIAL_VERSION,
  completed: false,
  skipped: false,
  inProgress: false,
  currentStep: 0,
};

function resolveTutorialEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_TUTORIAL_ENABLED?.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "off") {
    return false;
  }

  return true;
}

function hasAgeVerifiedCookie(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  return document.cookie
    .split(";")
    .map((chunk) => chunk.trim())
    .some((chunk) => chunk === `${AGE_GATE_COOKIE_NAME}=true`);
}

function clampStepIndex(index: number, totalSteps: number): number {
  const maxIndex = Math.max(totalSteps - 1, 0);
  return Math.min(Math.max(index, 0), maxIndex);
}

function readPersistedState(): PersistedTutorialState {
  if (typeof window === "undefined") {
    return DEFAULT_PERSISTED_STATE;
  }

  try {
    const raw = window.localStorage.getItem(TUTORIAL_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_PERSISTED_STATE;
    }

    const parsed = JSON.parse(raw) as Partial<PersistedTutorialState>;
    if (
      typeof parsed.version !== "number" ||
      typeof parsed.completed !== "boolean" ||
      typeof parsed.skipped !== "boolean" ||
      typeof parsed.inProgress !== "boolean" ||
      typeof parsed.currentStep !== "number"
    ) {
      return DEFAULT_PERSISTED_STATE;
    }

    return {
      version: parsed.version,
      completed: parsed.completed,
      skipped: parsed.skipped,
      inProgress: parsed.inProgress,
      currentStep: parsed.currentStep,
    };
  } catch {
    return DEFAULT_PERSISTED_STATE;
  }
}

function writePersistedState(state: PersistedTutorialState): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(state));
}

export function TutorialProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, authLoading } = useCart();
  const [tutorialCmsPages, setTutorialCmsPages] = useState<CmsPage[]>([]);
  const [tutorialCmsLoaded, setTutorialCmsLoaded] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [pendingRestart, setPendingRestart] = useState(false);
  const isEnabled = useMemo(() => resolveTutorialEnabled(), []);
  const autoStartAttemptedRef = useRef(false);
  const lastViewedStepRef = useRef<string | null>(null);

  const loadTutorialCmsPages = useCallback(async () => {
    try {
      const response = await fetch("/api/public/tutorial", { cache: "no-store" });
      if (!response.ok) {
        setTutorialCmsPages([]);
        return;
      }

      const payload = (await response.json()) as { pages?: CmsPage[] };
      setTutorialCmsPages(Array.isArray(payload.pages) ? payload.pages : []);
    } catch {
      setTutorialCmsPages([]);
    } finally {
      setTutorialCmsLoaded(true);
    }
  }, []);

  useEffect(() => {
    void loadTutorialCmsPages();
  }, [loadTutorialCmsPages]);

  useEffect(() => {
    const onCmsPagesUpdated = () => {
      void loadTutorialCmsPages();
    };

    window.addEventListener(CMS_PAGES_UPDATED_EVENT, onCmsPagesUpdated);
    return () => {
      window.removeEventListener(CMS_PAGES_UPDATED_EVENT, onCmsPagesUpdated);
    };
  }, [loadTutorialCmsPages]);

  const cmsOverriddenTutorialSteps = useMemo(
    () => applyTutorialCmsPageOverrides(HOME_TUTORIAL_STEPS, tutorialCmsPages),
    [tutorialCmsPages],
  );

  const tutorialSteps = useMemo(() => {
    const filtered = cmsOverriddenTutorialSteps.filter(
      (step) => !step.requiresAuth || isAuthenticated,
    );
    return filtered.length > 0 ? filtered : cmsOverriddenTutorialSteps;
  }, [cmsOverriddenTutorialSteps, isAuthenticated]);

  const clampIndex = useCallback(
    (index: number) => clampStepIndex(index, tutorialSteps.length),
    [tutorialSteps.length],
  );

  const persist = useCallback((patch: Partial<PersistedTutorialState>) => {
    const previous = readPersistedState();
    const next: PersistedTutorialState = {
      ...previous,
      ...patch,
      version: TUTORIAL_VERSION,
      currentStep: clampIndex(
        typeof patch.currentStep === "number" ? patch.currentStep : previous.currentStep,
      ),
    };
    writePersistedState(next);
  }, [clampIndex]);

  const getStepByIndex = useCallback(
    (index: number): TutorialStep => {
      return tutorialSteps[clampIndex(index)] ?? tutorialSteps[0];
    },
    [clampIndex, tutorialSteps],
  );

  const startTutorialAt = useCallback(
    (stepIndex: number, source: string) => {
      const nextIndex = clampIndex(stepIndex);
      const step = getStepByIndex(nextIndex);
      setCurrentStepIndex(nextIndex);
      setIsActive(true);
      persist({
        completed: false,
        skipped: false,
        inProgress: true,
        currentStep: nextIndex,
      });
      trackTutorialEvent("start", {
        stepId: step.id,
        stepIndex: nextIndex,
        totalSteps: tutorialSteps.length,
        pathname,
        source,
      });
    },
    [clampIndex, getStepByIndex, pathname, persist, tutorialSteps.length],
  );

  const completeTutorial = useCallback(() => {
    const finalIndex = tutorialSteps.length - 1;
    const step = getStepByIndex(finalIndex);
    setIsActive(false);
    persist({
      completed: true,
      skipped: false,
      inProgress: false,
      currentStep: finalIndex,
    });
    trackTutorialEvent("complete", {
      stepId: step.id,
      stepIndex: finalIndex,
      totalSteps: tutorialSteps.length,
      pathname,
      source: "finish_button",
    });
  }, [getStepByIndex, pathname, persist, tutorialSteps.length]);

  const skipTutorial = useCallback(
    (source = "skip_button") => {
      const step = getStepByIndex(currentStepIndex);
      setIsActive(false);
      persist({
        completed: false,
        skipped: true,
        inProgress: false,
        currentStep: currentStepIndex,
      });
      trackTutorialEvent("skip", {
        stepId: step.id,
        stepIndex: currentStepIndex,
        totalSteps: tutorialSteps.length,
        pathname,
        source,
      });
    },
    [currentStepIndex, getStepByIndex, pathname, persist, tutorialSteps.length],
  );

  const nextStep = useCallback(() => {
    setCurrentStepIndex((previous) => {
      const isLast = previous >= tutorialSteps.length - 1;
      if (isLast) {
        completeTutorial();
        return previous;
      }

      const current = getStepByIndex(previous);
      const next = clampIndex(previous + 1);
      const destination = getStepByIndex(next);
      persist({
        inProgress: true,
        currentStep: next,
      });
      trackTutorialEvent("step_next", {
        stepId: destination.id,
        stepIndex: next,
        totalSteps: tutorialSteps.length,
        pathname,
        source: current.id,
      });
      return next;
    });
  }, [clampIndex, completeTutorial, getStepByIndex, pathname, persist, tutorialSteps.length]);

  const prevStep = useCallback(() => {
    setCurrentStepIndex((previous) => {
      const from = getStepByIndex(previous);
      const next = clampIndex(previous - 1);
      const destination = getStepByIndex(next);
      persist({
        inProgress: true,
        currentStep: next,
      });
      trackTutorialEvent("step_prev", {
        stepId: destination.id,
        stepIndex: next,
        totalSteps: tutorialSteps.length,
        pathname,
        source: from.id,
      });
      return next;
    });
  }, [clampIndex, getStepByIndex, pathname, persist, tutorialSteps.length]);

  const restartTutorial = useCallback(() => {
    persist({
      completed: false,
      skipped: false,
      inProgress: false,
      currentStep: 0,
    });

    void (async () => {
      await loadTutorialCmsPages();

      if (pathname !== "/") {
        setPendingRestart(true);
        router.push("/");
        return;
      }

      startTutorialAt(0, "manual_restart");
    })();
  }, [loadTutorialCmsPages, pathname, persist, router, startTutorialAt]);

  const currentStep = getStepByIndex(currentStepIndex);

  useEffect(() => {
    if (!isEnabled || !isActive) {
      return;
    }

    if (!currentStep.route || pathname === currentStep.route) {
      return;
    }

    router.push(currentStep.route);
  }, [currentStep.route, isActive, isEnabled, pathname, router]);

  useEffect(() => {
    if (!isEnabled || !isActive) {
      return;
    }

    const isRouteReady = !currentStep.route || pathname === currentStep.route;
    if (!isRouteReady) {
      return;
    }

    const viewKey = `${currentStep.id}:${currentStepIndex}:${pathname}`;
    if (lastViewedStepRef.current === viewKey) {
      return;
    }

    lastViewedStepRef.current = viewKey;
    trackTutorialEvent("step_view", {
      stepId: currentStep.id,
      stepIndex: currentStepIndex,
      totalSteps: tutorialSteps.length,
      pathname,
      source: "overlay_visible",
    });
  }, [
    currentStep.id,
    currentStep.route,
    currentStepIndex,
    isActive,
    isEnabled,
    pathname,
    tutorialSteps.length,
  ]);

  useEffect(() => {
    if (!isEnabled || isActive || authLoading || !tutorialCmsLoaded) {
      return;
    }
    if (autoStartAttemptedRef.current) {
      return;
    }

    const persisted = readPersistedState();
    const hasVersionMismatch = persisted.version !== TUTORIAL_VERSION;
    const normalizedState = hasVersionMismatch ? DEFAULT_PERSISTED_STATE : persisted;
    const canResumeInProgress =
      normalizedState.inProgress && !normalizedState.completed && !normalizedState.skipped;

    if (hasVersionMismatch) {
      writePersistedState(DEFAULT_PERSISTED_STATE);
    } else if (!canResumeInProgress && (normalizedState.completed || normalizedState.skipped)) {
      autoStartAttemptedRef.current = true;
      return;
    }

    if (!canResumeInProgress && pathname !== "/") {
      return;
    }

    autoStartAttemptedRef.current = true;
    const initialStep = canResumeInProgress ? normalizedState.currentStep : 0;
    const source = canResumeInProgress ? "auto_resume" : "auto_first_visit";
    let delayTimeoutId: number | null = null;
    let pollingIntervalId: number | null = null;

    const begin = () => {
      if (!hasAgeVerifiedCookie()) {
        return false;
      }

      delayTimeoutId = window.setTimeout(() => {
        startTutorialAt(initialStep, source);
      }, AUTO_START_DELAY_MS);
      return true;
    };

    if (!begin()) {
      pollingIntervalId = window.setInterval(() => {
        if (begin() && pollingIntervalId) {
          window.clearInterval(pollingIntervalId);
        }
      }, 800);
    }

    return () => {
      if (delayTimeoutId) {
        window.clearTimeout(delayTimeoutId);
      }
      if (pollingIntervalId) {
        window.clearInterval(pollingIntervalId);
      }
    };
  }, [authLoading, isActive, isEnabled, pathname, startTutorialAt, tutorialCmsLoaded]);

  useEffect(() => {
    if (authLoading || !pendingRestart || pathname !== "/") {
      return;
    }

    let timeoutId: number | null = null;
    let intervalId: number | null = null;

    const begin = () => {
      if (!hasAgeVerifiedCookie()) {
        return false;
      }

      timeoutId = window.setTimeout(() => {
        void (async () => {
          await loadTutorialCmsPages();
          startTutorialAt(0, "manual_restart");
          setPendingRestart(false);
        })();
      }, 220);
      return true;
    };

    if (!begin()) {
      intervalId = window.setInterval(() => {
        if (begin() && intervalId) {
          window.clearInterval(intervalId);
        }
      }, 500);
    }

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [authLoading, loadTutorialCmsPages, pathname, pendingRestart, startTutorialAt]);

  useEffect(() => {
    if (!isActive) {
      lastViewedStepRef.current = null;
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        skipTutorial("escape_key");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isActive, skipTutorial]);

  const contextValue = useMemo<TutorialContextValue>(
    () => ({
      isEnabled,
      isActive,
      restartTutorial,
    }),
    [isActive, isEnabled, restartTutorial],
  );

  const isRouteReady = !currentStep.route || pathname === currentStep.route;
  const safeStepIndex = clampIndex(currentStepIndex);
  return (
    <TutorialContext.Provider value={contextValue}>
      {children}
      <TutorialOverlay
        key={currentStep.id}
        active={isEnabled && isActive && isRouteReady}
        step={currentStep}
        stepIndex={safeStepIndex}
        totalSteps={tutorialSteps.length}
        onNext={nextStep}
        onPrev={prevStep}
        onSkip={() => skipTutorial("skip_button")}
      />
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error("useTutorial must be used inside TutorialProvider.");
  }

  return context;
}
