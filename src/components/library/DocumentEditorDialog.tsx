import { useEffect, useMemo, useRef } from "react";

import { tokenizeText } from "../../lib/reader";

interface DocumentEditorDialogProps {
  isOpen: boolean;
  title: string;
  text: string;
  error: string;
  onTitleChange: (value: string) => void;
  onTextChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export function DocumentEditorDialog({
  isOpen,
  title,
  text,
  error,
  onTitleChange,
  onTextChange,
  onSave,
  onClose,
}: DocumentEditorDialogProps) {
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const wordCount = useMemo(() => tokenizeText(text).length, [text]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    titleInputRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="document-editor-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="document-editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-editor-title"
      >
        <div className="document-editor-header">
          <div>
            <span className="eyebrow">Document editor</span>
            <h2 id="document-editor-title">Edit saved text</h2>
          </div>

          <button
            className="document-editor-close"
            type="button"
            onClick={onClose}
            aria-label="Close document editor"
          >
            ×
          </button>
        </div>

        <label className="document-editor-field">
          <span>Title</span>
          <input
            ref={titleInputRef}
            type="text"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            maxLength={120}
          />
        </label>

        <label className="document-editor-field">
          <span className="document-editor-label-row">
            <span>Text</span>
            <span>{wordCount.toLocaleString("en-US")} words</span>
          </span>
          <textarea
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            spellCheck
          />
        </label>

        {error && (
          <p className="document-editor-error" role="alert">
            {error}
          </p>
        )}

        <p className="document-editor-note">
          Your saved position is preserved whenever possible. If the new
          text is shorter, progress moves to the nearest available word.
        </p>

        <div className="document-editor-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="document-editor-save"
            type="button"
            onClick={onSave}
            disabled={!title.trim() || wordCount === 0}
          >
            Save changes
          </button>
        </div>
      </section>
    </div>
  );
}
