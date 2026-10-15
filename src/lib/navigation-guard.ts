let guard: ((continueNavigation: () => void) => void) | null = null;

export function registerNavigationGuard(next: (continueNavigation: () => void) => void) {
  guard = next;
  return () => { if (guard === next) guard = null; };
}

export function navigateWithDraftGuard(action: () => void) {
  if (guard) guard(action);
  else action();
}
