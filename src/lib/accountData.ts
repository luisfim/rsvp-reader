import type { SavedDocument } from "./library";
import type { LibraryMode } from "../types/app";

export interface AccountExportIdentity {
  id: string;
  email: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
}

export interface AccountDataExport {
  format: "rsvp-reader-account-export";
  version: 1;
  exportedAt: string;
  libraryMode: LibraryMode;
  account: AccountExportIdentity;
  documents: SavedDocument[];
}

interface CreateAccountDataExportOptions {
  account: AccountExportIdentity;
  documents: SavedDocument[];
  libraryMode: LibraryMode;
  exportedAt?: string;
}

export function createAccountDataExport({
  account,
  documents,
  libraryMode,
  exportedAt = new Date().toISOString(),
}: CreateAccountDataExportOptions): AccountDataExport {
  return {
    format: "rsvp-reader-account-export",
    version: 1,
    exportedAt,
    libraryMode,
    account,
    documents: documents.map((document) => ({ ...document })),
  };
}

export function serializeAccountDataExport(
  dataExport: AccountDataExport,
): string {
  return JSON.stringify(dataExport, null, 2);
}

function sanitizeFilenamePart(value: string): string {
  const sanitizedValue = value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return sanitizedValue || "reader";
}

export function createAccountExportFilename(
  email: string | null,
  exportedAt = new Date().toISOString(),
): string {
  const datePart = exportedAt.slice(0, 10);
  const accountPart = sanitizeFilenamePart(email ?? "reader");

  return `rsvp-reader-${accountPart}-${datePart}.json`;
}

export function downloadAccountDataExport(
  dataExport: AccountDataExport,
): void {
  if (typeof document === "undefined") {
    return;
  }

  const blob = new Blob([serializeAccountDataExport(dataExport)], {
    type: "application/json;charset=utf-8",
  });
  const objectUrl = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");

  downloadLink.href = objectUrl;
  downloadLink.download = createAccountExportFilename(
    dataExport.account.email,
    dataExport.exportedAt,
  );
  downloadLink.hidden = true;

  document.body.append(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  URL.revokeObjectURL(objectUrl);
}
