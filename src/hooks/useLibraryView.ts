import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";

import type { SavedDocument } from "../lib/library";
import type { LibrarySort } from "../types/app";

interface UseLibraryViewOptions {
  savedDocuments: SavedDocument[];
  setSavedDocuments: Dispatch<SetStateAction<SavedDocument[]>>;
  activeDocumentId: string | null;
  renameActiveDocument: (title: string) => void;
}

function getDocumentProgress(document: SavedDocument): number {
  if (document.wordCount <= 1) {
    return 0;
  }

  return document.currentWordIndex / (document.wordCount - 1);
}

function getLatestDocument(
  savedDocuments: SavedDocument[],
): SavedDocument | null {
  if (savedDocuments.length === 0) {
    return null;
  }

  return savedDocuments.reduce((latest, document) =>
    new Date(document.updatedAt).getTime() >
    new Date(latest.updatedAt).getTime()
      ? document
      : latest,
  );
}

export function useLibraryView({
  savedDocuments,
  setSavedDocuments,
  activeDocumentId,
  renameActiveDocument,
}: UseLibraryViewOptions) {
  const [libraryQuery, setLibraryQuery] = useState("");
  const [librarySort, setLibrarySort] =
    useState<LibrarySort>("recent");
  const [renamingDocumentId, setRenamingDocumentId] = useState<
    string | null
  >(null);
  const [renameValue, setRenameValue] = useState("");

  const librarySectionRef = useRef<HTMLElement | null>(null);

  const latestDocument = useMemo(
    () => getLatestDocument(savedDocuments),
    [savedDocuments],
  );

  const visibleDocuments = useMemo(() => {
    const normalizedQuery = libraryQuery.trim().toLocaleLowerCase();

    const filteredDocuments = normalizedQuery
      ? savedDocuments.filter((document) =>
          document.title
            .toLocaleLowerCase()
            .includes(normalizedQuery),
        )
      : [...savedDocuments];

    return filteredDocuments.sort((firstDocument, secondDocument) => {
      if (librarySort === "title") {
        return firstDocument.title.localeCompare(
          secondDocument.title,
          "en",
          { sensitivity: "base" },
        );
      }

      if (librarySort === "progress") {
        return (
          getDocumentProgress(secondDocument) -
          getDocumentProgress(firstDocument)
        );
      }

      return (
        new Date(secondDocument.updatedAt).getTime() -
        new Date(firstDocument.updatedAt).getTime()
      );
    });
  }, [libraryQuery, librarySort, savedDocuments]);

  const latestDocumentProgress = latestDocument
    ? getDocumentProgress(latestDocument) * 100
    : 0;

  const latestDocumentProgressLabel =
    latestDocumentProgress > 0 && latestDocumentProgress < 1
      ? "<1"
      : Math.round(latestDocumentProgress).toString();

  const startRenamingDocument = useCallback(
    (savedDocument: SavedDocument) => {
      setRenamingDocumentId(savedDocument.id);
      setRenameValue(savedDocument.title);
    },
    [],
  );

  const cancelRenamingDocument = useCallback(() => {
    setRenamingDocumentId(null);
    setRenameValue("");
  }, []);

  const saveRenamedDocument = useCallback(
    (savedDocument: SavedDocument) => {
      const nextTitle = renameValue.trim();

      if (!nextTitle) {
        return;
      }

      const updatedAt = new Date().toISOString();

      setSavedDocuments((currentDocuments) =>
        currentDocuments.map((document) =>
          document.id === savedDocument.id
            ? {
                ...document,
                title: nextTitle,
                updatedAt,
              }
            : document,
        ),
      );

      if (activeDocumentId === savedDocument.id) {
        renameActiveDocument(nextTitle);
      }

      setRenamingDocumentId(null);
      setRenameValue("");
    },
    [
      activeDocumentId,
      renameActiveDocument,
      renameValue,
      setSavedDocuments,
    ],
  );

  return {
    libraryQuery,
    setLibraryQuery,
    librarySort,
    setLibrarySort,
    renamingDocumentId,
    renameValue,
    setRenameValue,
    librarySectionRef,
    latestDocument,
    visibleDocuments,
    latestDocumentProgress,
    latestDocumentProgressLabel,
    startRenamingDocument,
    cancelRenamingDocument,
    saveRenamedDocument,
  };
}
