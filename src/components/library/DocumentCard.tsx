import type { SavedDocument } from "../../lib/library";
import type { LibrarySection } from "../../types/app";

interface DocumentCardProps {
  document: SavedDocument;
  section: LibrarySection;
  onContinue: (document: SavedDocument) => void;
  onRestart: (document: SavedDocument) => void;
  onEdit: (document: SavedDocument) => void;
  onArchive: (document: SavedDocument) => void;
  onUnarchive: (document: SavedDocument) => void;
  onMoveToTrash: (document: SavedDocument) => void;
  onRestore: (document: SavedDocument) => void;
  onDeleteForever: (document: SavedDocument) => void | Promise<void>;
}

function formatDocumentDate(
  document: SavedDocument,
  section: LibrarySection,
): string {
  const value =
    section === "trash"
      ? document.trashedAt
      : section === "archived"
        ? document.archivedAt
        : document.updatedAt;

  return new Date(value ?? document.updatedAt).toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  );
}

export function DocumentCard({
  document,
  section,
  onContinue,
  onRestart,
  onEdit,
  onArchive,
  onUnarchive,
  onMoveToTrash,
  onRestore,
  onDeleteForever,
}: DocumentCardProps) {
  const exactProgress =
    document.wordCount <= 1
      ? 0
      : (document.currentWordIndex / (document.wordCount - 1)) * 100;

  const progressLabel =
    exactProgress > 0 && exactProgress < 1
      ? "<1"
      : Math.round(exactProgress).toString();

  const datePrefix =
    section === "trash"
      ? "Deleted"
      : section === "archived"
        ? "Archived"
        : "Updated";

  return (
    <article
      className={`saved-document-card saved-document-card-${section}`}
    >
      <div className="saved-document-main">
        <div className="saved-document-meta-row">
          <span className="saved-document-date">
            {datePrefix} {formatDocumentDate(document, section)}
          </span>
          {section !== "active" && (
            <span className={`document-status-badge ${section}`}>
              {section === "trash" ? "Trash" : "Archived"}
            </span>
          )}
        </div>

        <h3>{document.title}</h3>

        <p>
          Word{" "}
          {Math.min(
            document.currentWordIndex + 1,
            document.wordCount,
          ).toLocaleString("en-US")} {" "}
          of {document.wordCount.toLocaleString("en-US")} · {progressLabel}% complete
        </p>
      </div>

      <div className="saved-document-progress">
        <span style={{ width: `${exactProgress}%` }} />
      </div>

      <div className="saved-document-actions">
        {section !== "trash" && (
          <button
            className="continue-document-button"
            type="button"
            onClick={() => onContinue(document)}
          >
            {document.currentWordIndex > 0 ? "Continue" : "Start"}
          </button>
        )}

        {section === "active" && (
          <button type="button" onClick={() => onRestart(document)}>
            Restart
          </button>
        )}

        {section !== "trash" && (
          <button type="button" onClick={() => onEdit(document)}>
            Edit
          </button>
        )}

        {section === "active" && (
          <button type="button" onClick={() => onArchive(document)}>
            Archive
          </button>
        )}

        {section === "archived" && (
          <button type="button" onClick={() => onUnarchive(document)}>
            Unarchive
          </button>
        )}

        {section !== "trash" && (
          <button
            className="delete-document-button"
            type="button"
            onClick={() => onMoveToTrash(document)}
          >
            Move to trash
          </button>
        )}

        {section === "trash" && (
          <>
            <button
              className="continue-document-button"
              type="button"
              onClick={() => onRestore(document)}
            >
              Restore
            </button>
            <button
              className="delete-document-button"
              type="button"
              onClick={() => onDeleteForever(document)}
            >
              Delete forever
            </button>
          </>
        )}
      </div>
    </article>
  );
}
