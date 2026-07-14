import type { SavedDocument } from "./library";

const DATABASE_NAME = "rsvp-reader-offline-cloud-v1";
const DATABASE_VERSION = 1;
const STORE_NAME = "cloud-library-states";
const FALLBACK_KEY_PREFIX = "rsvp-reader-offline-cloud-state:";

export interface PendingCloudDeletion {
  document: SavedDocument;
  deletedAt: string;
}

export interface OfflineCloudState {
  documents: SavedDocument[];
  deletions: PendingCloudDeletion[];
  updatedAt: string;
}

interface StoredOfflineCloudState extends OfflineCloudState {
  userId: string;
}

function createEmptyState(): OfflineCloudState {
  return {
    documents: [],
    deletions: [],
    updatedAt: new Date(0).toISOString(),
  };
}

function sortDocuments(documents: SavedDocument[]): SavedDocument[] {
  return [...documents].sort(
    (firstDocument, secondDocument) =>
      Date.parse(secondDocument.updatedAt) -
      Date.parse(firstDocument.updatedAt),
  );
}

function normalizeState(value: unknown): OfflineCloudState {
  if (!value || typeof value !== "object") {
    return createEmptyState();
  }

  const state = value as Partial<StoredOfflineCloudState>;

  return {
    documents: Array.isArray(state.documents)
      ? sortDocuments(state.documents as SavedDocument[])
      : [],
    deletions: Array.isArray(state.deletions)
      ? (state.deletions as PendingCloudDeletion[])
      : [],
    updatedAt:
      typeof state.updatedAt === "string"
        ? state.updatedAt
        : new Date(0).toISOString(),
  };
}

function getFallbackKey(userId: string): string {
  return `${FALLBACK_KEY_PREFIX}${userId}`;
}

function loadFallbackState(userId: string): OfflineCloudState {
  if (typeof window === "undefined") {
    return createEmptyState();
  }

  try {
    const storedValue = window.localStorage.getItem(
      getFallbackKey(userId),
    );

    return storedValue
      ? normalizeState(JSON.parse(storedValue))
      : createEmptyState();
  } catch {
    return createEmptyState();
  }
}

function saveFallbackState(
  userId: string,
  state: OfflineCloudState,
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      getFallbackKey(userId),
      JSON.stringify(state),
    );
  } catch {
    // IndexedDB is the primary storage. The fallback is best effort only.
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable."));
      return;
    }

    const request = indexedDB.open(
      DATABASE_NAME,
      DATABASE_VERSION,
    );

    request.onerror = () => {
      reject(
        request.error ??
          new Error("The offline database could not be opened."),
      );
    };

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, {
          keyPath: "userId",
        });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

async function readIndexedState(
  userId: string,
): Promise<OfflineCloudState | null> {
  const database = await openDatabase();

  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(
        STORE_NAME,
        "readonly",
      );
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(userId);

      request.onerror = () => {
        reject(
          request.error ??
            new Error("The offline library could not be read."),
        );
      };

      request.onsuccess = () => {
        resolve(
          request.result
            ? normalizeState(request.result)
            : null,
        );
      };
    });
  } finally {
    database.close();
  }
}

async function writeIndexedState(
  userId: string,
  state: OfflineCloudState,
): Promise<void> {
  const database = await openDatabase();

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(
        STORE_NAME,
        "readwrite",
      );
      const store = transaction.objectStore(STORE_NAME);

      store.put({
        userId,
        documents: sortDocuments(state.documents),
        deletions: state.deletions,
        updatedAt: state.updatedAt,
      } satisfies StoredOfflineCloudState);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => {
        reject(
          transaction.error ??
            new Error("The offline library could not be saved."),
        );
      };
      transaction.onabort = () => {
        reject(
          transaction.error ??
            new Error("The offline library save was cancelled."),
        );
      };
    });
  } finally {
    database.close();
  }
}

export async function loadOfflineCloudState(
  userId: string,
): Promise<OfflineCloudState> {
  try {
    const indexedState = await readIndexedState(userId);

    if (indexedState) {
      return indexedState;
    }
  } catch {
    // Continue with the localStorage fallback.
  }

  return loadFallbackState(userId);
}

export async function saveOfflineCloudState(
  userId: string,
  state: OfflineCloudState,
): Promise<void> {
  const normalizedState: OfflineCloudState = {
    documents: sortDocuments(state.documents),
    deletions: state.deletions,
    updatedAt: state.updatedAt,
  };

  saveFallbackState(userId, normalizedState);

  try {
    await writeIndexedState(userId, normalizedState);
  } catch {
    // The localStorage fallback has already been attempted.
  }
}

export function withOfflineDocuments(
  state: OfflineCloudState,
  documents: SavedDocument[],
): OfflineCloudState {
  return {
    ...state,
    documents: sortDocuments(documents),
    updatedAt: new Date().toISOString(),
  };
}

export function queueOfflineCloudDeletion(
  state: OfflineCloudState,
  document: SavedDocument,
  deletedAt = new Date().toISOString(),
): OfflineCloudState {
  const deletionById = new Map(
    state.deletions.map((deletion) => [
      deletion.document.id,
      deletion,
    ]),
  );

  const existingDeletion = deletionById.get(document.id);

  if (
    !existingDeletion ||
    Date.parse(deletedAt) >= Date.parse(existingDeletion.deletedAt)
  ) {
    deletionById.set(document.id, {
      document: {
        ...document,
        updatedAt: deletedAt,
      },
      deletedAt,
    });
  }

  return {
    documents: state.documents.filter(
      (savedDocument) => savedDocument.id !== document.id,
    ),
    deletions: [...deletionById.values()],
    updatedAt: deletedAt,
  };
}
