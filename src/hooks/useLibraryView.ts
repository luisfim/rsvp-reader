import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";

import type { SavedDocument } from "../lib/library";
import { tokenizeText } from "../lib/reader";
import type { LibrarySection, LibrarySort } from "../types/app";

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

export function getDocumentSection(
  document: SavedDocument,
): LibrarySection {
  if (document.trashedAt) {
    return "trash";
  }

  if (document.archivedAt) {
    return "archived";
  }

  return "active";
}

function getLatestDocument(
  savedDocuments: SavedDocument[],
): SavedDocument | null {
  const activeDocuments = savedDocuments.filter(
    (document) => getDocumentSection(document) === "active",
  );

  if (activeDocuments.length === 0) {
    return null;
  }

  return activeDocuments.reduce((latest, document) =>
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
  const [librarySection, setLibrarySection] =
    useState<LibrarySection>("active");

  const [editingDocumentId, setEditingDocumentId] = useState<
    string | null
  >(null);
  const [editTitle, setEditTitle] = useState("");
  const [editText, setEditText] = useState("");
  const [editError, setEditError] = useState("");

  const librarySectionRef = useRef<HTMLElement | null>(null);

  const documentsBySection = useMemo(() => {
    const active: SavedDocument[] = [];
    const archived: SavedDocument[] = [];
    const trash: SavedDocument[] = [];

    for (const document of savedDocuments) {
      const section = getDocumentSection(document);

      if (section === "trash") {
        trash.push(document);
      } else if (section === "archived") {
        archived.push(document);
      } else {
        active.push(document);
      }
    }

    return { active, archived, trash };
  }, [savedDocuments]);

  const latestDocument = useMemo(
    () => getLatestDocument(savedDocuments),
    [savedDocuments],
  );

  const sectionDocuments = documentsBySection[librarySection];

  const visibleDocuments = useMemo(() => {
    const normalizedQuery = libraryQuery.trim().toLocaleLowerCase();

    const filteredDocuments = normalizedQuery
      ? sectionDocuments.filter((document) =>
          `${document.title} ${document.text}`
            .toLocaleLowerCase()
            .includes(normalizedQuery),
        )
      : [...sectionDocuments];

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
  }, [libraryQuery, librarySort, sectionDocuments]);

  const latestDocumentProgress = latestDocument
    ? getDocumentProgress(latestDocument) * 100
    : 0;

  const latestDocumentProgressLabel =
    latestDocumentProgress > 0 && latestDocumentProgress < 1
      ? "<1"
      : Math.round(latestDocumentProgress).toString();

  const setSection = useCallback((section: LibrarySection) => {
    setLibrarySection(section);
    setLibraryQuery("");
  }, []);

  const closeEditor = useCallback(() => {
    setEditingDocumentId(null);
    setEditTitle("");
    setEditText("");
    setEditError("");
  }, []);

  const startEditingDocument = useCallback(
    (savedDocument: SavedDocument) => {
      setEditingDocumentId(savedDocument.id);
      setEditTitle(savedDocument.title);
      setEditText(savedDocument.text);
      setEditError("");
    },
    [],
  );

  const saveEditedDocument = useCallback((): boolean => {
    if (!editingDocumentId) {
      return false;
    }

    const nextTitle = editTitle.trim();
    const nextText = editText.trim();
    const nextWords = tokenizeText(nextText);

    if (!nextTitle) {
      setEditError("Add a title before saving.");
      return false;
    }

    if (nextWords.length === 0) {
      setEditError("The document must contain at least one word.");
      return false;
    }

    const updatedAt = new Date().toISOString();

    setSavedDocuments((currentDocuments) =>
      currentDocuments.map((document) => {
        if (document.id !== editingDocumentId) {
          return document;
        }

        const nextIndex = Math.min(
          document.currentWordIndex,
          Math.max(nextWords.length - 1, 0),
        );

        return {
          ...document,
          title: nextTitle,
          text: nextText,
          wordCount: nextWords.length,
          currentWordIndex: nextIndex,
          updatedAt,
        };
      }),
    );

    if (activeDocumentId === editingDocumentId) {
      renameActiveDocument(nextTitle);
    }

    closeEditor();
    return true;
  }, [
    activeDocumentId,
    closeEditor,
    editText,
    editTitle,
    editingDocumentId,
    renameActiveDocument,
    setSavedDocuments,
  ]);

  const updateDocumentStatus = useCallback(
    (
      savedDocument: SavedDocument,
      status: Pick<SavedDocument, "archivedAt" | "trashedAt">,
    ) => {
      const updatedAt = new Date().toISOString();

      setSavedDocuments((currentDocuments) =>
        currentDocuments.map((document) =>
          document.id === savedDocument.id
            ? {
                ...document,
                ...status,
                updatedAt,
              }
            : document,
        ),
      );

      if (editingDocumentId === savedDocument.id) {
        closeEditor();
      }
    },
    [closeEditor, editingDocumentId, setSavedDocuments],
  );

  const archiveDocument = useCallback(
    (savedDocument: SavedDocument) => {
      updateDocumentStatus(savedDocument, {
        archivedAt: new Date().toISOString(),
        trashedAt: null,
      });
    },
    [updateDocumentStatus],
  );

  const unarchiveDocument = useCallback(
    (savedDocument: SavedDocument) => {
      updateDocumentStatus(savedDocument, {
        archivedAt: null,
        trashedAt: null,
      });
    },
    [updateDocumentStatus],
  );

  const moveDocumentToTrash = useCallback(
    (savedDocument: SavedDocument) => {
      updateDocumentStatus(savedDocument, {
        archivedAt: null,
        trashedAt: new Date().toISOString(),
      });
    },
    [updateDocumentStatus],
  );

  const restoreTrashedDocument = useCallback(
    (savedDocument: SavedDocument) => {
      updateDocumentStatus(savedDocument, {
        archivedAt: null,
        trashedAt: null,
      });
    },
    [updateDocumentStatus],
  );

  return {
    libraryQuery,
    setLibraryQuery,
    librarySort,
    setLibrarySort,
    librarySection,
    setLibrarySection: setSection,
    librarySectionRef,
    latestDocument,
    visibleDocuments,
    activeDocumentCount: documentsBySection.active.length,
    archivedDocumentCount: documentsBySection.archived.length,
    trashedDocumentCount: documentsBySection.trash.length,
    currentSectionDocumentCount: sectionDocuments.length,
    latestDocumentProgress,
    latestDocumentProgressLabel,
    editingDocumentId,
    editTitle,
    setEditTitle,
    editText,
    setEditText,
    editError,
    startEditingDocument,
    cancelEditingDocument: closeEditor,
    saveEditedDocument,
    archiveDocument,
    unarchiveDocument,
    moveDocumentToTrash,
    restoreTrashedDocument,
  };
}
