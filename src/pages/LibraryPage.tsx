import type { RefObject } from "react";

import type { SavedDocument } from "../lib/library";
import type {
  CloudConnectionStatus,
  CloudSyncState,
  LibrarySort,
} from "../types/app";
import { AppHeader } from "../components/layout/AppHeader";
import { DocumentCard } from "../components/library/DocumentCard";

interface LibraryPageProps {
  userEmail?: string | null;
  accountLabel: string;
  cloudConnectionLabel: string | null;
  cloudConnectionStatus: CloudConnectionStatus;
  isOnline: boolean;
  cloudSyncState: CloudSyncState;
  libraryStorageLabel: string;
  savedDocuments: SavedDocument[];
  visibleDocuments: SavedDocument[];
  librarySectionRef: RefObject<HTMLElement | null>;
  showMigrationPrompt: boolean;
  localMigrationDocumentCount: number;
  isMigratingLibrary: boolean;
  isLibraryLoading: boolean;
  libraryQuery: string;
  librarySort: LibrarySort;
  libraryError: string;
  renamingDocumentId: string | null;
  renameValue: string;
  onNavigateHome: () => void;
  onOpenLibrary: () => void;
  onOpenAccount: () => void;
  onRetrySync: () => void;
  onImportLocalLibrary: () => void;
  onDismissMigration: () => void;
  onLibraryQueryChange: (value: string) => void;
  onLibrarySortChange: (value: LibrarySort) => void;
  onContinueDocument: (document: SavedDocument) => void;
  onRestartDocument: (document: SavedDocument) => void;
  onStartRename: (document: SavedDocument) => void;
  onRenameValueChange: (value: string) => void;
  onSaveRename: (document: SavedDocument) => void;
  onCancelRename: () => void;
  onDeleteDocument: (document: SavedDocument) => void | Promise<void>;
}

export function LibraryPage({
  userEmail,
  accountLabel,
  cloudConnectionLabel,
  cloudConnectionStatus,
  isOnline,
  cloudSyncState,
  libraryStorageLabel,
  savedDocuments,
  visibleDocuments,
  librarySectionRef,
  showMigrationPrompt,
  localMigrationDocumentCount,
  isMigratingLibrary,
  isLibraryLoading,
  libraryQuery,
  librarySort,
  libraryError,
  renamingDocumentId,
  renameValue,
  onNavigateHome,
  onOpenLibrary,
  onOpenAccount,
  onRetrySync,
  onImportLocalLibrary,
  onDismissMigration,
  onLibraryQueryChange,
  onLibrarySortChange,
  onContinueDocument,
  onRestartDocument,
  onStartRename,
  onRenameValueChange,
  onSaveRename,
  onCancelRename,
  onDeleteDocument,
}: LibraryPageProps) {
  const hasUser = Boolean(userEmail);
  const showOfflineBanner =
    hasUser &&
    (!isOnline ||
      cloudSyncState === "pending" ||
      cloudSyncState === "error");

  return (
    <div className="landing-shell library-page-shell">
      <AppHeader
        activePage="library"
        savedDocumentCount={savedDocuments.length}
        userEmail={userEmail}
        accountLabel={accountLabel}
        cloudConnectionLabel={cloudConnectionLabel}
        cloudConnectionStatus={cloudConnectionStatus}
        isOnline={isOnline}
        onNavigateHome={onNavigateHome}
        onOpenLibrary={onOpenLibrary}
        onOpenAccount={onOpenAccount}
      />

      <main className="library-page-main">
        <section className="library-page-intro">
          <span className="eyebrow">
            {hasUser ? "Synced to your account" : "Saved on this device"}
          </span>
          <h1>Your {hasUser ? "cloud" : "local"} library</h1>
          <p>
            {hasUser
              ? "Your documents and progress are available whenever you sign in on another device."
              : "Continue saved texts, search your collection and manage reading progress without signing in."}
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
                  ? "You can keep reading, create documents, rename them and update progress. Everything will synchronize automatically when the connection returns."
                  : "The application will retry automatically. You can continue reading while it waits for Supabase to become available."}
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
              <h2 id="library-heading">Saved texts</h2>
            </div>

            <span className="library-count">
              {savedDocuments.length}{" "}
              {savedDocuments.length === 1 ? "document" : "documents"}
            </span>
          </div>

          {hasUser && showMigrationPrompt && (
            <div className="migration-banner">
              <div>
                <span className="migration-kicker">Local library found</span>
                <strong>
                  Import your saved local texts to this account?
                </strong>
                <p>
                  This copies {localMigrationDocumentCount}{" "}
                  {localMigrationDocumentCount === 1
                    ? "document"
                    : "documents"}{" "}
                  to your cloud library. Your local backup is kept on this
                  device.
                </p>
              </div>

              <div className="migration-actions">
                <button
                  className="migration-primary-button"
                  type="button"
                  onClick={onImportLocalLibrary}
                  disabled={isMigratingLibrary}
                >
                  {isMigratingLibrary
                    ? "Importing…"
                    : "Import local library"}
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
              <span
                className="library-loading-spinner"
                aria-hidden="true"
              />
              <strong>Loading your cloud library…</strong>
            </div>
          ) : (
            savedDocuments.length > 0 && (
              <div className="library-toolbar">
                <label className="library-search-field">
                  <span>Search</span>
                  <input
                    type="search"
                    value={libraryQuery}
                    onChange={(event) =>
                      onLibraryQueryChange(event.target.value)
                    }
                    placeholder="Search saved texts"
                  />
                </label>

                <label className="library-sort-field">
                  <span>Sort by</span>
                  <select
                    value={librarySort}
                    onChange={(event) =>
                      onLibrarySortChange(
                        event.target.value as LibrarySort,
                      )
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
            (savedDocuments.length === 0 ? (
              <div className="empty-library">
                <strong>
                  Your {hasUser ? "cloud" : "local"} library is empty.
                </strong>
                <span>Return home to paste a text or upload a PDF.</span>
                <button type="button" onClick={onNavigateHome}>
                  Add your first text
                </button>
              </div>
            ) : visibleDocuments.length === 0 ? (
              <div className="empty-library search-empty-state">
                <strong>No saved text matches your search.</strong>
                <span>
                  Try a different title or clear the search field.
                </span>
                <button
                  type="button"
                  onClick={() => onLibraryQueryChange("")}
                >
                  Clear search
                </button>
              </div>
            ) : (
              <div className="document-grid">
                {visibleDocuments.map((document) => (
                  <DocumentCard
                    key={document.id}
                    document={document}
                    isRenaming={renamingDocumentId === document.id}
                    renameValue={renameValue}
                    onRenameValueChange={onRenameValueChange}
                    onContinue={onContinueDocument}
                    onRestart={onRestartDocument}
                    onStartRename={onStartRename}
                    onSaveRename={onSaveRename}
                    onCancelRename={onCancelRename}
                    onDelete={onDeleteDocument}
                  />
                ))}
              </div>
            ))}
        </section>
      </main>
    </div>
  );
}
