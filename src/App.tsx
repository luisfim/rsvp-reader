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
  FONT_SIZE_STEP,
  MAX_FONT_SIZE,
  MAX_PDF_FILE_SIZE,
  MAX_WPM,
  MIN_FONT_SIZE,
  MIN_WPM,
  WPM_STEP,
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
import {
  getWordDelay,
  tokenizeText,
} from "./lib/reader";

import type {
  ReaderOptions,
  ReaderSnapshot,
  Screen,
} from "./types/reader";

import { useLocation, useNavigate } from "react-router";
import { useAuth } from "./auth/AuthContext";
import { AuthPage } from "./components/AuthPage";
import { InstallAppButton } from "./components/InstallAppButton";
import { ReaderPage } from "./components/reader/ReaderPage";
import { useOnlineStatus } from "./hooks/useOnlineStatus";

import "./App.css";

type LibrarySort = "recent" | "title" | "progress";
type LibraryMode = "local" | "cloud";
type CloudSyncState =
  | "idle"
  | "loading"
  | "offline"
  | "pending"
  | "syncing"
  | "synced"
  | "error";

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

  const [documentTitle, setDocumentTitle] = useState("");
  const [words, setWords] = useState<string[]>([]);

  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wordsPerMinute, setWordsPerMinute] = useState(DEFAULT_WPM);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [useNaturalPauses, setUseNaturalPauses] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [areReaderControlsVisible, setAreReaderControlsVisible] =
    useState(true);

  const [savedDocuments, setSavedDocuments] = useState<SavedDocument[]>(
    () => loadSavedDocuments(),
  );

  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(
    null,
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

  const readerSnapshotRef = useRef<ReaderSnapshot>({
    activeDocumentId: null,
    currentWordIndex: 0,
    wordsPerMinute: DEFAULT_WPM,
    fontSize: DEFAULT_FONT_SIZE,
    useNaturalPauses: false,
  });

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

  const cloudConnectionStatus = !isOnline
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

  useEffect(() => {
    readerSnapshotRef.current = {
      activeDocumentId,
      currentWordIndex,
      wordsPerMinute,
      fontSize,
      useNaturalPauses,
    };
  }, [
    activeDocumentId,
    currentWordIndex,
    fontSize,
    useNaturalPauses,
    wordsPerMinute,
  ]);

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

  const loadReaderState = useCallback(
    (
      title: string,
      text: string,
      options: ReaderOptions = {},
    ) => {
      const parsedWords = tokenizeText(text);

      if (parsedWords.length === 0) {
        setFormError("Paste some text before starting.");
        return;
      }

      const requestedIndex = options.startIndex ?? 0;
      const safeIndex = Math.min(
        Math.max(requestedIndex, 0),
        parsedWords.length - 1,
      );

      const savedWpm = options.savedWordsPerMinute ?? DEFAULT_WPM;

      setWords(parsedWords);
      setDocumentTitle(title.trim() || "Untitled text");
      setCurrentWordIndex(safeIndex);
      setWordsPerMinute(Math.min(Math.max(savedWpm, MIN_WPM), MAX_WPM));
      setFontSize(options.savedFontSize ?? DEFAULT_FONT_SIZE);
      setUseNaturalPauses(options.savedNaturalPauses ?? false);
      setActiveDocumentId(options.documentId ?? null);
      setIsPlaying(false);
      setFormError("");
      setScreen("reader");
      setLastSavedAt(options.documentId ? Date.now() : null);

      lastBackgroundLineTopRef.current = null;
      lastAutoSaveAtRef.current = 0;
    },
    [],
  );


  const openReader = useCallback(
    (
      title: string,
      text: string,
      options: ReaderOptions = {},
    ) => {
      loadReaderState(title, text, options);

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
      setDocumentTitle(nextTitle);
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
    const snapshot = readerSnapshotRef.current;

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
  }, [isOnline, synchronizeCurrentCloudLibrary, user]);

  const returnHome = useCallback(() => {
    saveActiveProgress();
    persistCurrentSnapshot();
    setIsPlaying(false);
    setIsFocusMode(false);

    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }

    setActiveDocumentId(null);
    setScreen("home");
    navigate("/");
  }, [navigate, persistCurrentSnapshot, saveActiveProgress]);

  const returnToLibrary = useCallback(() => {
    saveActiveProgress();
    persistCurrentSnapshot();
    setIsPlaying(false);
    setIsFocusMode(false);

    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }

    setActiveDocumentId(null);
    setScreen("home");
    navigate("/library");
  }, [navigate, persistCurrentSnapshot, saveActiveProgress]);

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
      if (words.length === 0) {
        return;
      }

      const safeIndex = Math.min(
        Math.max(Math.round(requestedIndex), 0),
        words.length - 1,
      );

      setIsPlaying(false);
      setCurrentWordIndex(safeIndex);
      setAreReaderControlsVisible(true);
    },
    [words.length],
  );

  const restartCurrentReading = useCallback(() => {
    if (words.length === 0) {
      return;
    }

    setCurrentWordIndex(0);
    setIsPlaying(true);
    setAreReaderControlsVisible(true);
  }, [words.length]);

  const togglePlayback = useCallback(() => {
    if (words.length === 0) {
      return;
    }

    if (isPlaying) {
      setIsPlaying(false);
      return;
    }

    if (currentWordIndex >= words.length - 1) {
      setCurrentWordIndex(0);
    }

    setIsPlaying(true);
  }, [currentWordIndex, isPlaying, words.length]);

  const previousWord = useCallback(() => {
    setIsPlaying(false);
    setCurrentWordIndex((currentIndex) =>
      Math.max(0, currentIndex - 1),
    );
  }, []);

  const nextWord = useCallback(() => {
    setIsPlaying(false);
    setCurrentWordIndex((currentIndex) =>
      Math.min(words.length - 1, currentIndex + 1),
    );
  }, [words.length]);

  const increaseSpeed = useCallback(() => {
    setWordsPerMinute((currentWpm) =>
      Math.min(MAX_WPM, currentWpm + WPM_STEP),
    );
  }, []);

  const decreaseSpeed = useCallback(() => {
    setWordsPerMinute((currentWpm) =>
      Math.max(MIN_WPM, currentWpm - WPM_STEP),
    );
  }, []);

  const increaseFontSize = useCallback(() => {
    setFontSize((currentSize) =>
      Math.min(MAX_FONT_SIZE, currentSize + FONT_SIZE_STEP),
    );
  }, []);

  const decreaseFontSize = useCallback(() => {
    setFontSize((currentSize) =>
      Math.max(MIN_FONT_SIZE, currentSize - FONT_SIZE_STEP),
    );
  }, []);

  useEffect(() => {
    if (
      screen !== "reader" ||
      !isPlaying ||
      words.length === 0
    ) {
      return;
    }

    if (currentWordIndex >= words.length - 1) {
      setIsPlaying(false);
      return;
    }

    const delayInMilliseconds = getWordDelay(
      words[currentWordIndex] ?? "",
      wordsPerMinute,
      useNaturalPauses,
    );

    const timer = window.setTimeout(() => {
      const nextIndex = currentWordIndex + 1;

      setCurrentWordIndex(
        Math.min(nextIndex, words.length - 1),
      );

      if (nextIndex >= words.length - 1) {
        setIsPlaying(false);
      }
    }, Math.max(20, delayInMilliseconds));

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    currentWordIndex,
    isPlaying,
    screen,
    useNaturalPauses,
    words,
    wordsPerMinute,
  ]);

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
        setIsPlaying(false);
        setIsFocusMode(false);

        if (document.fullscreenElement) {
          void document.exitFullscreen().catch(() => undefined);
        }

        setActiveDocumentId(null);
        setScreen("home");
      }

      return;
    }

    const routeDocumentId = decodeURIComponent(readerMatch[1]);

    if (routeDocumentId === "demo") {
      if (screen !== "reader" || activeDocumentId !== null) {
        loadReaderState("RSVP demonstration", DEMO_TEXT);
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
      loadReaderState(savedDocument.title, savedDocument.text, {
        documentId: savedDocument.id,
        startIndex: savedDocument.currentWordIndex,
        savedWordsPerMinute: savedDocument.wordsPerMinute,
        savedFontSize: savedDocument.fontSize,
        savedNaturalPauses: savedDocument.useNaturalPauses,
      });
    }
  }, [
    activeDocumentId,
    loadReaderState,
    location.pathname,
    navigate,
    persistCurrentSnapshot,
    savedDocuments,
    screen,
    isLibraryLoading,
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
      <div className="landing-shell library-page-shell">
        <header className="site-header">
          <button
            className="brand brand-button"
            type="button"
            onClick={() => navigate("/")}
            aria-label="RSVP Reader home"
          >
            <span className="brand-mark" />
            RSVP Reader
          </button>

          <div className="header-actions">
            <button
              className="library-nav-button active"
              type="button"
              onClick={() => navigate("/")}
            >
              Home
            </button>

            {user && cloudConnectionLabel && (
              <span
                className={`cloud-connection-badge ${cloudConnectionStatus}`}
                title={
                  isOnline
                    ? "Your cloud library will synchronize automatically."
                    : "Changes are saved on this device and will synchronize when the connection returns."
                }
              >
                <span className="cloud-connection-dot" />
                {cloudConnectionLabel}
              </span>
            )}

            <InstallAppButton />

            <button
              className="sign-in-button account-button"
              type="button"
              onClick={openAccount}
              title={user?.email || "Sign in or create an account"}
            >
              <span>{accountLabel}</span>
            </button>
          </div>
        </header>

        <main className="library-page-main">
          <section className="library-page-intro">
            <span className="eyebrow">
              {user ? "Synced to your account" : "Saved on this device"}
            </span>
            <h1>Your {user ? "cloud" : "local"} library</h1>
            <p>
              {user
                ? "Your documents and progress are available whenever you sign in on another device."
                : "Continue saved texts, search your collection and manage reading progress without signing in."}
            </p>
          </section>

          {user &&
            (!isOnline ||
              cloudSyncState === "pending" ||
              cloudSyncState === "error") && (
              <div className="offline-sync-banner" role="status">
                <div>
                  <span className="offline-sync-kicker">
                    {!isOnline ? "Offline mode" : "Synchronization pending"}
                  </span>
                  <strong>
                    {!isOnline
                      ? "Your cloud library is available on this device."
                      : "Your changes are safe and waiting to sync."}
                  </strong>
                  <p>
                    {!isOnline
                      ? "You can keep reading, create documents, rename them and update progress. Everything will synchronize automatically when the connection returns."
                      : "The application will retry automatically. You can continue reading while it waits for Supabase to become available."}
                  </p>
                </div>

                {isOnline && (
                  <button
                    type="button"
                    onClick={() => void synchronizeCurrentCloudLibrary()}
                    disabled={cloudSyncState === "syncing"}
                  >
                    {cloudSyncState === "syncing" ? "Syncing…" : "Retry sync"}
                  </button>
                )}
              </div>
            )}

          <section
            ref={librarySectionRef}
            id="local-library"
            className="library-section library-section-standalone"
            aria-labelledby="library-heading"
          >
            <div className="library-header">
              <div>
                <span className="eyebrow">{libraryStorageLabel}</span>
                <h2 id="library-heading">Saved texts</h2>
              </div>

              <span className="library-count">
                {savedDocuments.length}{" "}
                {savedDocuments.length === 1
                  ? "document"
                  : "documents"}
              </span>
            </div>

            {user && showMigrationPrompt && (
              <div className="migration-banner">
                <div>
                  <span className="migration-kicker">Local library found</span>
                  <strong>Import your saved local texts to this account?</strong>
                  <p>
                    This copies {localMigrationDocuments.length}{" "}
                    {localMigrationDocuments.length === 1
                      ? "document"
                      : "documents"} to your cloud library. Your local backup is kept on this device.
                  </p>
                </div>

                <div className="migration-actions">
                  <button
                    className="migration-primary-button"
                    type="button"
                    onClick={() => void importLocalLibraryToCloud()}
                    disabled={isMigratingLibrary}
                  >
                    {isMigratingLibrary ? "Importing…" : "Import local library"}
                  </button>
                  <button
                    type="button"
                    onClick={dismissMigrationPrompt}
                    disabled={isMigratingLibrary}
                  >
                    Not now
                  </button>
                </div>
              </div>
            )}

            {isLibraryLoading ? (
              <div className="library-loading-state">
                <span className="library-loading-spinner" aria-hidden="true" />
                <strong>Loading your cloud library…</strong>
              </div>
            ) : savedDocuments.length > 0 && (
              <div className="library-toolbar">
                <label className="library-search-field">
                  <span>Search</span>
                  <input
                    type="search"
                    value={libraryQuery}
                    onChange={(event) =>
                      setLibraryQuery(event.target.value)
                    }
                    placeholder="Search saved texts"
                  />
                </label>

                <label className="library-sort-field">
                  <span>Sort by</span>
                  <select
                    value={librarySort}
                    onChange={(event) =>
                      setLibrarySort(event.target.value as LibrarySort)
                    }
                  >
                    <option value="recent">Recently updated</option>
                    <option value="title">Title</option>
                    <option value="progress">Reading progress</option>
                  </select>
                </label>

                <span className="library-results-count">
                  {visibleDocuments.length} shown
                </span>
              </div>
            )}

            {libraryError && (
              <p className="library-error" role="alert">
                {libraryError}
              </p>
            )}

            {!isLibraryLoading && (
              savedDocuments.length === 0 ? (
              <div className="empty-library">
                <strong>Your {user ? "cloud" : "local"} library is empty.</strong>
                <span>
                  Return home to paste a text or upload a PDF.
                </span>
                <button type="button" onClick={() => navigate("/")}>
                  Add your first text
                </button>
              </div>
            ) : visibleDocuments.length === 0 ? (
              <div className="empty-library search-empty-state">
                <strong>No saved text matches your search.</strong>
                <span>Try a different title or clear the search field.</span>
                <button
                  type="button"
                  onClick={() => setLibraryQuery("")}
                >
                  Clear search
                </button>
              </div>
            ) : (
              <div className="document-grid">
                {visibleDocuments.map((savedDocument) => {
                  const exactDocumentProgress =
                    savedDocument.wordCount <= 1
                      ? 0
                      : (savedDocument.currentWordIndex /
                          (savedDocument.wordCount - 1)) *
                        100;

                  const progressLabel =
                    exactDocumentProgress > 0 &&
                    exactDocumentProgress < 1
                      ? "<1"
                      : Math.round(exactDocumentProgress).toString();

                  return (
                    <article
                      className="saved-document-card"
                      key={savedDocument.id}
                    >
                      <div className="saved-document-main">
                        <span className="saved-document-date">
                          Updated{" "}
                          {new Date(
                            savedDocument.updatedAt,
                          ).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>

                        {renamingDocumentId === savedDocument.id ? (
                          <div className="rename-document-form">
                            <input
                              autoFocus
                              type="text"
                              value={renameValue}
                              onChange={(event) =>
                                setRenameValue(event.target.value)
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  saveRenamedDocument(savedDocument);
                                }

                                if (event.key === "Escape") {
                                  cancelRenamingDocument();
                                }
                              }}
                              maxLength={120}
                              aria-label={`Rename ${savedDocument.title}`}
                            />

                            <div className="rename-document-actions">
                              <button
                                type="button"
                                onClick={() =>
                                  saveRenamedDocument(savedDocument)
                                }
                                disabled={!renameValue.trim()}
                              >
                                Save
                              </button>

                              <button
                                type="button"
                                onClick={cancelRenamingDocument}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <h3>{savedDocument.title}</h3>
                        )}

                        <p>
                          Word{" "}
                          {Math.min(
                            savedDocument.currentWordIndex + 1,
                            savedDocument.wordCount,
                          ).toLocaleString("en-US")}{" "}
                          of{" "}
                          {savedDocument.wordCount.toLocaleString(
                            "en-US",
                          )}{" "}
                          · {progressLabel}% complete
                        </p>
                      </div>

                      <div className="saved-document-progress">
                        <span
                          style={{
                            width: `${exactDocumentProgress}%`,
                          }}
                        />
                      </div>

                      <div className="saved-document-actions">
                        <button
                          className="continue-document-button"
                          type="button"
                          onClick={() =>
                            continueSavedDocument(savedDocument)
                          }
                        >
                          {savedDocument.currentWordIndex > 0
                            ? "Continue"
                            : "Start"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            restartSavedDocument(savedDocument)
                          }
                        >
                          Restart
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            startRenamingDocument(savedDocument)
                          }
                        >
                          Rename
                        </button>

                        <button
                          className="delete-document-button"
                          type="button"
                          onClick={() =>
                            deleteSavedDocument(savedDocument)
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ))}
          </section>
        </main>
      </div>
    );
  }

  if (screen === "home") {
    return (
      <div className="landing-shell">
        <header className="site-header">
          <button
            className="brand brand-button"
            type="button"
            onClick={() => navigate("/")}
            aria-label="RSVP Reader home"
          >
            <span className="brand-mark" />
            RSVP Reader
          </button>

          <div className="header-actions">
            <button
              className="library-nav-button"
              type="button"
              onClick={openLibrary}
              aria-controls="local-library"
            >
              Library
              <span className="library-nav-count">
                {savedDocuments.length}
              </span>
            </button>

            {user && cloudConnectionLabel && (
              <span
                className={`cloud-connection-badge ${cloudConnectionStatus}`}
                title={
                  isOnline
                    ? "Your cloud library will synchronize automatically."
                    : "Changes are saved on this device and will synchronize when the connection returns."
                }
              >
                <span className="cloud-connection-dot" />
                {cloudConnectionLabel}
              </span>
            )}

            <InstallAppButton />

            <button
              className="sign-in-button account-button"
              type="button"
              onClick={openAccount}
              title={user?.email || "Sign in or create an account"}
            >
              <span>{accountLabel}</span>
            </button>
          </div>
        </header>

        <main className="landing-main">
          <section className="hero-section">
            <div className="hero-copy">
              <span className="eyebrow">
                Read without losing focus
              </span>

              <h1>
                Your text.
                <br />
                One word at a time.
              </h1>

              <p className="hero-description">
                Transform books, articles and documents into a focused
                speed-reading experience using Rapid Serial Visual
                Presentation.
              </p>

              <div className="hero-features">
                <span>250–2,000 WPM</span>
                <span>Keyboard controls</span>
                <span>{user ? "Cloud-synced library" : "Local reading library"}</span>
              </div>

              <button
                className="demo-button"
                type="button"
                onClick={startDemo}
              >
                Try the demonstration
                <span aria-hidden="true">→</span>
              </button>

              {latestDocument && (
                <section
                  className="continue-reading-card"
                  aria-label="Continue your latest reading"
                >
                  <div className="continue-reading-heading">
                    <div>
                      <span className="continue-reading-label">
                        Continue reading
                      </span>

                      <h2>{latestDocument.title}</h2>
                    </div>

                    <span className="continue-reading-percentage">
                      {latestDocumentProgressLabel}%
                    </span>
                  </div>

                  <p>
                    Word{" "}
                    {Math.min(
                      latestDocument.currentWordIndex + 1,
                      latestDocument.wordCount,
                    ).toLocaleString("en-US")}{" "}
                    of{" "}
                    {latestDocument.wordCount.toLocaleString(
                      "en-US",
                    )}
                  </p>

                  <div
                    className="continue-reading-progress"
                    aria-hidden="true"
                  >
                    <span
                      style={{
                        width: `${latestDocumentProgress}%`,
                      }}
                    />
                  </div>

                  <div className="continue-reading-actions">
                    <button
                      className="continue-latest-button"
                      type="button"
                      onClick={() =>
                        continueSavedDocument(latestDocument)
                      }
                    >
                      Continue
                      <span aria-hidden="true">→</span>
                    </button>

                    <button
                      className="view-library-button"
                      type="button"
                      onClick={openLibrary}
                    >
                      View all saved texts
                    </button>
                  </div>
                </section>
              )}
            </div>

            <section className="text-entry-card">
              <div className="entry-card-header">
                <div>
                  <span className="entry-step">New reading</span>
                  <h2>Paste your text</h2>
                </div>

                <span className="word-count">
                  {pastedWordCount.toLocaleString("en-US")} words
                </span>
              </div>

              <label className="field-label" htmlFor="document-title">
                Title
              </label>

              <input
                id="document-title"
                className="title-input"
                type="text"
                value={draftTitle}
                onChange={(event) => {
                  setDraftTitle(event.target.value);
                  setFormError("");
                }}
                placeholder="Optional document title"
                maxLength={120}
              />

              <label className="field-label" htmlFor="document-text">
                Text
              </label>

              <textarea
                id="document-text"
                className="text-input"
                value={draftText}
                onChange={(event) => {
                  setDraftText(event.target.value);
                  setFormError("");
                }}
                placeholder="Paste a chapter, article or any other text here..."
                spellCheck
              />

              {formError && (
                <p className="form-error" role="alert">
                  {formError}
                </p>
              )}

              <button
                className="start-reading-button"
                type="button"
                onClick={startPastedText}
                disabled={pastedWordCount === 0}
              >
                Start reading
                <span aria-hidden="true">→</span>
              </button>

              <input
                ref={pdfInputRef}
                className="visually-hidden"
                type="file"
                accept=".pdf,application/pdf"
                onChange={handlePdfUpload}
                disabled={isExtractingPdf}
                aria-label="Upload a PDF document"
              />

              <button
                className="pdf-upload-button"
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                disabled={isExtractingPdf}
              >
                <div className="pdf-upload-icon">PDF</div>

                <div className="pdf-upload-copy">
                  <strong>
                    {isExtractingPdf
                      ? "Extracting text..."
                      : pdfFileName || "Upload a PDF"}
                  </strong>

                  <span>
                    {isExtractingPdf
                      ? `Reading document — ${pdfProgress}%`
                      : pdfFileName
                        ? `${pastedWordCount.toLocaleString(
                            "en-US",
                          )} words ready`
                        : "Choose a text-based PDF up to 20 MB."}
                  </span>

                  {isExtractingPdf && (
                    <div
                      className="pdf-mini-progress"
                      aria-hidden="true"
                    >
                      <span
                        style={{
                          width: `${pdfProgress}%`,
                        }}
                      />
                    </div>
                  )}
                </div>

                <span className="upload-action">
                  {isExtractingPdf
                    ? `${pdfProgress}%`
                    : pdfFileName
                      ? "Replace"
                      : "Choose file"}
                </span>
              </button>
            </section>
          </section>

        </main>
      </div>
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
      onToggleNaturalPauses={() =>
        setUseNaturalPauses((currentValue) => !currentValue)
      }
      onSeekToWord={seekToWord}
      onRestartReading={restartCurrentReading}
    />
  );
}

export default App;
