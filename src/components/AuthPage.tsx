import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router";
import { useAuth } from "../auth/AuthContext";

type AuthMode = "sign-in" | "sign-up" | "forgot";

function getFriendlyEmail(userEmail: string | undefined): string {
  return userEmail?.trim() || "Signed-in reader";
}

export function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    configured,
    isLoading,
    isPasswordRecovery,
    user,
    signIn,
    signUp,
    requestPasswordReset,
    updatePassword,
    signOut,
    clearPasswordRecovery,
  } = useAuth();

  const isConfirmationRoute = location.pathname === "/auth/confirmed";
  const isResetRoute = location.pathname === "/auth/reset";

  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    setErrorMessage("");
    setStatusMessage("");

    if (isResetRoute) {
      setPassword("");
      setConfirmPassword("");
    }
  }, [isResetRoute, location.pathname]);

  const title = useMemo(() => {
    if (isResetRoute) {
      return "Choose a new password";
    }

    if (isConfirmationRoute) {
      return user ? "Email confirmed" : "Confirming your account";
    }

    if (user) {
      return "Your account";
    }

    if (mode === "sign-up") {
      return "Create your account";
    }

    if (mode === "forgot") {
      return "Reset your password";
    }

    return "Welcome back";
  }, [isConfirmationRoute, isResetRoute, mode, user]);

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setPassword("");
    setConfirmPassword("");
    setErrorMessage("");
    setStatusMessage("");
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setStatusMessage("");

    const normalizedEmail = email.trim().toLocaleLowerCase();

    if (!normalizedEmail) {
      setErrorMessage("Enter your email address.");
      return;
    }

    if (mode === "forgot") {
      setIsSubmitting(true);
      const result = await requestPasswordReset(normalizedEmail);
      setIsSubmitting(false);

      if (result.error) {
        setErrorMessage(result.error);
        return;
      }

      setStatusMessage(
        "Password reset instructions were sent. Check your inbox and spam folder.",
      );
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Use a password with at least 8 characters.");
      return;
    }

    if (mode === "sign-up" && password !== confirmPassword) {
      setErrorMessage("The passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    const result =
      mode === "sign-up"
        ? await signUp(normalizedEmail, password)
        : await signIn(normalizedEmail, password);

    setIsSubmitting(false);

    if (result.error) {
      setErrorMessage(result.error);
      return;
    }

    if (result.needsEmailConfirmation) {
      setStatusMessage(
        "Account created. Confirm your email before signing in.",
      );
      setPassword("");
      setConfirmPassword("");
      return;
    }

    navigate("/");
  }

  async function handlePasswordUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setStatusMessage("");

    if (password.length < 8) {
      setErrorMessage("Use a password with at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("The passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    const result = await updatePassword(password);
    setIsSubmitting(false);

    if (result.error) {
      setErrorMessage(result.error);
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setStatusMessage("Your password was updated successfully.");
  }

  async function handleSignOut() {
    setIsSubmitting(true);
    setErrorMessage("");

    const result = await signOut();

    setIsSubmitting(false);

    if (result.error) {
      setErrorMessage(result.error);
      return;
    }

    navigate("/");
  }

  function leaveResetFlow() {
    clearPasswordRecovery();
    navigate("/auth");
  }

  return (
    <div className="landing-shell auth-page-shell">
      <header className="site-header">
        <button
          className="brand brand-button"
          type="button"
          onClick={() => navigate("/")}
          aria-label="RSVP Reader home"
        >
          <span className="brand-mark" />
          RSVP Reader
        </button>

        <div className="header-actions">
          <button
            className="library-nav-button"
            type="button"
            onClick={() => navigate("/library")}
          >
            Library
          </button>

          <button
            className="sign-in-button"
            type="button"
            onClick={() => navigate("/")}
          >
            Home
          </button>
        </div>
      </header>

      <main className="auth-page-main">
        <section className="auth-intro">
          <span className="eyebrow">Reader account</span>
          <h1>{title}</h1>
          <p>
            Your local library continues to work without an account. This
            step adds account access; cloud document synchronization comes
            in the next database update.
          </p>
        </section>

        <section className="auth-card" aria-live="polite">
          {!configured ? (
            <div className="auth-setup-state">
              <span className="auth-card-label">Setup required</span>
              <h2>Connect Supabase</h2>
              <p>
                Add the project URL and publishable key to a local environment
                file, then restart Vite.
              </p>

              <pre>
                <code>{`VITE_SUPABASE_URL=your-project-url\nVITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key`}</code>
              </pre>

              <p className="auth-note">
                Do not place a secret or service-role key in the browser app.
              </p>
            </div>
          ) : isLoading ? (
            <div className="auth-loading-state">
              <span className="auth-spinner" aria-hidden="true" />
              <strong>Checking your session…</strong>
            </div>
          ) : isResetRoute ? (
            <form className="auth-form" onSubmit={handlePasswordUpdate}>
              <span className="auth-card-label">Password recovery</span>
              <h2>Set a new password</h2>

              {!user && !isPasswordRecovery ? (
                <div className="auth-message warning">
                  Open this page from the password-reset email. The recovery
                  session has not been detected yet.
                </div>
              ) : (
                <>
                  <label>
                    <span>New password</span>
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                  </label>

                  <label>
                    <span>Confirm new password</span>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                  </label>

                  <button
                    className="auth-submit-button"
                    type="submit"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Updating…" : "Update password"}
                  </button>
                </>
              )}

              <button
                className="auth-text-button"
                type="button"
                onClick={leaveResetFlow}
              >
                Return to sign in
              </button>
            </form>
          ) : user ? (
            <div className="account-panel">
              <span className="auth-card-label">
                {isConfirmationRoute ? "Email confirmed" : "Signed in"}
              </span>
              <h2>{getFriendlyEmail(user.email)}</h2>
              <p>
                Your account is active. Documents are still stored locally on
                this device until cloud synchronization is implemented.
              </p>

              <div className="account-details">
                <div>
                  <span>Account ID</span>
                  <strong>{user.id}</strong>
                </div>

                <div>
                  <span>Email status</span>
                  <strong>{user.email_confirmed_at ? "Confirmed" : "Pending"}</strong>
                </div>
              </div>

              {errorMessage && (
                <div className="auth-message error" role="alert">
                  {errorMessage}
                </div>
              )}

              <div className="account-actions">
                <button
                  className="auth-submit-button"
                  type="button"
                  onClick={() => navigate("/library")}
                >
                  Open local library
                </button>

                <button
                  className="auth-secondary-button"
                  type="button"
                  onClick={handleSignOut}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Signing out…" : "Sign out"}
                </button>
              </div>
            </div>
          ) : (
            <form className="auth-form" onSubmit={handleAuthSubmit}>
              <span className="auth-card-label">
                {mode === "sign-up"
                  ? "New account"
                  : mode === "forgot"
                    ? "Account recovery"
                    : "Account access"}
              </span>

              <h2>
                {mode === "sign-up"
                  ? "Sign up"
                  : mode === "forgot"
                    ? "Request a reset link"
                    : "Sign in"}
              </h2>

              {isConfirmationRoute && (
                <div className="auth-message success">
                  Your email link was opened. Sign in to continue if the session
                  was not restored automatically.
                </div>
              )}

              <label>
                <span>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  placeholder="reader@example.com"
                  required
                />
              </label>

              {mode !== "forgot" && (
                <label>
                  <span>Password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={
                      mode === "sign-up" ? "new-password" : "current-password"
                    }
                    minLength={8}
                    required
                  />
                </label>
              )}

              {mode === "sign-up" && (
                <label>
                  <span>Confirm password</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </label>
              )}

              {errorMessage && (
                <div className="auth-message error" role="alert">
                  {errorMessage}
                </div>
              )}

              {statusMessage && (
                <div className="auth-message success">{statusMessage}</div>
              )}

              <button
                className="auth-submit-button"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? "Please wait…"
                  : mode === "sign-up"
                    ? "Create account"
                    : mode === "forgot"
                      ? "Send reset link"
                      : "Sign in"}
              </button>

              <div className="auth-mode-actions">
                {mode === "sign-in" ? (
                  <>
                    <button
                      className="auth-text-button"
                      type="button"
                      onClick={() => changeMode("forgot")}
                    >
                      Forgot password?
                    </button>

                    <button
                      className="auth-text-button"
                      type="button"
                      onClick={() => changeMode("sign-up")}
                    >
                      Create an account
                    </button>
                  </>
                ) : (
                  <button
                    className="auth-text-button"
                    type="button"
                    onClick={() => changeMode("sign-in")}
                  >
                    Return to sign in
                  </button>
                )}
              </div>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
