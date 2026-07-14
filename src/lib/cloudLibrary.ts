import type { SavedDocument } from "./library";
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
}

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  return supabase;
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
    updated_at: document.updatedAt,
  };
}

export async function loadCloudDocuments(
  userId: string,
): Promise<SavedDocument[]> {
  const client = requireSupabase();

  const { data, error } = await client
    .from("documents")
    .select(
      "id,user_id,title,content,word_count,current_word_index,words_per_minute,font_size,use_natural_pauses,created_at,updated_at",
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as CloudDocumentRow[]).map(toSavedDocument);
}

export async function upsertCloudDocuments(
  userId: string,
  documents: SavedDocument[],
): Promise<void> {
  if (documents.length === 0) {
    return;
  }

  const client = requireSupabase();
  const rows = documents.map((document) =>
    toCloudRow(userId, document),
  );

  const { error } = await client.from("documents").upsert(rows, {
    onConflict: "id",
  });

  if (error) {
    throw new Error(error.message);
  }
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
      new Date(document.updatedAt).getTime() >=
        new Date(existingDocument.updatedAt).getTime()
    ) {
      documentsById.set(document.id, document);
    }
  }

  return [...documentsById.values()].sort(
    (firstDocument, secondDocument) =>
      new Date(secondDocument.updatedAt).getTime() -
      new Date(firstDocument.updatedAt).getTime(),
  );
}
