import { InstallAppButton } from "../InstallAppButton";
import type { CloudConnectionStatus } from "../../types/app";

interface AppHeaderProps {
  activePage: "home" | "library";
  savedDocumentCount: number;
  userEmail?: string | null;
  accountLabel: string;
  cloudConnectionLabel: string | null;
  cloudConnectionStatus: CloudConnectionStatus;
  isOnline: boolean;
  onNavigateHome: () => void;
  onOpenLibrary: () => void;
  onOpenAccount: () => void;
  onOpenHelp: () => void;
}

export function AppHeader({
  activePage,
  savedDocumentCount,
  userEmail,
  accountLabel,
  cloudConnectionLabel,
  cloudConnectionStatus,
  isOnline,
  onNavigateHome,
  onOpenLibrary,
  onOpenAccount,
  onOpenHelp,
}: AppHeaderProps) {
  return (
    <header className="site-header">
      <button
        className="brand brand-button"
        type="button"
        onClick={onNavigateHome}
        aria-label="RSVP Reader home"
      >
        <span className="brand-mark" />
        RSVP Reader
      </button>

      <div className="header-actions">
        <button
          className={
            activePage === "library"
              ? "library-nav-button active"
              : "library-nav-button"
          }
          type="button"
          onClick={
            activePage === "library" ? onNavigateHome : onOpenLibrary
          }
          aria-controls={
            activePage === "home" ? "local-library" : undefined
          }
        >
          {activePage === "library" ? (
            "Home"
          ) : (
            <>
              Library
              <span className="library-nav-count">
                {savedDocumentCount}
              </span>
            </>
          )}
        </button>

        {userEmail && cloudConnectionLabel && (
          <span
            className={`cloud-connection-badge ${cloudConnectionStatus}`}
            title={
              isOnline
                ? "Your cloud library will synchronize automatically."
                : "Changes are saved on this device and will synchronize when the connection returns."
            }
          >
            <span className="cloud-connection-dot" />
            {cloudConnectionLabel}
          </span>
        )}

        <InstallAppButton />

        <button
          className="header-help-button"
          type="button"
          onClick={onOpenHelp}
          aria-label="Open help and keyboard shortcuts"
          title="Help and keyboard shortcuts"
        >
          <span aria-hidden="true">?</span>
          <span className="header-help-label">Help</span>
        </button>

        <button
          className="sign-in-button account-button"
          type="button"
          onClick={onOpenAccount}
          title={userEmail || "Sign in or create an account"}
        >
          <span>{accountLabel}</span>
        </button>
      </div>
    </header>
  );
}
