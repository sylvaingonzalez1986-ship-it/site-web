"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
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
const AUTO_START_DELAY_MS = 1500;
const CMS_PAGES_UPDATED_EVENT = "lcb:cms-pages-updated";
const AGE_VERIFIED_EVENT = "lcb:age-verified";

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

type TutorialPhase = "idle" | "loading" | "active" | "completed" | "skipped";

type TutorialState = {
  phase: TutorialPhase;
  stepIndex: number;
  source: string | null;
};

type TutorialAction =
  | { type: "START"; stepIndex: number; source: string }
  | { type: "NEXT"; stepIndex: number }
  | { type: "PREV"; stepIndex: number }
  | { type: "COMPLETE"; stepIndex: number }
  | { type: "SKIP"; stepIndex: number }
  | { type: "RESTART"; source: string }
  | { type: "RESTORE_COMPLETED"; stepIndex: number }
  | { type: "RESTORE_SKIPPED"; stepIndex: number };

const TutorialContext = createContext<TutorialContextValue | null>(null);

const DEFAULT_PERSISTED_STATE: PersistedTutorialState = {
  version: TUTORIAL_VERSION,
  completed: false,
  skipped: false,
  inProgress: false,
  currentStep: 0,
};

const INITIAL_TUTORIAL_STATE: TutorialState = {
  phase: "idle",
  stepIndex: 0,
  source: null,
};

function tutorialReducer(state: TutorialState, action: TutorialAction): TutorialState {
  switch (action.type) {
    case "START":
      return {
        phase: "active",
        stepIndex: action.stepIndex,
        source: action.source,
      };
    case "NEXT":
      return {
        ...state,
        phase: "active",
        stepIndex: action.stepIndex,
      };
    case "PREV":
      return {
        ...state,
        phase: "active",
        stepIndex: action.stepIndex,
      };
    case "COMPLETE":
      return {
        phase: "completed",
        stepIndex: action.stepIndex,
        source: null,
      };
    case "SKIP":
      return {
        phase: "skipped",
        stepIndex: action.stepIndex,
        source: null,
      };
    case "RESTART":
      return {
        phase: "loading",
        stepIndex: 0,
        source: action.source,
      };
    case "RESTORE_COMPLETED":
      return {
        phase: "completed",
        stepIndex: action.stepIndex,
        source: null,
      };
    case "RESTORE_SKIPPED":
      return {
        phase: "skipped",
        stepIndex: action.stepIndex,
        source: null,
      };
    default:
      return state;
  }
}

function resolveTutorialEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_TUTORIAL_ENABLED?.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "off") {
    return false;
  }

  return true;
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

function normalizePersistedState(): PersistedTutorialState {
  const current = readPersistedState();
  if (current.version === TUTORIAL_VERSION) {
    return current;
  }

  writePersistedState(DEFAULT_PERSISTED_STATE);
  return DEFAULT_PERSISTED_STATE;
}

