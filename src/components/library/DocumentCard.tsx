import type { SavedDocument } from "../../lib/library";

interface DocumentCardProps {
  document: SavedDocument;
  isRenaming: boolean;
  renameValue: string;
  onRenameValueChange: (value: string) => void;
  onContinue: (document: SavedDocument) => void;
  onRestart: (document: SavedDocument) => void;
  onStartRename: (document: SavedDocument) => void;
  onSaveRename: (document: SavedDocument) => void;
  onCancelRename: () => void;
  onDelete: (document: SavedDocument) => void;
}

export function DocumentCard({
  document,
  isRenaming,
  renameValue,
  onRenameValueChange,
  onContinue,
  onRestart,
  onStartRename,
  onSaveRename,
  onCancelRename,
  onDelete,
}: DocumentCardProps) {
  const exactProgress =
    document.wordCount <= 1
      ? 0
      : (document.currentWordIndex / (document.wordCount - 1)) * 100;

  const progressLabel =
    exactProgress > 0 && exactProgress < 1
      ? "<1"
      : Math.round(exactProgress).toString();

  return (
    <article className="saved-document-card">
      <div className="saved-document-main">
        <span className="saved-document-date">
          Updated{" "}
          {new Date(document.updatedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>

        {isRenaming ? (
          <div className="rename-document-form">
            <input
              autoFocus
              type="text"
              value={renameValue}
              onChange={(event) =>
                onRenameValueChange(event.target.value)
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  onSaveRename(document);
                }

                if (event.key === "Escape") {
                  onCancelRename();
                }
              }}
              maxLength={120}
              aria-label={`Rename ${document.title}`}
            />

            <div className="rename-document-actions">
              <button
                type="button"
                onClick={() => onSaveRename(document)}
                disabled={!renameValue.trim()}
              >
                Save
              </button>

              <button type="button" onClick={onCancelRename}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <h3>{document.title}</h3>
        )}

        <p>
          Word{" "}
          {Math.min(
            document.currentWordIndex + 1,
            document.wordCount,
          ).toLocaleString("en-US")}{" "}
          of {document.wordCount.toLocaleString("en-US")} · {progressLabel}% complete
        </p>
      </div>

      <div className="saved-document-progress">
        <span style={{ width: `${exactProgress}%` }} />
      </div>

      <div className="saved-document-actions">
        <button
          className="continue-document-button"
          type="button"
          onClick={() => onContinue(document)}
        >
          {document.currentWordIndex > 0 ? "Continue" : "Start"}
        </button>

        <button type="button" onClick={() => onRestart(document)}>
          Restart
        </button>

        <button type="button" onClick={() => onStartRename(document)}>
          Rename
        </button>

        <button
          className="delete-document-button"
          type="button"
          onClick={() => onDelete(document)}
        >
          Delete
        </button>
      </div>
    </article>
  );
}
