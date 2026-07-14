import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AUTO_SAVE_INTERVAL_MS,
  DEFAULT_FONT_SIZE,
  DEFAULT_WPM,
  DEMO_TEXT,
  MAX_PDF_FILE_SIZE,
} from "./config/reader";

import {
  createSavedDocument,
  loadSavedDocuments,
  persistSavedDocuments,
  type SavedDocument,
} from "./lib/library";

import {
  mergeDocumentLibraries,
  synchronizeCloudLibrary,
} from "./lib/cloudLibrary";
import {
  loadOfflineCloudState,
  queueOfflineCloudDeletion,
  saveOfflineCloudState,
  withOfflineDocuments,
  type OfflineCloudState,
} from "./lib/offlineCloudLibrary";
import { extractTextFromPdf } from "./lib/pdf";
import { tokenizeText } from "./lib/reader";

import type { ReaderOptions, Screen } from "./types/reader";

import { useLocation, useNavigate } from "react-router";
import { useAuth } from "./auth/AuthContext";
import { AuthPage } from "./components/AuthPage";
import { ReaderPage } from "./components/reader/ReaderPage";
import { HomePage } from "./pages/HomePage";
import { LibraryPage } from "./pages/LibraryPage";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import { useRsvpPlayer } from "./hooks/useRsvpPlayer";
import type {
  CloudConnectionStatus,
  CloudSyncState,
  LibraryMode,
  LibrarySort,
} from "./types/app";

import "./App.css";

function documentLibrariesMatch(
  firstLibrary: SavedDocument[],
  secondLibrary: SavedDocument[],
): boolean {
  if (firstLibrary.length !== secondLibrary.length) {
    return false;
  }

  const secondLibraryById = new Map(
    secondLibrary.map((document) => [document.id, document]),
  );

  return firstLibrary.every((document) => {
    const matchingDocument = secondLibraryById.get(document.id);

    return (
      matchingDocument?.updatedAt === document.updatedAt &&
      matchingDocument.title === document.title &&
      matchingDocument.currentWordIndex ===
        document.currentWordIndex &&
      matchingDocument.wordsPerMinute ===
        document.wordsPerMinute &&
      matchingDocument.fontSize === document.fontSize &&
      matchingDocument.useNaturalPauses ===
        document.useNaturalPauses
    );
  });
}

