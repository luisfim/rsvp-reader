import type { RefObject } from "react";

import type { SavedDocument } from "../lib/library";
import type {
  CloudConnectionStatus,
  CloudSyncState,
  LibrarySection,
  LibrarySort,
} from "../types/app";
import { AppHeader } from "../components/layout/AppHeader";
import { DocumentCard } from "../components/library/DocumentCard";
import { DocumentEditorDialog } from "../components/library/DocumentEditorDialog";

interface LibraryPageProps {
  userEmail?: string | null;
  accountLabel: string;
  cloudConnectionLabel: string | null;
  cloudConnectionStatus: CloudConnectionStatus;
  isOnline: boolean;
  cloudSyncState: CloudSyncState;
  libraryStorageLabel: string;
  savedDocumentCount: number;
  activeDocumentCount: number;
  archivedDocumentCount: number;
  trashedDocumentCount: number;
  currentSectionDocumentCount: number;
  visibleDocuments: SavedDocument[];
  librarySectionRef: RefObject<HTMLElement | null>;
  showMigrationPrompt: boolean;
  localMigrationDocumentCount: number;
  isMigratingLibrary: boolean;
  isLibraryLoading: boolean;
  libraryQuery: string;
  librarySort: LibrarySort;
  librarySection: LibrarySection;
  libraryError: string;
  editingDocumentId: string | null;
  editTitle: string;
  editText: string;
  editError: string;
  onNavigateHome: () => void;
  onOpenLibrary: () => void;
  onOpenAccount: () => void;
  onOpenHelp: () => void;
  onRetrySync: () => void;
  onImportLocalLibrary: () => void;
  onDismissMigration: () => void;
  onLibraryQueryChange: (value: string) => void;
  onLibrarySortChange: (value: LibrarySort) => void;
  onLibrarySectionChange: (value: LibrarySection) => void;
  onContinueDocument: (document: SavedDocument) => void;
  onRestartDocument: (document: SavedDocument) => void;
  onStartEdit: (document: SavedDocument) => void;
  onEditTitleChange: (value: string) => void;
  onEditTextChange: (value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onArchiveDocument: (document: SavedDocument) => void;
  onUnarchiveDocument: (document: SavedDocument) => void;
  onMoveToTrash: (document: SavedDocument) => void;
  onRestoreDocument: (document: SavedDocument) => void;
  onDeleteForever: (document: SavedDocument) => void | Promise<void>;
}

const SECTION_COPY: Record<
  LibrarySection,
  { heading: string; emptyTitle: string; emptyText: string }
> = {
  active: {
    heading: "Saved texts",
    emptyTitle: "Your library is empty.",
    emptyText: "Return home to paste a text or upload a PDF.",
  },
  archived: {
    heading: "Archived texts",
    emptyTitle: "Nothing is archived.",
    emptyText: "Archive completed or inactive texts to keep your main library focused.",
  },
  trash: {
    heading: "Recently deleted",
    emptyTitle: "Trash is empty.",
    emptyText: "Documents moved to trash appear here until you delete them permanently.",
  },
};

export function LibraryPage({
  userEmail,
  accountLabel,
  cloudConnectionLabel,
  cloudConnectionStatus,
  isOnline,
  cloudSyncState,
  libraryStorageLabel,
  savedDocumentCount,
  activeDocumentCount,
  archivedDocumentCount,
  trashedDocumentCount,
  currentSectionDocumentCount,
  visibleDocuments,
  librarySectionRef,
  showMigrationPrompt,
  localMigrationDocumentCount,
  isMigratingLibrary,
  isLibraryLoading,
  libraryQuery,
  librarySort,
  librarySection,
  libraryError,
  editingDocumentId,
  editTitle,
  editText,
  editError,
  onNavigateHome,
  onOpenLibrary,
  onOpenAccount,
  onOpenHelp,
  onRetrySync,
  onImportLocalLibrary,
  onDismissMigration,
  onLibraryQueryChange,
  onLibrarySortChange,
  onLibrarySectionChange,
  onContinueDocument,
  onRestartDocument,
  onStartEdit,
  onEditTitleChange,
  onEditTextChange,
  onSaveEdit,
  onCancelEdit,
  onArchiveDocument,
  onUnarchiveDocument,
  onMoveToTrash,
  onRestoreDocument,
  onDeleteForever,
}: LibraryPageProps) {
  const hasUser = Boolean(userEmail);
  const showOfflineBanner =
    hasUser &&
    (!isOnline ||
      cloudSyncState === "pending" ||
      cloudSyncState === "error");
  const sectionCopy = SECTION_COPY[librarySection];

  return (
    <div className="landing-shell library-page-shell">
      <AppHeader
        activePage="library"
        savedDocumentCount={savedDocumentCount}
        userEmail={userEmail}
        accountLabel={accountLabel}
        cloudConnectionLabel={cloudConnectionLabel}
        cloudConnectionStatus={cloudConnectionStatus}
        isOnline={isOnline}
        onNavigateHome={onNavigateHome}
        onOpenLibrary={onOpenLibrary}
        onOpenAccount={onOpenAccount}
        onOpenHelp={onOpenHelp}
      />

      <main className="library-page-main">
        <section className="library-page-intro">
          <span className="eyebrow">
            {hasUser ? "Synced to your account" : "Saved on this device"}
          </span>
          <h1>Your {hasUser ? "cloud" : "local"} library</h1>
          <p>
            {hasUser
              ? "Edit, organize and continue your documents across signed-in devices."
              : "Edit, organize and continue saved texts without creating an account."}
          </p>
        </section>

        {showOfflineBanner && (
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
                  ? "You can keep reading, edit, archive and restore documents. Everything will synchronize automatically when the connection returns."
                  : "The application will retry automatically. You can continue using the library while it waits for Supabase."}
              </p>
            </div>

            {isOnline && (
              <button
                type="button"
                onClick={onRetrySync}
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
              <h2 id="library-heading">{sectionCopy.heading}</h2>
            </div>

            <span className="library-count">
              {currentSectionDocumentCount}{" "}
              {currentSectionDocumentCount === 1 ? "document" : "documents"}
            </span>
          </div>

          <div className="library-section-tabs" role="tablist" aria-label="Library sections">
            <button
              type="button"
              role="tab"
              aria-selected={librarySection === "active"}
              className={librarySection === "active" ? "active" : ""}
              onClick={() => onLibrarySectionChange("active")}
            >
              Reading <span>{activeDocumentCount}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={librarySection === "archived"}
              className={librarySection === "archived" ? "active" : ""}
              onClick={() => onLibrarySectionChange("archived")}
            >
              Archived <span>{archivedDocumentCount}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={librarySection === "trash"}
              className={librarySection === "trash" ? "active" : ""}
              onClick={() => onLibrarySectionChange("trash")}
            >
              Trash <span>{trashedDocumentCount}</span>
            </button>
          </div>

          {librarySection === "trash" && trashedDocumentCount > 0 && (
            <p className="trash-explanation">
              Restore documents to return them to Reading. “Delete forever” cannot be undone.
            </p>
          )}

          {hasUser && showMigrationPrompt && (
            <div className="migration-banner">
              <div>
                <span className="migration-kicker">Local library found</span>
                <strong>Import your saved local texts to this account?</strong>
                <p>
                  This copies {localMigrationDocumentCount}{" "}
                  {localMigrationDocumentCount === 1 ? "document" : "documents"}{" "}
                  to your cloud library. Your local backup is kept on this device.
                </p>
              </div>

              <div className="migration-actions">
                <button
                  className="migration-primary-button"
                  type="button"
                  onClick={onImportLocalLibrary}
                  disabled={isMigratingLibrary}
                >
                  {isMigratingLibrary ? "Importing…" : "Import local library"}
                </button>
                <button
                  type="button"
                  onClick={onDismissMigration}
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
          ) : (
            currentSectionDocumentCount > 0 && (
              <div className="library-toolbar">
                <label className="library-search-field">
                  <span>Search</span>
                  <input
                    type="search"
                    value={libraryQuery}
                    onChange={(event) => onLibraryQueryChange(event.target.value)}
                    placeholder={`Search ${librarySection === "trash" ? "trash" : "saved texts"}`}
                  />
                </label>

                <label className="library-sort-field">
                  <span>Sort by</span>
                  <select
                    value={librarySort}
                    onChange={(event) =>
                      onLibrarySortChange(event.target.value as LibrarySort)
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
            )
          )}

          {libraryError && (
            <p className="library-error" role="alert">
              {libraryError}
            </p>
          )}

          {!isLibraryLoading &&
            (currentSectionDocumentCount === 0 ? (
              <div className="empty-library">
                <strong>{sectionCopy.emptyTitle}</strong>
                <span>{sectionCopy.emptyText}</span>
                {librarySection === "active" && (
                  <button type="button" onClick={onNavigateHome}>
                    Add your first text
                  </button>
                )}
              </div>
            ) : visibleDocuments.length === 0 ? (
              <div className="empty-library search-empty-state">
                <strong>No document matches your search.</strong>
                <span>Try another title, phrase or clear the search field.</span>
                <button type="button" onClick={() => onLibraryQueryChange("")}>
                  Clear search
                </button>
              </div>
            ) : (
              <div className="document-grid">
                {visibleDocuments.map((document) => (
                  <DocumentCard
                    key={document.id}
                    document={document}
                    section={librarySection}
                    onContinue={onContinueDocument}
                    onRestart={onRestartDocument}
                    onEdit={onStartEdit}
                    onArchive={onArchiveDocument}
                    onUnarchive={onUnarchiveDocument}
                    onMoveToTrash={onMoveToTrash}
                    onRestore={onRestoreDocument}
                    onDeleteForever={onDeleteForever}
                  />
                ))}
              </div>
            ))}
        </section>
      </main>

      <DocumentEditorDialog
        isOpen={Boolean(editingDocumentId)}
        title={editTitle}
        text={editText}
        error={editError}
        onTitleChange={onEditTitleChange}
        onTextChange={onEditTextChange}
        onSave={onSaveEdit}
        onClose={onCancelEdit}
      />
    </div>
  );
}
