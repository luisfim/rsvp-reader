import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import {
  mergeDocumentLibraries,
  synchronizeCloudLibrary,
} from "../lib/cloudLibrary";
import {
  loadSavedDocuments,
  persistSavedDocuments,
  type SavedDocument,
} from "../lib/library";
import {
  loadOfflineCloudState,
  queueOfflineCloudDeletion,
  saveOfflineCloudState,
  withOfflineDocuments,
  type OfflineCloudState,
} from "../lib/offlineCloudLibrary";
import type { CloudSyncState, LibraryMode } from "../types/app";
import type { ReaderSnapshot } from "../types/reader";

interface UseLibrarySyncOptions {
  userId: string | null;
  isOnline: boolean;
}

interface UseLibrarySyncResult {
  savedDocuments: SavedDocument[];
  setSavedDocuments: Dispatch<SetStateAction<SavedDocument[]>>;
  libraryError: string;
  lastSavedAt: number | null;
  libraryMode: LibraryMode;
  isLibraryLoading: boolean;
  cloudSyncState: CloudSyncState;
  localMigrationDocuments: SavedDocument[];
  showMigrationPrompt: boolean;
  isMigratingLibrary: boolean;
  synchronizeCurrentCloudLibrary: (
    stateOverride?: OfflineCloudState,
  ) => Promise<void>;
  importLocalLibraryToCloud: () => Promise<void>;
  dismissMigrationPrompt: () => void;
  deleteDocument: (document: SavedDocument) => Promise<void>;
  saveReaderProgress: (snapshot: ReaderSnapshot) => void;
  persistReaderSnapshot: (snapshot: ReaderSnapshot) => void;
  markReaderOpened: (documentId?: string | null) => void;
}

