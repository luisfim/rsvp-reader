import {
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useLocation, useNavigate } from "react-router";

import { DEMO_TEXT } from "../config/reader";
import type { SavedDocument } from "../lib/library";
import type { ReaderOptions, Screen } from "../types/reader";

interface LoadReaderResult {
  success: boolean;
  error?: string;
}

interface UseAppNavigationOptions {
  screen: Screen;
  savedDocuments: SavedDocument[];
  isLibraryLoading: boolean;
  isAuthenticated: boolean;
  activeDocumentId: string | null;
  loadReaderState: (
    title: string,
    text: string,
    options?: ReaderOptions,
  ) => LoadReaderResult;
  pauseReader: () => void;
  clearActiveDocument: () => void;
  exitFocusMode: () => Promise<void>;
  markReaderOpened: (documentId?: string | null) => void;
  saveActiveProgress: () => void;
  persistCurrentSnapshot: () => void;
  resetReaderView: () => void;
}

export function getScreenFromPath(pathname: string): Screen {
  return pathname.startsWith("/reader/") ? "reader" : "home";
}

export function getReaderRouteDocumentId(
  pathname: string,
): string | null {
  const readerMatch = pathname.match(/^\/reader\/([^/]+)$/);

  if (!readerMatch) {
    return null;
  }

  try {
    return decodeURIComponent(readerMatch[1]);
  } catch {
    return readerMatch[1];
  }
}

export function useAppNavigation({
  screen,
  savedDocuments,
  isLibraryLoading,
  isAuthenticated,
  activeDocumentId,
  loadReaderState,
  pauseReader,
  clearActiveDocument,
  exitFocusMode,
  markReaderOpened,
  saveActiveProgress,
  persistCurrentSnapshot,
  resetReaderView,
}: UseAppNavigationOptions) {
  const location = useLocation();
  const navigate = useNavigate();
  const loadedRouteRef = useRef<string | null>(null);
  const wasReaderRouteRef = useRef(
    getScreenFromPath(location.pathname) === "reader",
  );

  const isAuthPage = location.pathname.startsWith("/auth");
  const isLibraryPage = location.pathname === "/library";

  const navigateHome = useCallback(() => {
    navigate("/");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [navigate]);

  const openLibrary = useCallback(() => {
    navigate("/library");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [navigate]);

  const openAccount = useCallback(() => {
    navigate("/auth");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [navigate]);

  const openReader = useCallback(
    (
      title: string,
      text: string,
      options: ReaderOptions = {},
    ) => {
      const result = loadReaderState(title, text, options);

      if (!result.success) {
        return {
          success: false as const,
          error: result.error ?? "The text could not be opened.",
        };
      }

      markReaderOpened(options.documentId);
      resetReaderView();

      const destination = options.documentId
        ? `/reader/${encodeURIComponent(options.documentId)}`
        : "/reader/demo";

      loadedRouteRef.current = destination;
      wasReaderRouteRef.current = true;
      navigate(destination);

      return { success: true as const };
    },
    [loadReaderState, markReaderOpened, navigate, resetReaderView],
  );

  const closeReader = useCallback(
    (destination: "/" | "/library") => {
      saveActiveProgress();
      persistCurrentSnapshot();
      pauseReader();
      void exitFocusMode();
      clearActiveDocument();

      loadedRouteRef.current = null;
      wasReaderRouteRef.current = false;
      navigate(destination);
    },
    [
      clearActiveDocument,
      exitFocusMode,
      navigate,
      pauseReader,
      persistCurrentSnapshot,
      saveActiveProgress,
    ],
  );

  const returnHome = useCallback(() => {
    closeReader("/");
  }, [closeReader]);

  const returnToLibrary = useCallback(() => {
    closeReader("/library");
  }, [closeReader]);

  useEffect(() => {
    const routeDocumentId = getReaderRouteDocumentId(
      location.pathname,
    );

    if (!routeDocumentId) {
      if (wasReaderRouteRef.current) {
        persistCurrentSnapshot();
        pauseReader();
        void exitFocusMode();
        clearActiveDocument();
      }

      wasReaderRouteRef.current = false;
      loadedRouteRef.current = null;
      return;
    }

    wasReaderRouteRef.current = true;

    if (loadedRouteRef.current === location.pathname) {
      return;
    }

    if (routeDocumentId === "demo") {
      const result = loadReaderState(
        "RSVP demonstration",
        DEMO_TEXT,
      );

      if (result.success) {
        markReaderOpened(null);
        resetReaderView();
        loadedRouteRef.current = location.pathname;
      }

      return;
    }

    if (isAuthenticated && isLibraryLoading) {
      return;
    }

    const savedDocument = savedDocuments.find(
      (document) => document.id === routeDocumentId,
    );

    if (!savedDocument) {
      loadedRouteRef.current = null;
      navigate("/library", { replace: true });
      return;
    }

    if (activeDocumentId === savedDocument.id) {
      loadedRouteRef.current = location.pathname;
      return;
    }

    const result = loadReaderState(
      savedDocument.title,
      savedDocument.text,
      {
        documentId: savedDocument.id,
        startIndex: savedDocument.currentWordIndex,
        savedWordsPerMinute: savedDocument.wordsPerMinute,
        savedFontSize: savedDocument.fontSize,
        savedNaturalPauses: savedDocument.useNaturalPauses,
      },
    );

    if (result.success) {
      markReaderOpened(savedDocument.id);
      resetReaderView();
      loadedRouteRef.current = location.pathname;
    }
  }, [
    activeDocumentId,
    clearActiveDocument,
    exitFocusMode,
    isAuthenticated,
    isLibraryLoading,
    loadReaderState,
    location.pathname,
    markReaderOpened,
    navigate,
    pauseReader,
    persistCurrentSnapshot,
    resetReaderView,
    savedDocuments,
  ]);

  useEffect(() => {
    const handlePageHide = () => {
      if (screen === "reader") {
        persistCurrentSnapshot();
      }
    };

    const handleVisibilityChange = () => {
      if (
        screen === "reader" &&
        document.visibilityState === "hidden"
      ) {
        persistCurrentSnapshot();
      }
    };

    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, [persistCurrentSnapshot, screen]);

  return {
    isAuthPage,
    isLibraryPage,
    navigateHome,
    openLibrary,
    openAccount,
    openReader,
    returnHome,
    returnToLibrary,
  };
}
