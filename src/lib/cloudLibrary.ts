import type { SavedDocument } from "./library";
import type {
  OfflineCloudState,
  PendingCloudDeletion,
} from "./offlineCloudLibrary";
import { supabase } from "./supabase";

interface CloudDocumentRow {
  id: string;
  user_id: string;
  title: string;
  content: string;
  word_count: number;
  current_word_index: number;
  words_per_minute: number;
  font_size: number;
  use_natural_pauses: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface CloudDocumentRecord {
  document: SavedDocument;
  deletedAt: string | null;
}

type LibraryEvent =
  | {
      kind: "document";
      document: SavedDocument;
      timestamp: number;
    }
  | {
      kind: "deletion";
      deletion: PendingCloudDeletion;
      timestamp: number;
    };

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  return supabase;
}

function timestamp(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const parsedValue = Date.parse(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function sortDocuments(documents: SavedDocument[]): SavedDocument[] {
  return [...documents].sort(
    (firstDocument, secondDocument) =>
      timestamp(secondDocument.updatedAt) -
      timestamp(firstDocument.updatedAt),
  );
}

function toSavedDocument(row: CloudDocumentRow): SavedDocument {
  return {
    id: row.id,
    title: row.title,
    text: row.content,
    wordCount: row.word_count,
    currentWordIndex: row.current_word_index,
    wordsPerMinute: row.words_per_minute,
    fontSize: row.font_size,
    useNaturalPauses: row.use_natural_pauses,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCloudRow(
  userId: string,
  document: SavedDocument,
  deletedAt: string | null = null,
): CloudDocumentRow {
  return {
    id: document.id,
    user_id: userId,
    title: document.title,
    content: document.text,
    word_count: document.wordCount,
    current_word_index: document.currentWordIndex,
    words_per_minute: document.wordsPerMinute,
    font_size: document.fontSize,
    use_natural_pauses: document.useNaturalPauses,
    created_at: document.createdAt,
    updated_at: deletedAt ?? document.updatedAt,
    deleted_at: deletedAt,
  };
}

async function loadCloudDocumentRecords(
  userId: string,
): Promise<CloudDocumentRecord[]> {
  const client = requireSupabase();

  const { data, error } = await client
    .from("documents")
    .select(
      "id,user_id,title,content,word_count,current_word_index,words_per_minute,font_size,use_natural_pauses,created_at,updated_at,deleted_at",
    )
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as CloudDocumentRow[]).map((row) => ({
    document: toSavedDocument(row),
    deletedAt: row.deleted_at,
  }));
}

async function upsertCloudRecords(
  userId: string,
  records: CloudDocumentRecord[],
): Promise<void> {
  if (records.length === 0) {
    return;
  }

  const client = requireSupabase();
  const rows = records.map((record) =>
    toCloudRow(userId, record.document, record.deletedAt),
  );

  const { error } = await client.from("documents").upsert(rows, {
    onConflict: "id",
  });

  if (error) {
    throw new Error(error.message);
  }
}

function chooseLaterEvent(
  currentEvent: LibraryEvent | undefined,
  candidateEvent: LibraryEvent,
): LibraryEvent {
  if (!currentEvent) {
    return candidateEvent;
  }

  if (candidateEvent.timestamp > currentEvent.timestamp) {
    return candidateEvent;
  }

  if (candidateEvent.timestamp < currentEvent.timestamp) {
    return currentEvent;
  }

  // If two devices produce the same timestamp, deletion wins to avoid
  // unintentionally restoring a document that another device removed.
  if (
    candidateEvent.kind === "deletion" &&
    currentEvent.kind === "document"
  ) {
    return candidateEvent;
  }

  return currentEvent;
}

function buildWinningEvents(
  localState: OfflineCloudState,
  remoteRecords: CloudDocumentRecord[],
): Map<string, LibraryEvent> {
  const winningEvents = new Map<string, LibraryEvent>();

  const considerEvent = (documentId: string, event: LibraryEvent) => {
    winningEvents.set(
      documentId,
      chooseLaterEvent(winningEvents.get(documentId), event),
    );
  };

  for (const document of localState.documents) {
    considerEvent(document.id, {
      kind: "document",
      document,
      timestamp: timestamp(document.updatedAt),
    });
  }

  for (const deletion of localState.deletions) {
    considerEvent(deletion.document.id, {
      kind: "deletion",
      deletion,
      timestamp: timestamp(deletion.deletedAt),
    });
  }

  for (const record of remoteRecords) {
    if (record.deletedAt) {
      considerEvent(record.document.id, {
        kind: "deletion",
        deletion: {
          document: {
            ...record.document,
            updatedAt: record.deletedAt,
          },
          deletedAt: record.deletedAt,
        },
        timestamp: Math.max(
          timestamp(record.deletedAt),
          timestamp(record.document.updatedAt),
        ),
      });
      continue;
    }

    considerEvent(record.document.id, {
      kind: "document",
      document: record.document,
      timestamp: timestamp(record.document.updatedAt),
    });
  }

  return winningEvents;
}

function recordsNeedUpdate(
  winningEvent: LibraryEvent,
  remoteRecord: CloudDocumentRecord | undefined,
): boolean {
  if (!remoteRecord) {
    return true;
  }

  const remoteTimestamp = remoteRecord.deletedAt
    ? Math.max(
        timestamp(remoteRecord.deletedAt),
        timestamp(remoteRecord.document.updatedAt),
      )
    : timestamp(remoteRecord.document.updatedAt);

  if (winningEvent.timestamp > remoteTimestamp) {
    return true;
  }

  if (winningEvent.timestamp < remoteTimestamp) {
    return false;
  }

  if (winningEvent.kind === "deletion") {
    return !remoteRecord.deletedAt;
  }

  return Boolean(remoteRecord.deletedAt);
}

export async function synchronizeCloudLibrary(
  userId: string,
  localState: OfflineCloudState,
): Promise<OfflineCloudState> {
  const remoteRecords = await loadCloudDocumentRecords(userId);
  const remoteById = new Map(
    remoteRecords.map((record) => [record.document.id, record]),
  );
  const winningEvents = buildWinningEvents(localState, remoteRecords);

  const recordsToUpsert: CloudDocumentRecord[] = [];
  const synchronizedDocuments: SavedDocument[] = [];

  for (const [documentId, winningEvent] of winningEvents) {
    const remoteRecord = remoteById.get(documentId);

    if (winningEvent.kind === "document") {
      synchronizedDocuments.push(winningEvent.document);

      if (recordsNeedUpdate(winningEvent, remoteRecord)) {
        recordsToUpsert.push({
          document: winningEvent.document,
          deletedAt: null,
        });
      }

      continue;
    }

    if (recordsNeedUpdate(winningEvent, remoteRecord)) {
      recordsToUpsert.push({
        document: {
          ...winningEvent.deletion.document,
          updatedAt: winningEvent.deletion.deletedAt,
        },
        deletedAt: winningEvent.deletion.deletedAt,
      });
    }
  }

  await upsertCloudRecords(userId, recordsToUpsert);

  return {
    documents: sortDocuments(synchronizedDocuments),
    deletions: [],
    updatedAt: new Date().toISOString(),
  };
}

export async function loadCloudDocuments(
  userId: string,
): Promise<SavedDocument[]> {
  const records = await loadCloudDocumentRecords(userId);

  return sortDocuments(
    records
      .filter((record) => !record.deletedAt)
      .map((record) => record.document),
  );
}

export async function upsertCloudDocuments(
  userId: string,
  documents: SavedDocument[],
): Promise<void> {
  await upsertCloudRecords(
    userId,
    documents.map((document) => ({
      document,
      deletedAt: null,
    })),
  );
}

export async function deleteCloudDocument(
  userId: string,
  documentId: string,
): Promise<void> {
  const client = requireSupabase();

  const { error } = await client
    .from("documents")
    .delete()
    .eq("id", documentId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

export function mergeDocumentLibraries(
  firstLibrary: SavedDocument[],
  secondLibrary: SavedDocument[],
): SavedDocument[] {
  const documentsById = new Map<string, SavedDocument>();

  for (const document of [...firstLibrary, ...secondLibrary]) {
    const existingDocument = documentsById.get(document.id);

    if (
      !existingDocument ||
      timestamp(document.updatedAt) >=
        timestamp(existingDocument.updatedAt)
    ) {
      documentsById.set(document.id, document);
    }
  }

  return sortDocuments([...documentsById.values()]);
}