function createEmptyOfflineCloudState(): OfflineCloudState {
  return {
    documents: [],
    deletions: [],
    updatedAt: new Date(0).toISOString(),
  };
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoading: isAuthLoading } = useAuth();
  const isOnline = useOnlineStatus();

  const [screen, setScreen] = useState<Screen>(() =>
    location.pathname.startsWith("/reader/") ? "reader" : "home",
  );

  const [draftTitle, setDraftTitle] = useState("");
  const [draftText, setDraftText] = useState("");
  const [formError, setFormError] = useState("");

  const [pdfFileName, setPdfFileName] = useState("");
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);

  const [isFocusMode, setIsFocusMode] = useState(false);
  const [areReaderControlsVisible, setAreReaderControlsVisible] =
    useState(true);

  const [savedDocuments, setSavedDocuments] = useState<SavedDocument[]>(
    () => loadSavedDocuments(),
  );

  const [libraryError, setLibraryError] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [libraryMode, setLibraryMode] = useState<LibraryMode>("local");
  const [isLibraryLoading, setIsLibraryLoading] = useState(false);
  const [cloudSyncState, setCloudSyncState] =
    useState<CloudSyncState>("idle");
  const [localMigrationDocuments, setLocalMigrationDocuments] = useState<
    SavedDocument[]
  >([]);
  const [showMigrationPrompt, setShowMigrationPrompt] = useState(false);
  const [isMigratingLibrary, setIsMigratingLibrary] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [librarySort, setLibrarySort] = useState<LibrarySort>("recent");
  const [renamingDocumentId, setRenamingDocumentId] = useState<
    string | null
  >(null);
  const [renameValue, setRenameValue] = useState("");

  const librarySectionRef = useRef<HTMLElement | null>(null);
  const readerShellRef = useRef<HTMLDivElement | null>(null);
  const documentLayerRef = useRef<HTMLDivElement | null>(null);
  const activeBackgroundWordRef = useRef<HTMLSpanElement | null>(null);
  const lastBackgroundLineTopRef = useRef<number | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const lastAutoSaveAtRef = useRef(0);
  const cloudLibraryReadyRef = useRef(false);
  const cloudSyncTimerRef = useRef<number | null>(null);
  const cloudSyncInProgressRef = useRef(false);
  const cloudSyncRequestedRef = useRef(false);
  const offlineCloudStateRef = useRef<OfflineCloudState | null>(null);
  const controlsHideTimerRef = useRef<number | null>(null);
  const savedDocumentsRef = useRef<SavedDocument[]>(savedDocuments);

  const {
    documentTitle,
    words,
    currentWordIndex,
    isPlaying,
    wordsPerMinute,
    fontSize,
    useNaturalPauses,
    activeDocumentId,
    loadReaderState,
    pause: pauseReader,
    clearActiveDocument,
    renameActiveDocument,
    togglePlayback,
    previousWord,
    nextWord,
    seekToWord: seekPlayerToWord,
    restartReading: restartPlayerReading,
    increaseSpeed,
    decreaseSpeed,
    increaseFontSize,
    decreaseFontSize,
    toggleNaturalPauses,
    getSnapshot,
  } = useRsvpPlayer({ isActive: screen === "reader" });


  const pastedWordCount = useMemo(
    () => tokenizeText(draftText).length,
    [draftText],
  );

  const latestDocument = useMemo(() => {
    if (savedDocuments.length === 0) {
      return null;
    }

    return savedDocuments.reduce((latest, document) =>
      new Date(document.updatedAt).getTime() >
      new Date(latest.updatedAt).getTime()
        ? document
        : latest,
    );
  }, [savedDocuments]);

  const visibleDocuments = useMemo(() => {
    const normalizedQuery = libraryQuery.trim().toLocaleLowerCase();

    const filteredDocuments = normalizedQuery
      ? savedDocuments.filter((document) =>
          document.title.toLocaleLowerCase().includes(normalizedQuery),
        )
      : [...savedDocuments];

    return filteredDocuments.sort((firstDocument, secondDocument) => {
      if (librarySort === "title") {
        return firstDocument.title.localeCompare(secondDocument.title, "en", {
          sensitivity: "base",
        });
      }

      if (librarySort === "progress") {
        const firstProgress =
          firstDocument.wordCount <= 1
            ? 0
            : firstDocument.currentWordIndex /
              (firstDocument.wordCount - 1);

        const secondProgress =
          secondDocument.wordCount <= 1
            ? 0
            : secondDocument.currentWordIndex /
              (secondDocument.wordCount - 1);

        return secondProgress - firstProgress;
      }

      return (
        new Date(secondDocument.updatedAt).getTime() -
        new Date(firstDocument.updatedAt).getTime()
      );
    });
  }, [libraryQuery, librarySort, savedDocuments]);

  const latestDocumentProgress = latestDocument
    ? latestDocument.wordCount <= 1
      ? 0
      : (latestDocument.currentWordIndex /
          (latestDocument.wordCount - 1)) *
        100
    : 0;

  const latestDocumentProgressLabel =
    latestDocumentProgress > 0 && latestDocumentProgress < 1
      ? "<1"
      : Math.round(latestDocumentProgress).toString();

  const accountLabel = isAuthLoading
    ? "Loading…"
    : user?.email || "Sign in";

  const libraryStorageLabel =
    libraryMode === "cloud" ? "Cloud library" : "Local library";

  const cloudConnectionLabel = !user
    ? null
    : !isOnline
      ? "Offline"
      : cloudSyncState === "syncing"
        ? "Syncing"
        : cloudSyncState === "pending" ||
            cloudSyncState === "error"
          ? "Sync pending"
          : "Online";

  const cloudConnectionStatus: CloudConnectionStatus = !isOnline
    ? "offline"
    : cloudSyncState === "syncing"
      ? "syncing"
      : cloudSyncState === "pending" ||
          cloudSyncState === "error"
        ? "pending"
        : "online";

  const readerSaveLabel = activeDocumentId
    ? libraryMode === "cloud"
      ? !isOnline || cloudSyncState === "offline"
        ? "Saved offline"
        : cloudSyncState === "syncing"
          ? "Syncing…"
          : cloudSyncState === "pending" ||
              cloudSyncState === "error"
            ? "Sync pending"
            : "Saved to cloud"
      : lastSavedAt
        ? "Saved locally"
        : "Saving…"
    : "Demo not saved";


  const synchronizeCurrentCloudLibrary = useCallback(
    async (stateOverride?: OfflineCloudState) => {
      if (!user) {
        return;
      }

      if (!isOnline) {
        setCloudSyncState("offline");
        return;
      }

      if (cloudSyncInProgressRef.current) {
        cloudSyncRequestedRef.current = true;
        setCloudSyncState("pending");
        return;
      }

      cloudSyncInProgressRef.current = true;

      try {
        do {
          cloudSyncRequestedRef.current = false;
          setCloudSyncState("syncing");

          const cachedState =
            stateOverride ??
            offlineCloudStateRef.current ??
            (await loadOfflineCloudState(user.id));

          const stateToSynchronize = withOfflineDocuments(
            cachedState,
            savedDocumentsRef.current,
          );

          offlineCloudStateRef.current = stateToSynchronize;
          await saveOfflineCloudState(user.id, stateToSynchronize);

          const synchronizedState = await synchronizeCloudLibrary(
            user.id,
            stateToSynchronize,
          );

          const latestLocalState = offlineCloudStateRef.current;
          const localChangedDuringSync =
            latestLocalState &&
            Date.parse(latestLocalState.updatedAt) >
              Date.parse(stateToSynchronize.updatedAt);

          const nextState = localChangedDuringSync
            ? {
                documents: mergeDocumentLibraries(
                  synchronizedState.documents,
                  latestLocalState.documents,
                ),
                deletions: latestLocalState.deletions,
                updatedAt: latestLocalState.updatedAt,
              }
            : synchronizedState;

          offlineCloudStateRef.current = nextState;
          await saveOfflineCloudState(user.id, nextState);

          if (
            !documentLibrariesMatch(
              savedDocumentsRef.current,
              nextState.documents,
            )
          ) {
            savedDocumentsRef.current = nextState.documents;
            setSavedDocuments(nextState.documents);
          }

          if (localChangedDuringSync) {
            cloudSyncRequestedRef.current = true;
          }

          setCloudSyncState(
            cloudSyncRequestedRef.current ? "pending" : "synced",
          );
          setLibraryError("");
          setLastSavedAt(Date.now());
          stateOverride = undefined;
        } while (cloudSyncRequestedRef.current && isOnline);
      } catch (error) {
        setCloudSyncState(isOnline ? "pending" : "offline");
        setLibraryError(
          error instanceof Error
            ? `Cloud sync is pending: ${error.message}`
            : "Cloud sync is pending until a connection is available.",
        );
      } finally {
        cloudSyncInProgressRef.current = false;
      }
    },
    [isOnline, user],
  );

  useEffect(() => {
    let isCancelled = false;

    async function switchLibraryForCurrentUser() {
      cloudLibraryReadyRef.current = false;
      offlineCloudStateRef.current = null;

      if (!user) {
        setLibraryMode("local");
        setIsLibraryLoading(false);
        setCloudSyncState("idle");
        setLocalMigrationDocuments([]);
        setShowMigrationPrompt(false);
        const localDocuments = loadSavedDocuments();
        savedDocumentsRef.current = localDocuments;
        setSavedDocuments(localDocuments);
        return;
      }

      const localDocuments = loadSavedDocuments();

      setLibraryMode("cloud");
      setIsLibraryLoading(true);
      setCloudSyncState(isOnline ? "loading" : "offline");
      setLibraryError("");

      try {
        const cachedState = await loadOfflineCloudState(user.id);

        if (isCancelled) {
          return;
        }

        offlineCloudStateRef.current = cachedState;
        savedDocumentsRef.current = cachedState.documents;
        setSavedDocuments(cachedState.documents);
        cloudLibraryReadyRef.current = true;
        setIsLibraryLoading(false);

        const documentsAvailableForImport = localDocuments.filter(
          (localDocument) => {
            const cachedDocument = cachedState.documents.find(
              (document) => document.id === localDocument.id,
            );

            return (
              !cachedDocument ||
              Date.parse(localDocument.updatedAt) >
                Date.parse(cachedDocument.updatedAt)
            );
          },
        );

        setLocalMigrationDocuments(documentsAvailableForImport);
        setShowMigrationPrompt(documentsAvailableForImport.length > 0);

        if (!isOnline) {
          setCloudSyncState("offline");
          return;
        }

        await synchronizeCurrentCloudLibrary(cachedState);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        cloudLibraryReadyRef.current = true;
        setCloudSyncState(isOnline ? "pending" : "offline");
        setLibraryError(
          error instanceof Error
            ? `The cached cloud library is available, but synchronization is pending: ${error.message}`
            : "The cached cloud library is available, but synchronization is pending.",
        );
      } finally {
        if (!isCancelled) {
          setIsLibraryLoading(false);
        }
      }
    }

    void switchLibraryForCurrentUser();

    return () => {
      isCancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    savedDocumentsRef.current = savedDocuments;

    if (!user) {
      try {
        persistSavedDocuments(savedDocuments);
        setLibraryError("");
      } catch {
        setLibraryError(
          "The document could not be saved. Browser storage may be full.",
        );
      }

      return;
    }

    const currentOfflineState =
      offlineCloudStateRef.current ?? createEmptyOfflineCloudState();

    if (
      documentLibrariesMatch(
        currentOfflineState.documents,
        savedDocuments,
      )
    ) {
      return;
    }

    const nextOfflineState = withOfflineDocuments(
      currentOfflineState,
      savedDocuments,
    );

    offlineCloudStateRef.current = nextOfflineState;
    void saveOfflineCloudState(user.id, nextOfflineState);

    if (!cloudLibraryReadyRef.current) {
      return;
    }

    if (!isOnline) {
      setCloudSyncState("offline");
      return;
    }

    if (cloudSyncTimerRef.current !== null) {
      window.clearTimeout(cloudSyncTimerRef.current);
    }

    setCloudSyncState("pending");

    cloudSyncTimerRef.current = window.setTimeout(() => {
      void synchronizeCurrentCloudLibrary(nextOfflineState);
    }, 650);

    return () => {
      if (cloudSyncTimerRef.current !== null) {
        window.clearTimeout(cloudSyncTimerRef.current);
      }
    };
  }, [
    isOnline,
    savedDocuments,
    synchronizeCurrentCloudLibrary,
    user,
  ]);

  useEffect(() => {
    if (!user || !cloudLibraryReadyRef.current) {
      return;
    }

    if (!isOnline) {
      setCloudSyncState("offline");
      return;
    }

    void synchronizeCurrentCloudLibrary();
  }, [isOnline, synchronizeCurrentCloudLibrary, user]);

  const openReader = useCallback(
    (
      title: string,
      text: string,
      options: ReaderOptions = {},
    ) => {
      const result = loadReaderState(title, text, options);

      if (!result.success) {
        setFormError(result.error ?? "The text could not be opened.");
        return;
      }

      setFormError("");
      setScreen("reader");
      setLastSavedAt(options.documentId ? Date.now() : null);
      lastBackgroundLineTopRef.current = null;
      lastAutoSaveAtRef.current = 0;

      const destination = options.documentId
        ? `/reader/${encodeURIComponent(options.documentId)}`
        : "/reader/demo";

      navigate(destination);
    },
    [loadReaderState, navigate],
  );
  const startPastedText = () => {
    const parsedWords = tokenizeText(draftText);

    if (parsedWords.length === 0) {
      setFormError("Paste some text before starting.");
      return;
    }

    const title = draftTitle.trim() || "Untitled text";

    const newDocument = createSavedDocument({
      title,
      text: draftText,
      wordCount: parsedWords.length,
      wordsPerMinute: DEFAULT_WPM,
      fontSize: DEFAULT_FONT_SIZE,
      useNaturalPauses: false,
    });

    setSavedDocuments((currentDocuments) => [
      newDocument,
      ...currentDocuments,
    ]);

    openReader(title, draftText, {
      documentId: newDocument.id,
      startIndex: 0,
      savedWordsPerMinute: newDocument.wordsPerMinute,
      savedFontSize: newDocument.fontSize,
      savedNaturalPauses: newDocument.useNaturalPauses,
    });
  };

  const startDemo = () => {
    openReader("RSVP demonstration", DEMO_TEXT);
  };

  const openLibrary = useCallback(() => {
    navigate("/library");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [navigate]);

  const openAccount = useCallback(() => {
    navigate("/auth");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [navigate]);

  const importLocalLibraryToCloud = async () => {
    if (!user || localMigrationDocuments.length === 0) {
      return;
    }

    setIsMigratingLibrary(true);
    setLibraryError("");

    try {
      const mergedDocuments = mergeDocumentLibraries(
        savedDocuments,
        localMigrationDocuments,
      );
      const currentOfflineState =
        offlineCloudStateRef.current ?? createEmptyOfflineCloudState();
      const nextOfflineState = withOfflineDocuments(
        currentOfflineState,
        mergedDocuments,
      );

      offlineCloudStateRef.current = nextOfflineState;
      savedDocumentsRef.current = mergedDocuments;
      await saveOfflineCloudState(user.id, nextOfflineState);
      setSavedDocuments(mergedDocuments);
      setShowMigrationPrompt(false);
      setCloudSyncState(isOnline ? "pending" : "offline");
      setLastSavedAt(Date.now());

      if (isOnline) {
        await synchronizeCurrentCloudLibrary(nextOfflineState);
      }
    } catch (error) {
      setCloudSyncState(isOnline ? "pending" : "offline");
      setLibraryError(
        error instanceof Error
          ? `Local documents were cached, but cloud import is pending: ${error.message}`
          : "Local documents were cached, but cloud import is pending.",
      );
    } finally {
      setIsMigratingLibrary(false);
    }
  };

  const dismissMigrationPrompt = () => {
    setShowMigrationPrompt(false);
  };

  const handlePdfUpload = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setFormError("Choose a valid PDF file.");
      setPdfFileName("");
      return;
    }

    if (file.size > MAX_PDF_FILE_SIZE) {
      setFormError("Choose a PDF smaller than 20 MB.");
      setPdfFileName("");
      return;
    }

    setIsExtractingPdf(true);
    setPdfProgress(0);
    setPdfFileName(file.name);
    setFormError("");

    try {
      const extractedText = await extractTextFromPdf(
        file,
        (currentPage, totalPages) => {
          setPdfProgress(
            Math.round((currentPage / totalPages) * 100),
          );
        },
      );

      const extractedWords = tokenizeText(extractedText);

      if (extractedWords.length === 0) {
        throw new Error(
          "No selectable text was found. This may be a scanned PDF.",
        );
      }

      setDraftText(extractedText);

      setDraftTitle((currentTitle) => {
        if (currentTitle.trim()) {
          return currentTitle;
        }

        return file.name.replace(/\.pdf$/i, "");
      });

      setPdfProgress(100);
      setFormError("");
    } catch (error) {
      setPdfFileName("");
      setPdfProgress(0);
      setFormError(
        error instanceof Error
          ? error.message
          : "The PDF could not be processed.",
      );
    } finally {
      setIsExtractingPdf(false);
    }
  };

  const continueSavedDocument = (savedDocument: SavedDocument) => {
    openReader(savedDocument.title, savedDocument.text, {
      documentId: savedDocument.id,
      startIndex: savedDocument.currentWordIndex,
      savedWordsPerMinute: savedDocument.wordsPerMinute,
      savedFontSize: savedDocument.fontSize,
      savedNaturalPauses: savedDocument.useNaturalPauses,
    });
  };

  const restartSavedDocument = (savedDocument: SavedDocument) => {
    const updatedAt = new Date().toISOString();

    setSavedDocuments((currentDocuments) =>
      currentDocuments.map((document) =>
        document.id === savedDocument.id
          ? {
              ...document,
              currentWordIndex: 0,
              updatedAt,
            }
          : document,
      ),
    );

    openReader(savedDocument.title, savedDocument.text, {
      documentId: savedDocument.id,
      startIndex: 0,
      savedWordsPerMinute: savedDocument.wordsPerMinute,
      savedFontSize: savedDocument.fontSize,
      savedNaturalPauses: savedDocument.useNaturalPauses,
    });
  };

  const deleteSavedDocument = async (savedDocument: SavedDocument) => {
    const shouldDelete = window.confirm(
      `Delete "${savedDocument.title}" from your library?`,
    );

    if (!shouldDelete) {
      return;
    }

    const nextDocuments = savedDocumentsRef.current.filter(
      (document) => document.id !== savedDocument.id,
    );

    savedDocumentsRef.current = nextDocuments;
    setSavedDocuments(nextDocuments);

    if (!user) {
      return;
    }

    const currentOfflineState =
      offlineCloudStateRef.current ?? createEmptyOfflineCloudState();
    const nextOfflineState = queueOfflineCloudDeletion(
      {
        ...currentOfflineState,
        documents: nextDocuments,
      },
      savedDocument,
    );

    offlineCloudStateRef.current = nextOfflineState;
    await saveOfflineCloudState(user.id, nextOfflineState);
    setCloudSyncState(isOnline ? "pending" : "offline");

    if (isOnline) {
      void synchronizeCurrentCloudLibrary(nextOfflineState);
    }
  };

  const startRenamingDocument = (savedDocument: SavedDocument) => {
    setRenamingDocumentId(savedDocument.id);
    setRenameValue(savedDocument.title);
  };

  const cancelRenamingDocument = () => {
    setRenamingDocumentId(null);
    setRenameValue("");
  };

  const saveRenamedDocument = (savedDocument: SavedDocument) => {
    const nextTitle = renameValue.trim();

    if (!nextTitle) {
      return;
    }

    const updatedAt = new Date().toISOString();

    setSavedDocuments((currentDocuments) =>
      currentDocuments.map((document) =>
        document.id === savedDocument.id
          ? {
              ...document,
              title: nextTitle,
              updatedAt,
            }
          : document,
      ),
    );

    if (activeDocumentId === savedDocument.id) {
      renameActiveDocument(nextTitle);
    }

    setRenamingDocumentId(null);
    setRenameValue("");
  };

  const saveActiveProgress = useCallback(() => {
    if (!activeDocumentId) {
      return;
    }

    const updatedAt = new Date().toISOString();

    setSavedDocuments((currentDocuments) =>
      currentDocuments.map((document) =>
        document.id === activeDocumentId
          ? {
              ...document,
              currentWordIndex,
              wordsPerMinute,
              fontSize,
              useNaturalPauses,
              updatedAt,
            }
          : document,
      ),
    );

    setLastSavedAt(Date.now());
  }, [
    activeDocumentId,
    currentWordIndex,
    fontSize,
    useNaturalPauses,
    wordsPerMinute,
  ]);

  const persistCurrentSnapshot = useCallback(() => {
    const snapshot = getSnapshot();

    if (!snapshot.activeDocumentId) {
      return;
    }

    const updatedAt = new Date().toISOString();

    const updatedDocuments = savedDocumentsRef.current.map((document) =>
      document.id === snapshot.activeDocumentId
        ? {
            ...document,
            currentWordIndex: snapshot.currentWordIndex,
            wordsPerMinute: snapshot.wordsPerMinute,
            fontSize: snapshot.fontSize,
            useNaturalPauses: snapshot.useNaturalPauses,
            updatedAt,
          }
        : document,
    );

    if (user) {
      savedDocumentsRef.current = updatedDocuments;

      const currentOfflineState =
        offlineCloudStateRef.current ?? createEmptyOfflineCloudState();
      const nextOfflineState = withOfflineDocuments(
        currentOfflineState,
        updatedDocuments,
      );

      offlineCloudStateRef.current = nextOfflineState;
      void saveOfflineCloudState(user.id, nextOfflineState);

      if (isOnline) {
        void synchronizeCurrentCloudLibrary(nextOfflineState);
      }

      return;
    }

    try {
      persistSavedDocuments(updatedDocuments);
      savedDocumentsRef.current = updatedDocuments;
    } catch {
      // A pagehide event has no reliable place to display an error.
    }
  }, [getSnapshot, isOnline, synchronizeCurrentCloudLibrary, user]);

  const returnHome = useCallback(() => {
    saveActiveProgress();
    persistCurrentSnapshot();
    pauseReader();
    setIsFocusMode(false);

    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }

    clearActiveDocument();
    setScreen("home");
    navigate("/");
  }, [
    clearActiveDocument,
    navigate,
    pauseReader,
    persistCurrentSnapshot,
    saveActiveProgress,
  ]);

  const returnToLibrary = useCallback(() => {
    saveActiveProgress();
    persistCurrentSnapshot();
    pauseReader();
    setIsFocusMode(false);

    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }

    clearActiveDocument();
    setScreen("home");
    navigate("/library");
  }, [
    clearActiveDocument,
    navigate,
    pauseReader,
    persistCurrentSnapshot,
    saveActiveProgress,
  ]);

  const exitFocusMode = useCallback(async () => {
    setIsFocusMode(false);
    setAreReaderControlsVisible(true);

    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // The browser may already be leaving fullscreen.
      }
    }
  }, []);

  const toggleFocusMode = useCallback(async () => {
    if (isFocusMode) {
      await exitFocusMode();
      return;
    }

    setIsFocusMode(true);
    setAreReaderControlsVisible(true);

    if (!document.fullscreenElement && readerShellRef.current) {
      try {
        await readerShellRef.current.requestFullscreen();
      } catch {
        // Focus mode still works when fullscreen is unavailable or blocked.
      }
    }
  }, [exitFocusMode, isFocusMode]);

  const revealReaderControls = useCallback(() => {
    if (controlsHideTimerRef.current !== null) {
      window.clearTimeout(controlsHideTimerRef.current);
      controlsHideTimerRef.current = null;
    }

    setAreReaderControlsVisible(true);

    if (isFocusMode && isPlaying) {
      controlsHideTimerRef.current = window.setTimeout(() => {
        setAreReaderControlsVisible(false);
        controlsHideTimerRef.current = null;
      }, 2200);
    }
  }, [isFocusMode, isPlaying]);

  const seekToWord = useCallback(
    (requestedIndex: number) => {
      seekPlayerToWord(requestedIndex);
      setAreReaderControlsVisible(true);
    },
    [seekPlayerToWord],
  );

  const restartCurrentReading = useCallback(() => {
    restartPlayerReading();
    setAreReaderControlsVisible(true);
  }, [restartPlayerReading]);

  useEffect(() => {
    if (screen !== "reader" || !activeDocumentId) {
      return;
    }

    const now = Date.now();

    const shouldSave =
      !isPlaying ||
      currentWordIndex >= words.length - 1 ||
      now - lastAutoSaveAtRef.current >= AUTO_SAVE_INTERVAL_MS;

    if (!shouldSave) {
      return;
    }

    lastAutoSaveAtRef.current = now;
    saveActiveProgress();
  }, [
    activeDocumentId,
    currentWordIndex,
    isPlaying,
    saveActiveProgress,
    screen,
    words.length,
  ]);

  useEffect(() => {
    const handlePageHide = () => {
      persistCurrentSnapshot();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
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
  }, [persistCurrentSnapshot]);

  useEffect(() => {
    if (screen !== "reader") {
      return;
    }

    const documentLayer = documentLayerRef.current;
    const activeWord = activeBackgroundWordRef.current;

    if (!documentLayer || !activeWord) {
      return;
    }

    const layerRect = documentLayer.getBoundingClientRect();
    const wordRect = activeWord.getBoundingClientRect();

    const lineTop = Math.max(
      0,
      Math.round(
        documentLayer.scrollTop +
          wordRect.top -
          layerRect.top -
          28,
      ),
    );

    const previousLineTop = lastBackgroundLineTopRef.current;

    if (
      previousLineTop !== null &&
      Math.abs(previousLineTop - lineTop) < 2
    ) {
      return;
    }

    lastBackgroundLineTopRef.current = lineTop;

    documentLayer.scrollTo({
      top: lineTop,
      behavior: isPlaying ? "auto" : "smooth",
    });
  }, [currentWordIndex, isPlaying, screen]);

  useEffect(() => {
    revealReaderControls();

    return () => {
      if (controlsHideTimerRef.current !== null) {
        window.clearTimeout(controlsHideTimerRef.current);
        controlsHideTimerRef.current = null;
      }
    };
  }, [revealReaderControls]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFocusMode(false);
        setAreReaderControlsVisible(true);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener(
        "fullscreenchange",
        handleFullscreenChange,
      );
    };
  }, []);

  useEffect(() => {
    const readerMatch = location.pathname.match(/^\/reader\/([^/]+)$/);

    if (!readerMatch) {
      if (screen === "reader") {
        persistCurrentSnapshot();
        pauseReader();
        setIsFocusMode(false);

        if (document.fullscreenElement) {
          void document.exitFullscreen().catch(() => undefined);
        }

        clearActiveDocument();
        setScreen("home");
      }

      return;
    }

    const routeDocumentId = decodeURIComponent(readerMatch[1]);

    if (routeDocumentId === "demo") {
      if (screen !== "reader" || activeDocumentId !== null) {
        const result = loadReaderState("RSVP demonstration", DEMO_TEXT);

        if (result.success) {
          setScreen("reader");
          setLastSavedAt(null);
          lastBackgroundLineTopRef.current = null;
          lastAutoSaveAtRef.current = 0;
        }
      }

      return;
    }

    if (user && isLibraryLoading) {
      return;
    }

    const savedDocument = savedDocuments.find(
      (document) => document.id === routeDocumentId,
    );

    if (!savedDocument) {
      navigate("/library", { replace: true });
      return;
    }

    if (
      screen !== "reader" ||
      activeDocumentId !== savedDocument.id
    ) {
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
        setScreen("reader");
        setLastSavedAt(Date.now());
        lastBackgroundLineTopRef.current = null;
        lastAutoSaveAtRef.current = 0;
      }
    }
  }, [
    activeDocumentId,
    clearActiveDocument,
    isLibraryLoading,
    loadReaderState,
    location.pathname,
    navigate,
    pauseReader,
    persistCurrentSnapshot,
    savedDocuments,
    screen,
    user,
  ]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (screen !== "reader") {
        return;
      }

      const target = event.target as HTMLElement;

      const userIsTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      if (userIsTyping) {
        return;
      }

      const isNativeButtonActivation =
        target instanceof HTMLButtonElement &&
        (event.code === "Space" || event.code === "Enter");

      if (isNativeButtonActivation) {
        return;
      }

      const controlledKeys = [
        "Space",
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "KeyA",
        "KeyD",
        "KeyW",
        "KeyS",
        "KeyF",
        "Home",
        "End",
        "Escape",
      ];

      if (controlledKeys.includes(event.code)) {
        event.preventDefault();
      }

      revealReaderControls();

      switch (event.code) {
        case "Space":
          if (!event.repeat) {
            togglePlayback();
          }
          break;

        case "ArrowLeft":
        case "KeyA":
          previousWord();
          break;

        case "ArrowRight":
        case "KeyD":
          nextWord();
          break;

        case "ArrowUp":
        case "KeyW":
          increaseSpeed();
          break;

        case "ArrowDown":
        case "KeyS":
          decreaseSpeed();
          break;

        case "KeyF":
          if (!event.repeat) {
            void toggleFocusMode();
          }
          break;

        case "Home":
          seekToWord(0);
          break;

        case "End":
          seekToWord(words.length - 1);
          break;

        case "Escape":
          if (isFocusMode || document.fullscreenElement) {
            void exitFocusMode();
          } else {
            returnHome();
          }
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    decreaseSpeed,
    increaseSpeed,
    exitFocusMode,
    isFocusMode,
    nextWord,
    previousWord,
    returnHome,
    revealReaderControls,
    screen,
    seekToWord,
    toggleFocusMode,
    togglePlayback,
    words.length,
  ]);

  const isAuthPage = location.pathname.startsWith("/auth");
  const isLibraryPage = location.pathname === "/library";

  if (screen === "home" && isAuthPage) {
    return <AuthPage />;
  }

  if (screen === "home" && isLibraryPage) {
    return (
      <LibraryPage
        userEmail={user?.email}
        accountLabel={accountLabel}
        cloudConnectionLabel={cloudConnectionLabel}
        cloudConnectionStatus={cloudConnectionStatus}
        isOnline={isOnline}
        cloudSyncState={cloudSyncState}
        libraryStorageLabel={libraryStorageLabel}
        savedDocuments={savedDocuments}
        visibleDocuments={visibleDocuments}
        librarySectionRef={librarySectionRef}
        showMigrationPrompt={showMigrationPrompt}
        localMigrationDocumentCount={localMigrationDocuments.length}
        isMigratingLibrary={isMigratingLibrary}
        isLibraryLoading={isLibraryLoading}
        libraryQuery={libraryQuery}
        librarySort={librarySort}
        libraryError={libraryError}
        renamingDocumentId={renamingDocumentId}
        renameValue={renameValue}
        onNavigateHome={() => navigate("/")}
        onOpenLibrary={openLibrary}
        onOpenAccount={openAccount}
        onRetrySync={() => void synchronizeCurrentCloudLibrary()}
        onImportLocalLibrary={() => void importLocalLibraryToCloud()}
        onDismissMigration={dismissMigrationPrompt}
        onLibraryQueryChange={setLibraryQuery}
        onLibrarySortChange={setLibrarySort}
        onContinueDocument={continueSavedDocument}
        onRestartDocument={restartSavedDocument}
        onStartRename={startRenamingDocument}
        onRenameValueChange={setRenameValue}
        onSaveRename={saveRenamedDocument}
        onCancelRename={cancelRenamingDocument}
        onDeleteDocument={deleteSavedDocument}
      />
    );
  }

  if (screen === "home") {
    return (
      <HomePage
        userEmail={user?.email}
        accountLabel={accountLabel}
        cloudConnectionLabel={cloudConnectionLabel}
        cloudConnectionStatus={cloudConnectionStatus}
        isOnline={isOnline}
        savedDocumentCount={savedDocuments.length}
        latestDocument={latestDocument}
        latestDocumentProgress={latestDocumentProgress}
        latestDocumentProgressLabel={latestDocumentProgressLabel}
        pastedWordCount={pastedWordCount}
        draftTitle={draftTitle}
        draftText={draftText}
        formError={formError}
        pdfFileName={pdfFileName}
        isExtractingPdf={isExtractingPdf}
        pdfProgress={pdfProgress}
        pdfInputRef={pdfInputRef}
        onNavigateHome={() => navigate("/")}
        onOpenLibrary={openLibrary}
        onOpenAccount={openAccount}
        onStartDemo={startDemo}
        onContinueDocument={continueSavedDocument}
        onDraftTitleChange={(value) => {
          setDraftTitle(value);
          setFormError("");
        }}
        onDraftTextChange={(value) => {
          setDraftText(value);
          setFormError("");
        }}
        onStartReading={startPastedText}
        onPdfUpload={handlePdfUpload}
      />
    );
  }

  return (
    <ReaderPage
      readerShellRef={readerShellRef}
      documentLayerRef={documentLayerRef}
      activeBackgroundWordRef={activeBackgroundWordRef}
      words={words}
      currentWordIndex={currentWordIndex}
      documentTitle={documentTitle}
      fontSize={fontSize}
      isPlaying={isPlaying}
      wordsPerMinute={wordsPerMinute}
      useNaturalPauses={useNaturalPauses}
      readerSaveLabel={readerSaveLabel}
      isFocusMode={isFocusMode}
      areReaderControlsVisible={areReaderControlsVisible}
      onRevealControls={revealReaderControls}
      onReturnHome={returnHome}
      onReturnToLibrary={returnToLibrary}
      onToggleFocusMode={toggleFocusMode}
      onPreviousWord={previousWord}
      onTogglePlayback={togglePlayback}
      onNextWord={nextWord}
      onDecreaseSpeed={decreaseSpeed}
      onIncreaseSpeed={increaseSpeed}
      onDecreaseFontSize={decreaseFontSize}
      onIncreaseFontSize={increaseFontSize}
      onToggleNaturalPauses={toggleNaturalPauses}
      onSeekToWord={seekToWord}
      onRestartReading={restartCurrentReading}
    />
  );
}

export default App;
