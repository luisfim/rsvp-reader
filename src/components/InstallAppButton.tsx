import { useInstallPrompt } from "../hooks/useInstallPrompt";

export function InstallAppButton() {
  const {
    canInstall,
    isInstalled,
    requestInstall,
    showIosInstructions,
    closeIosInstructions,
  } = useInstallPrompt();

  if (!canInstall || isInstalled) {
    return null;
  }

  return (
    <>
      <button
        className="install-app-button"
        type="button"
        onClick={() => void requestInstall()}
      >
        Install app
      </button>

      {showIosInstructions && (
        <div
          className="install-instructions-backdrop"
          role="presentation"
          onMouseDown={closeIosInstructions}
        >
          <section
            className="install-instructions-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-instructions-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <span className="eyebrow">Install on iPhone or iPad</span>
            <h2 id="install-instructions-title">
              Add RSVP Reader to your Home Screen
            </h2>
            <ol>
              <li>Open this page in Safari.</li>
              <li>Tap the Share button.</li>
              <li>Select “Add to Home Screen”.</li>
              <li>Tap “Add”.</li>
            </ol>
            <button
              className="install-dialog-close"
              type="button"
              onClick={closeIosInstructions}
            >
              Done
            </button>
          </section>
        </div>
      )}
    </>
  );
}
