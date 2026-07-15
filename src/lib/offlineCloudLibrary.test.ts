import { describe, expect, it } from "vitest";
import {
  clearOfflineCloudState,
  loadOfflineCloudState,
  queueOfflineCloudDeletion,
  saveOfflineCloudState,
  withOfflineDocuments,
  type OfflineCloudState,
} from "./offlineCloudLibrary";
import type { SavedDocument } from "./library";

function makeDocument(
  id: string,
  updatedAt: string,
): SavedDocument {
  return {
    id,
    title: id,
    text: "one two",
    wordCount: 2,
    currentWordIndex: 0,
    wordsPerMinute: 400,
    fontSize: 72,
    useNaturalPauses: false,
    createdAt: updatedAt,
    updatedAt,
  };
}

function makeState(documents: SavedDocument[]): OfflineCloudState {
  return {
    documents,
    deletions: [],
    updatedAt: "2026-07-14T10:00:00.000Z",
  };
}

describe("offline cloud library helpers", () => {
  it("sorts cached documents from newest to oldest", () => {
    const state = withOfflineDocuments(makeState([]), [
      makeDocument("older", "2026-07-14T10:00:00.000Z"),
      makeDocument("newer", "2026-07-14T12:00:00.000Z"),
    ]);

    expect(state.documents.map((document) => document.id)).toEqual([
      "newer",
      "older",
    ]);
  });

  it("removes a document and queues a deletion tombstone", () => {
    const document = makeDocument(
      "deleted",
      "2026-07-14T10:00:00.000Z",
    );

    const state = queueOfflineCloudDeletion(
      makeState([document]),
      document,
      "2026-07-14T13:00:00.000Z",
    );

    expect(state.documents).toEqual([]);
    expect(state.deletions).toHaveLength(1);
    expect(state.deletions[0].document.id).toBe("deleted");
    expect(state.deletions[0].deletedAt).toBe(
      "2026-07-14T13:00:00.000Z",
    );
  });
  it("clears the cached cloud library for a deleted account", async () => {
    const userId = "deleted-user";
    const state = makeState([
      makeDocument("cached", "2026-07-14T12:00:00.000Z"),
    ]);

    await saveOfflineCloudState(userId, state);
    expect((await loadOfflineCloudState(userId)).documents).toHaveLength(1);

    await clearOfflineCloudState(userId);

    expect((await loadOfflineCloudState(userId)).documents).toEqual([]);
  });

});
