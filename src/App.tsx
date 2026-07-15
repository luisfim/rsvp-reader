import {
  useCallback,
  useEffect,
  useRef,
} from "react";

import {
  AUTO_SAVE_INTERVAL_MS,
  DEMO_TEXT,
} from "./config/reader";

import { type SavedDocument } from "./lib/library";

import type { Screen } from "./types/reader";

import { useLocation } from "react-router";
import { useAuth } from "./auth/AuthContext";
import { AuthPage } from "./components/AuthPage";
import { HelpDialog } from "./components/HelpDialog";
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
import { useLibraryView } from "./hooks/useLibraryView";
import { useOnboarding } from "./hooks/useOnboarding";
import type { CloudConnectionStatus } from "./types/app";

import "./App.css";

function App() {
  const location = useLocation();
  const screen: Screen = getScreenFromPath(location.pathname);
  const { user, isLoading: isAuthLoading } = useAuth();
  const isOnline = useOnlineStatus();
  const { isHelpOpen, openHelp, closeHelp } = useOnboarding();

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

  const {
    libraryQuery,
    setLibraryQuery,
    librarySort,
    setLibrarySort,
    librarySection,
    setLibrarySection,
    librarySectionRef,
    latestDocument,
    visibleDocuments,
    activeDocumentCount,
    archivedDocumentCount,
    trashedDocumentCount,
    currentSectionDocumentCount,
    latestDocumentProgress,
    latestDocumentProgressLabel,
    editingDocumentId,
    editTitle,
    setEditTitle,
    editText,
    setEditText,
    editError,
    startEditingDocument,
    cancelEditingDocument,
    saveEditedDocument,
    archiveDocument,
    unarchiveDocument,
    moveDocumentToTrash,
    restoreTrashedDocument,
  } = useLibraryView({
    savedDocuments,
    setSavedDocuments,
    activeDocumentId,
    renameActiveDocument,
  });


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
    pdfImportDetails,
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

  const moveSavedDocumentToTrash = (savedDocument: SavedDocument) => {
    const shouldMove = window.confirm(
      `Move "${savedDocument.title}" to trash?`,
    );

    if (shouldMove) {
      moveDocumentToTrash(savedDocument);
    }
  };

  const permanentlyDeleteSavedDocument = async (
    savedDocument: SavedDocument,
  ) => {
    const shouldDelete = window.confirm(
      `Delete "${savedDocument.title}" forever? This cannot be undone.`,
    );

    if (!shouldDelete) {
      return;
    }

    await deleteDocument(savedDocument);
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

  const openHelpPanel = useCallback(() => {
    if (screen === "reader") {
      pauseReader();
      revealReaderControls();
    }

    openHelp();
  }, [openHelp, pauseReader, revealReaderControls, screen]);

  const startDemoFromHelp = useCallback(() => {
    closeHelp();
    startDemo();
  }, [closeHelp]);

  useReaderKeyboardControls({
    enabled: screen === "reader" && !isHelpOpen,
    wordCount: words.length,
    isFocusMode,
    onRevealControls: revealReaderControls,
    onTogglePlayback: togglePlayback,
    onPreviousWord: previousWord,
    onNextWord: nextWord,
    onIncreaseSpeed: increaseSpeed,
    onDecreaseSpeed: decreaseSpeed,
    onToggleFocusMode: toggleFocusMode,
    onOpenHelp: openHelpPanel,
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
    return (
      <AuthPage
        documents={savedDocuments}
        libraryMode={libraryMode}
      />
    );
  }

  if (screen === "home" && isLibraryPage) {
    return (
      <>
      <LibraryPage
        userEmail={user?.email}
        accountLabel={accountLabel}
        cloudConnectionLabel={cloudConnectionLabel}
        cloudConnectionStatus={cloudConnectionStatus}
        isOnline={isOnline}
        cloudSyncState={cloudSyncState}
        libraryStorageLabel={libraryStorageLabel}
        savedDocumentCount={activeDocumentCount}
        activeDocumentCount={activeDocumentCount}
        archivedDocumentCount={archivedDocumentCount}
        trashedDocumentCount={trashedDocumentCount}
        currentSectionDocumentCount={currentSectionDocumentCount}
        visibleDocuments={visibleDocuments}
        librarySectionRef={librarySectionRef}
        showMigrationPrompt={showMigrationPrompt}
        localMigrationDocumentCount={localMigrationDocuments.length}
        isMigratingLibrary={isMigratingLibrary}
        isLibraryLoading={isLibraryLoading}
        libraryQuery={libraryQuery}
        librarySort={librarySort}
        librarySection={librarySection}
        libraryError={libraryError}
        editingDocumentId={editingDocumentId}
        editTitle={editTitle}
        editText={editText}
        editError={editError}
        onNavigateHome={navigateHome}
        onOpenLibrary={openLibrary}
        onOpenAccount={openAccount}
        onOpenHelp={openHelpPanel}
        onRetrySync={() => void synchronizeCurrentCloudLibrary()}
        onImportLocalLibrary={() => void importLocalLibraryToCloud()}
        onDismissMigration={dismissMigrationPrompt}
        onLibraryQueryChange={setLibraryQuery}
        onLibrarySortChange={setLibrarySort}
        onLibrarySectionChange={setLibrarySection}
        onContinueDocument={continueSavedDocument}
        onRestartDocument={restartSavedDocument}
        onStartEdit={startEditingDocument}
        onEditTitleChange={setEditTitle}
        onEditTextChange={setEditText}
        onSaveEdit={() => void saveEditedDocument()}
        onCancelEdit={cancelEditingDocument}
        onArchiveDocument={archiveDocument}
        onUnarchiveDocument={unarchiveDocument}
        onMoveToTrash={moveSavedDocumentToTrash}
        onRestoreDocument={restoreTrashedDocument}
        onDeleteForever={permanentlyDeleteSavedDocument}
      />
      <HelpDialog
        isOpen={isHelpOpen}
        isAuthenticated={Boolean(user)}
        onClose={closeHelp}
        onStartDemo={startDemoFromHelp}
      />
      </>
    );
  }

  if (screen === "home") {
    return (
      <>
      <HomePage
        userEmail={user?.email}
        accountLabel={accountLabel}
        cloudConnectionLabel={cloudConnectionLabel}
        cloudConnectionStatus={cloudConnectionStatus}
        isOnline={isOnline}
        savedDocumentCount={activeDocumentCount}
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
        pdfPageCount={pdfImportDetails?.pageCount ?? null}
        pdfRemovedRepeatedLines={
          pdfImportDetails?.removedRepeatedLines ?? 0
        }
        pdfRemovedPageNumberLines={
          pdfImportDetails?.removedPageNumberLines ?? 0
        }
        pdfEmptyPageCount={pdfImportDetails?.emptyPageCount ?? 0}
        pdfWarnings={pdfImportDetails?.warnings ?? []}
        pdfInputRef={pdfInputRef}
        onNavigateHome={navigateHome}
        onOpenLibrary={openLibrary}
        onOpenAccount={openAccount}
        onOpenHelp={openHelpPanel}
        onStartDemo={startDemo}
        onContinueDocument={continueSavedDocument}
        onDraftTitleChange={updateDraftTitle}
        onDraftTextChange={updateDraftText}
        onStartReading={startPastedText}
        onPdfUpload={handlePdfUpload}
      />
      <HelpDialog
        isOpen={isHelpOpen}
        isAuthenticated={Boolean(user)}
        onClose={closeHelp}
        onStartDemo={startDemoFromHelp}
      />
      </>
    );
  }

  return (
    <>
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
      onOpenHelp={openHelpPanel}
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
    <HelpDialog
      isOpen={isHelpOpen}
      isAuthenticated={Boolean(user)}
      onClose={closeHelp}
      onStartDemo={startDemoFromHelp}
    />
    </>
  );
}

export default App;