export function TutorialProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, authLoading } = useCart();
  const [tutorialCmsPages, setTutorialCmsPages] = useState<CmsPage[]>([]);
  const [tutorialCmsLoaded, setTutorialCmsLoaded] = useState(false);
  const [ageVerified, setAgeVerified] = useState(false);
  const [state, dispatch] = useReducer(tutorialReducer, INITIAL_TUTORIAL_STATE);
  const isEnabled = useMemo(() => resolveTutorialEnabled(), []);
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

    const onAgeVerified = () => {
      setAgeVerified(true);
    };

    window.addEventListener(CMS_PAGES_UPDATED_EVENT, onCmsPagesUpdated);
    window.addEventListener(AGE_VERIFIED_EVENT, onAgeVerified);

    return () => {
      window.removeEventListener(CMS_PAGES_UPDATED_EVENT, onCmsPagesUpdated);
      window.removeEventListener(AGE_VERIFIED_EVENT, onAgeVerified);
    };
  }, [loadTutorialCmsPages]);

  useEffect(() => {
    setAgeVerified(pathname !== "/age-gate");
  }, [pathname]);

  const cmsOverriddenTutorialSteps = useMemo(
    () => applyTutorialCmsPageOverrides(HOME_TUTORIAL_STEPS, tutorialCmsPages),
    [tutorialCmsPages],
  );

  const tutorialSteps = useMemo(() => {
    const filtered = cmsOverriddenTutorialSteps.filter((step) => !step.requiresAuth || isAuthenticated);
    return filtered.length > 0 ? filtered : cmsOverriddenTutorialSteps;
  }, [cmsOverriddenTutorialSteps, isAuthenticated]);

  const clampIndex = useCallback(
    (index: number) => clampStepIndex(index, tutorialSteps.length),
    [tutorialSteps.length],
  );

  const getStepByIndex = useCallback(
    (index: number): TutorialStep | null => tutorialSteps[clampIndex(index)] ?? null,
    [clampIndex, tutorialSteps],
  );

  const persistState = useCallback(
    (patch: Partial<PersistedTutorialState>) => {
      const previous = normalizePersistedState();
      const next: PersistedTutorialState = {
        ...previous,
        ...patch,
        version: TUTORIAL_VERSION,
        currentStep: clampIndex(
          typeof patch.currentStep === "number" ? patch.currentStep : previous.currentStep,
        ),
      };
      writePersistedState(next);
    },
    [clampIndex],
  );

  const startTutorialAt = useCallback(
    (stepIndex: number, source: string) => {
      const nextIndex = clampIndex(stepIndex);
      const step = getStepByIndex(nextIndex);
      if (!step) {
        return;
      }

      dispatch({ type: "START", stepIndex: nextIndex, source });
      persistState({
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
    [clampIndex, getStepByIndex, pathname, persistState, tutorialSteps.length],
  );

  const completeTutorial = useCallback(
    (source = "finish_button") => {
      const finalIndex = clampIndex(state.stepIndex);
      const step = getStepByIndex(finalIndex);
      if (!step) {
        return;
      }

      dispatch({ type: "COMPLETE", stepIndex: finalIndex });
      persistState({
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
        source,
      });
    },
    [clampIndex, getStepByIndex, pathname, persistState, state.stepIndex, tutorialSteps.length],
  );

  const skipTutorial = useCallback(
    (source = "skip_button") => {
      const currentIndex = clampIndex(state.stepIndex);
      const step = getStepByIndex(currentIndex);
      if (!step) {
        return;
      }

      dispatch({ type: "SKIP", stepIndex: currentIndex });
      persistState({
        completed: false,
        skipped: true,
        inProgress: false,
        currentStep: currentIndex,
      });
      trackTutorialEvent("skip", {
        stepId: step.id,
        stepIndex: currentIndex,
        totalSteps: tutorialSteps.length,
        pathname,
        source,
      });
    },
    [clampIndex, getStepByIndex, pathname, persistState, state.stepIndex, tutorialSteps.length],
  );

  const nextStep = useCallback(() => {
    const currentIndex = clampIndex(state.stepIndex);
    const currentStep = getStepByIndex(currentIndex);
    if (!currentStep) {
      return;
    }

    const isLast = currentIndex >= tutorialSteps.length - 1;
    if (isLast) {
      completeTutorial();
      return;
    }

    const nextIndex = clampIndex(currentIndex + 1);
    const destination = getStepByIndex(nextIndex);
    if (!destination) {
      return;
    }

    dispatch({ type: "NEXT", stepIndex: nextIndex });
    persistState({
      completed: false,
      skipped: false,
      inProgress: true,
      currentStep: nextIndex,
    });
    trackTutorialEvent("step_next", {
      stepId: destination.id,
      stepIndex: nextIndex,
      totalSteps: tutorialSteps.length,
      pathname,
      source: currentStep.id,
    });
  }, [clampIndex, completeTutorial, getStepByIndex, pathname, persistState, state.stepIndex, tutorialSteps.length]);

  const prevStep = useCallback(() => {
    const currentIndex = clampIndex(state.stepIndex);
    const currentStep = getStepByIndex(currentIndex);
    if (!currentStep) {
      return;
    }

    const previousIndex = clampIndex(currentIndex - 1);
    const destination = getStepByIndex(previousIndex);
    if (!destination) {
      return;
    }

    dispatch({ type: "PREV", stepIndex: previousIndex });
    persistState({
      completed: false,
      skipped: false,
      inProgress: true,
      currentStep: previousIndex,
    });
    trackTutorialEvent("step_prev", {
      stepId: destination.id,
      stepIndex: previousIndex,
      totalSteps: tutorialSteps.length,
      pathname,
      source: currentStep.id,
    });
  }, [clampIndex, getStepByIndex, pathname, persistState, state.stepIndex, tutorialSteps.length]);

  const restartTutorial = useCallback(() => {
    writePersistedState(DEFAULT_PERSISTED_STATE);
    dispatch({ type: "RESTART", source: "manual_restart" });
    trackTutorialEvent("start", {
      stepId: "welcome",
      stepIndex: 0,
      totalSteps: tutorialSteps.length,
      pathname,
      source: "manual_restart_request",
    });

    if (pathname !== "/") {
      router.push("/");
    }
  }, [pathname, router, tutorialSteps.length]);

  const currentStep = getStepByIndex(state.stepIndex);
  const isActive = state.phase === "active";

  useEffect(() => {
    if (!isEnabled || authLoading || !tutorialCmsLoaded || tutorialSteps.length === 0) {
      return;
    }

    if (!ageVerified) {
      return;
    }

    if (state.phase === "loading") {
      if (pathname !== "/") {
        return;
      }

      startTutorialAt(0, state.source ?? "manual_restart");
      return;
    }

    if (state.phase !== "idle") {
      return;
    }

    const persisted = normalizePersistedState();
    if (persisted.completed) {
      dispatch({ type: "RESTORE_COMPLETED", stepIndex: clampIndex(persisted.currentStep) });
      return;
    }

    if (persisted.skipped) {
      dispatch({ type: "RESTORE_SKIPPED", stepIndex: clampIndex(persisted.currentStep) });
      return;
    }

    if (persisted.inProgress) {
      startTutorialAt(persisted.currentStep, "auto_resume");
      return;
    }

    if (pathname !== "/") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      startTutorialAt(0, "auto_first_visit");
    }, AUTO_START_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    ageVerified,
    authLoading,
    clampIndex,
    isEnabled,
    pathname,
    startTutorialAt,
    state.phase,
    state.source,
    tutorialCmsLoaded,
    tutorialSteps.length,
  ]);

  useEffect(() => {
    if (!isEnabled || !isActive || !currentStep?.route || pathname === currentStep.route) {
      return;
    }

    router.push(currentStep.route);
  }, [currentStep?.route, isActive, isEnabled, pathname, router]);

  useEffect(() => {
    if (!isEnabled || !isActive || !currentStep) {
      lastViewedStepRef.current = null;
      return;
    }

    const isRouteReady = !currentStep.route || pathname === currentStep.route;
    if (!isRouteReady) {
      return;
    }

    const viewKey = `${currentStep.id}:${state.stepIndex}:${pathname}`;
    if (lastViewedStepRef.current === viewKey) {
      return;
    }

    lastViewedStepRef.current = viewKey;
    trackTutorialEvent("step_view", {
      stepId: currentStep.id,
      stepIndex: state.stepIndex,
      totalSteps: tutorialSteps.length,
      pathname,
      source: "overlay_visible",
    });
  }, [currentStep, isActive, isEnabled, pathname, state.stepIndex, tutorialSteps.length]);

  useEffect(() => {
    if (!isActive) {
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

  const safeStepIndex = clampIndex(state.stepIndex);
  const isRouteReady = !currentStep?.route || pathname === currentStep.route;

  return (
    <TutorialContext.Provider value={contextValue}>
      {children}
      {currentStep ? (
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
      ) : null}
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
