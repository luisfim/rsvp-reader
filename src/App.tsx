import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AUTO_SAVE_INTERVAL_MS,
  DEMO_TEXT,
} from "./config/reader";

import { type SavedDocument } from "./lib/library";

import type { ReaderOptions, Screen } from "./types/reader";

import { useLocation } from "react-router";
import { useAuth } from "./auth/AuthContext";
import { AuthPage } from "./components/AuthPage";
import { ReaderPage } from "./components/reader/ReaderPage";
import { HomePage } from "./pages/HomePage";
import { LibraryPage } from "./pages/LibraryPage";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import { useReaderFocusMode } from "./hooks/useReaderFocusMode";
import { useReaderKeyboardControls } from "./hooks/useReaderKeyboardControls";
import { useLibrarySync } from "./hooks/useLibrarySync";
import { useDocumentImport } from "./hooks/useDocumentImport";
import {
  getScreenFromPath,
  useAppNavigation,
} from "./hooks/useAppNavigation";
import { useRsvpPlayer } from "./hooks/useRsvpPlayer";
import type {
  CloudConnectionStatus,
  LibrarySort,
} from "./types/app";

import "./App.css";

function App() {
  const location = useLocation();
  const screen: Screen = getScreenFromPath(location.pathname);
  const { user, isLoading: isAuthLoading } = useAuth();
  const isOnline = useOnlineStatus();

  const {
    savedDocuments,
    setSavedDocuments,
    libraryError,
    lastSavedAt,
    libraryMode,
    isLibraryLoading,
    cloudSyncState,
    localMigrationDocuments,
    showMigrationPrompt,
    isMigratingLibrary,
    synchronizeCurrentCloudLibrary,
    importLocalLibraryToCloud,
    dismissMigrationPrompt,
    deleteDocument,
    saveReaderProgress,
    persistReaderSnapshot,
    markReaderOpened,
  } = useLibrarySync({
    userId: user?.id ?? null,
    isOnline,
  });
  const [libraryQuery, setLibraryQuery] = useState("");
  const [librarySort, setLibrarySort] = useState<LibrarySort>("recent");
  const [renamingDocumentId, setRenamingDocumentId] = useState<
    string | null
  >(null);
  const [renameValue, setRenameValue] = useState("");

  const librarySectionRef = useRef<HTMLElement | null>(null);
  const documentLayerRef = useRef<HTMLDivElement | null>(null);
  const activeBackgroundWordRef = useRef<HTMLSpanElement | null>(null);
  const lastBackgroundLineTopRef = useRef<number | null>(null);
  const lastAutoSaveAtRef = useRef(0);

  const resetReaderView = useCallback(() => {
    lastBackgroundLineTopRef.current = null;
    lastAutoSaveAtRef.current = 0;
  }, []);

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

  const {
    readerShellRef,
    isFocusMode,
    areReaderControlsVisible,
    revealReaderControls,
    toggleFocusMode,
    exitFocusMode,
  } = useReaderFocusMode({
    isActive: screen === "reader",
    isPlaying,
  });


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


  const {
    draftTitle,
    draftText,
    formError,
    pdfFileName,
    isExtractingPdf,
    pdfProgress,
    pastedWordCount,
    pdfInputRef,
    updateDraftTitle,
    updateDraftText,
    setImportError,
    createDocumentFromDraft,
    handlePdfUpload,
  } = useDocumentImport();

  const saveActiveProgress = useCallback(() => {
    saveReaderProgress({
      activeDocumentId,
      currentWordIndex,
      wordsPerMinute,
      fontSize,
      useNaturalPauses,
    });
  }, [
    activeDocumentId,
    currentWordIndex,
    fontSize,
    saveReaderProgress,
    useNaturalPauses,
    wordsPerMinute,
  ]);

  const persistCurrentSnapshot = useCallback(() => {
    persistReaderSnapshot(getSnapshot());
  }, [getSnapshot, persistReaderSnapshot]);

  const {
    isAuthPage,
    isLibraryPage,
    navigateHome,
    openLibrary,
    openAccount,
    openReader,
    returnHome,
    returnToLibrary,
  } = useAppNavigation({
    screen,
    savedDocuments,
    isLibraryLoading,
    isAuthenticated: Boolean(user),
    activeDocumentId,
    loadReaderState,
    pauseReader,
    clearActiveDocument,
    exitFocusMode,
    markReaderOpened,
    saveActiveProgress,
    persistCurrentSnapshot,
    resetReaderView,
  });

  const startPastedText = () => {
    const newDocument = createDocumentFromDraft();

    if (!newDocument) {
      return;
    }

    setSavedDocuments((currentDocuments) => [
      newDocument,
      ...currentDocuments,
    ]);

    const result = openReader(
      newDocument.title,
      newDocument.text,
      {
        documentId: newDocument.id,
        startIndex: 0,
        savedWordsPerMinute: newDocument.wordsPerMinute,
        savedFontSize: newDocument.fontSize,
        savedNaturalPauses: newDocument.useNaturalPauses,
      },
    );

    if (!result.success) {
      setImportError(result.error);
    }
  };

  const startDemo = () => {
    openReader("RSVP demonstration", DEMO_TEXT);
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

    await deleteDocument(savedDocument);
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

  const seekToWord = useCallback(
    (requestedIndex: number) => {
      seekPlayerToWord(requestedIndex);
      revealReaderControls();
    },
    [revealReaderControls, seekPlayerToWord],
  );

  const restartCurrentReading = useCallback(() => {
    restartPlayerReading();
    revealReaderControls();
  }, [restartPlayerReading, revealReaderControls]);

  useReaderKeyboardControls({
    enabled: screen === "reader",
    wordCount: words.length,
    isFocusMode,
    onRevealControls: revealReaderControls,
    onTogglePlayback: togglePlayback,
    onPreviousWord: previousWord,
    onNextWord: nextWord,
    onIncreaseSpeed: increaseSpeed,
    onDecreaseSpeed: decreaseSpeed,
    onToggleFocusMode: toggleFocusMode,
    onExitFocusMode: exitFocusMode,
    onSeekToWord: seekToWord,
    onExitReader: returnHome,
  });

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
        onNavigateHome={navigateHome}
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
        onNavigateHome={navigateHome}
        onOpenLibrary={openLibrary}
        onOpenAccount={openAccount}
        onStartDemo={startDemo}
        onContinueDocument={continueSavedDocument}
        onDraftTitleChange={updateDraftTitle}
        onDraftTextChange={updateDraftText}
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