export function documentLibrariesMatch(
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

export function createEmptyOfflineCloudState(): OfflineCloudState {
  return {
    documents: [],
    deletions: [],
    updatedAt: new Date(0).toISOString(),
  };
}

export function updateDocumentsFromReaderSnapshot(
  documents: SavedDocument[],
  snapshot: ReaderSnapshot,
  updatedAt: string,
): SavedDocument[] {
  if (!snapshot.activeDocumentId) {
    return documents;
  }

  return documents.map((document) =>
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
}

export function findDocumentsAvailableForImport(
  localDocuments: SavedDocument[],
  cloudDocuments: SavedDocument[],
): SavedDocument[] {
  return localDocuments.filter((localDocument) => {
    const cloudDocument = cloudDocuments.find(
      (document) => document.id === localDocument.id,
    );

    return (
      !cloudDocument ||
      Date.parse(localDocument.updatedAt) >
        Date.parse(cloudDocument.updatedAt)
    );
  });
}

export function useLibrarySync({
  userId,
  isOnline,
}: UseLibrarySyncOptions): UseLibrarySyncResult {
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

  const cloudLibraryReadyRef = useRef(false);
  const cloudSyncTimerRef = useRef<number | null>(null);
  const cloudSyncInProgressRef = useRef(false);
  const cloudSyncRequestedRef = useRef(false);
  const offlineCloudStateRef = useRef<OfflineCloudState | null>(null);
  const savedDocumentsRef = useRef<SavedDocument[]>(savedDocuments);

  const synchronizeCurrentCloudLibrary = useCallback(
    async (stateOverride?: OfflineCloudState) => {
      if (!userId) {
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
            (await loadOfflineCloudState(userId));

          const stateToSynchronize = withOfflineDocuments(
            cachedState,
            savedDocumentsRef.current,
          );

          offlineCloudStateRef.current = stateToSynchronize;
          await saveOfflineCloudState(userId, stateToSynchronize);

          const synchronizedState = await synchronizeCloudLibrary(
            userId,
            stateToSynchronize,
          );

          const latestLocalState = offlineCloudStateRef.current;
          const localChangedDuringSync = Boolean(
            latestLocalState &&
              Date.parse(latestLocalState.updatedAt) >
                Date.parse(stateToSynchronize.updatedAt),
          );

          const nextState =
            localChangedDuringSync && latestLocalState
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
          await saveOfflineCloudState(userId, nextState);

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
    [isOnline, userId],
  );

  useEffect(() => {
    let isCancelled = false;

    async function switchLibraryForCurrentUser() {
      cloudLibraryReadyRef.current = false;
      offlineCloudStateRef.current = null;

      if (!userId) {
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
        const cachedState = await loadOfflineCloudState(userId);

        if (isCancelled) {
          return;
        }

        offlineCloudStateRef.current = cachedState;
        savedDocumentsRef.current = cachedState.documents;
        setSavedDocuments(cachedState.documents);
        cloudLibraryReadyRef.current = true;
        setIsLibraryLoading(false);

        const documentsAvailableForImport =
          findDocumentsAvailableForImport(
            localDocuments,
            cachedState.documents,
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
    // Changing connectivity is handled by the dedicated online effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    savedDocumentsRef.current = savedDocuments;

    if (!userId) {
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
    void saveOfflineCloudState(userId, nextOfflineState);

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
    userId,
  ]);

  useEffect(() => {
    if (!userId || !cloudLibraryReadyRef.current) {
      return;
    }

    if (!isOnline) {
      setCloudSyncState("offline");
      return;
    }

    void synchronizeCurrentCloudLibrary();
  }, [isOnline, synchronizeCurrentCloudLibrary, userId]);

  const importLocalLibraryToCloud = useCallback(async () => {
    if (!userId || localMigrationDocuments.length === 0) {
      return;
    }

    setIsMigratingLibrary(true);
    setLibraryError("");

    try {
      const mergedDocuments = mergeDocumentLibraries(
        savedDocumentsRef.current,
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
      await saveOfflineCloudState(userId, nextOfflineState);
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
  }, [
    isOnline,
    localMigrationDocuments,
    synchronizeCurrentCloudLibrary,
    userId,
  ]);

  const dismissMigrationPrompt = useCallback(() => {
    setShowMigrationPrompt(false);
  }, []);

  const deleteDocument = useCallback(
    async (document: SavedDocument) => {
      const nextDocuments = savedDocumentsRef.current.filter(
        (savedDocument) => savedDocument.id !== document.id,
      );

      savedDocumentsRef.current = nextDocuments;
      setSavedDocuments(nextDocuments);

      if (!userId) {
        return;
      }

      const currentOfflineState =
        offlineCloudStateRef.current ?? createEmptyOfflineCloudState();
      const nextOfflineState = queueOfflineCloudDeletion(
        {
          ...currentOfflineState,
          documents: nextDocuments,
        },
        document,
      );

      offlineCloudStateRef.current = nextOfflineState;
      await saveOfflineCloudState(userId, nextOfflineState);
      setCloudSyncState(isOnline ? "pending" : "offline");

      if (isOnline) {
        void synchronizeCurrentCloudLibrary(nextOfflineState);
      }
    },
    [isOnline, synchronizeCurrentCloudLibrary, userId],
  );

  const saveReaderProgress = useCallback((snapshot: ReaderSnapshot) => {
    if (!snapshot.activeDocumentId) {
      return;
    }

    const updatedDocuments = updateDocumentsFromReaderSnapshot(
      savedDocumentsRef.current,
      snapshot,
      new Date().toISOString(),
    );

    savedDocumentsRef.current = updatedDocuments;
    setSavedDocuments(updatedDocuments);
    setLastSavedAt(Date.now());
  }, []);

  const persistReaderSnapshot = useCallback(
    (snapshot: ReaderSnapshot) => {
      if (!snapshot.activeDocumentId) {
        return;
      }

      const updatedDocuments = updateDocumentsFromReaderSnapshot(
        savedDocumentsRef.current,
        snapshot,
        new Date().toISOString(),
      );

      savedDocumentsRef.current = updatedDocuments;

      if (userId) {
        const currentOfflineState =
          offlineCloudStateRef.current ?? createEmptyOfflineCloudState();
        const nextOfflineState = withOfflineDocuments(
          currentOfflineState,
          updatedDocuments,
        );

        offlineCloudStateRef.current = nextOfflineState;
        void saveOfflineCloudState(userId, nextOfflineState);

        if (isOnline) {
          void synchronizeCurrentCloudLibrary(nextOfflineState);
        }

        return;
      }

      try {
        persistSavedDocuments(updatedDocuments);
      } catch {
        // A pagehide event has no reliable place to display an error.
      }
    },
    [isOnline, synchronizeCurrentCloudLibrary, userId],
  );

  const markReaderOpened = useCallback((documentId?: string | null) => {
    setLastSavedAt(documentId ? Date.now() : null);
  }, []);

  return {
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
  };
}
