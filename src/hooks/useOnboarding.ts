import { useCallback, useState } from "react";

const ONBOARDING_STORAGE_KEY = "rsvp-reader-onboarding-v1";

function hasCompletedOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === "completed";
  } catch {
    return false;
  }
}

export function useOnboarding() {
  const [isHelpOpen, setIsHelpOpen] = useState(
    () => !hasCompletedOnboarding(),
  );

  const openHelp = useCallback(() => {
    setIsHelpOpen(true);
  }, []);

  const closeHelp = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, "completed");
    } catch {
      // The help panel should still close when storage is unavailable.
    }

    setIsHelpOpen(false);
  }, []);

  return {
    isHelpOpen,
    openHelp,
    closeHelp,
  };
}
