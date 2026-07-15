import { useEffect } from "react";
import { Link } from "react-router";
import { AppHeader } from "../components/layout/AppHeader";
import { InfoNavigation } from "../components/layout/InfoNavigation";
import { SiteFooter } from "../components/layout/SiteFooter";
import {
  getSupportMailto,
  siteConfig,
} from "../config/site";
import type { CloudConnectionStatus } from "../types/app";

export type InfoPageKind =
  | "privacy"
  | "terms"
  | "about"
  | "support";

interface InfoPageProps {
  page: InfoPageKind;
  userEmail?: string | null;
  accountLabel: string;
  cloudConnectionLabel: string | null;
  cloudConnectionStatus: CloudConnectionStatus;
  isOnline: boolean;
  savedDocumentCount: number;
  onNavigateHome: () => void;
  onOpenLibrary: () => void;
  onOpenAccount: () => void;
  onOpenHelp: () => void;
}

const PAGE_TITLES: Record<InfoPageKind, string> = {
  privacy: "Privacy Policy",
  terms: "Terms of Service",
  about: "About Fixpoint",
  support: "Support",
};

export function getInfoPageFromPath(
  pathname: string,
): InfoPageKind | null {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";

  if (normalizedPath === "/privacy") {
    return "privacy";
  }

  if (normalizedPath === "/terms") {
    return "terms";
  }

  if (normalizedPath === "/about") {
    return "about";
  }

  if (normalizedPath === "/support") {
    return "support";
  }

  return null;
}

function LegalConfigurationNotice() {
  if (
    siteConfig.hasConfiguredOperatorName &&
    siteConfig.hasConfiguredSupportEmail
  ) {
    return null;
  }

  return (
    <aside className="legal-configuration-notice" role="status">
      <strong>Launch configuration required</strong>
      <p>
        Add the operator name and public support email before publishing
        these pages. The setup instructions explain the required Vite
        environment variables.
      </p>
    </aside>
  );
}

function PrivacyContent() {
  return (
    <>
      <section>
        <h2>1. Overview</h2>
        <p>
          This policy explains how {siteConfig.operatorName} handles
          information when you use {siteConfig.name}. The reader can be
          used as a local guest application or with an optional account for
          cloud synchronization.
        </p>
      </section>

      <section>
        <h2>2. Information stored by the service</h2>
        <h3>Guest and local use</h3>
        <p>
          Documents, reading progress and reader preferences created while
          using the local library are stored in browser storage on your
          device. They are not added to the cloud library unless you sign in
          and choose to import or save them there.
        </p>

        <h3>Signed-in accounts</h3>
        <p>
          Account authentication is provided through Supabase. The service
          may store your email address, authentication metadata, document
          titles and text, word counts, reading position, speed, font size,
          natural-pause preference, archive or trash status, and creation or
          update timestamps.
        </p>

        <h3>PDF imports</h3>
        <p>
          PDF text extraction runs in your browser. The original PDF file is
          not saved by the import feature. Extracted text is saved only when
          you create a document, and its destination depends on whether you
          are using a local or cloud library.
        </p>

        <h3>Beta feedback</h3>
        <p>
          When you submit beta feedback, the service stores your feedback
          category, message, optional rating, optional contact email and the
          submission time. When you choose to include diagnostics, the report
          also contains browser and device information, the current route,
          connectivity status and library mode. It does not include document
          titles or document text.
        </p>
      </section>

      <section>
        <h2>3. How information is used</h2>
        <p>Information is used to:</p>
        <ul>
          <li>provide the reader, library and progress-saving features;</li>
          <li>authenticate accounts and synchronize cloud documents;</li>
          <li>restore offline changes when connectivity returns;</li>
          <li>review beta feedback and diagnose reported problems;</li>
          <li>respond to support or data-rights requests;</li>
          <li>protect the service and comply with legal obligations.</li>
        </ul>
        <p>
          The current application does not sell personal information, use
          document text for advertising, or use document text to train an
          artificial-intelligence model.
        </p>
      </section>

      <section>
        <h2>4. Service providers and disclosures</h2>
        <p>
          The deployed service may rely on Supabase for authentication,
          database storage and server-side functions, as well as a web
          hosting provider. These providers process information according to
          their own agreements and deployment configuration. Information may
          also be disclosed when required by law or necessary to protect the
          rights, security or integrity of users and the service.
        </p>
      </section>

      <section>
        <h2>5. Browser storage and technical data</h2>
        <p>
          Browser storage is used for local documents, offline cloud state,
          authentication sessions and installation preferences. Hosting and
          infrastructure providers may generate routine technical logs such
          as IP address, browser information, request time and error details.
          This version of the application does not include advertising
          trackers in its source code.
        </p>
      </section>

      <section>
        <h2>6. Retention and deletion</h2>
        <p>
          Local documents remain on the device until you delete them or clear
          the relevant browser storage. Cloud documents remain until you move
          them to trash and delete them permanently, or delete the account.
          Beta feedback is retained while it remains useful for product
          improvement, support and security review. Provider backups and
          security logs may remain temporarily when required for recovery,
          fraud prevention or legal compliance.
        </p>
      </section>

      <section>
        <h2>7. Your choices and rights</h2>
        <p>
          The account page allows signed-in users to export account and
          document data as JSON and request permanent account deletion.
          Depending on where you live, applicable law may also give you
          rights to request access, correction, deletion, restriction,
          objection, information about sharing, or portability.
        </p>
        <p>
          Requests can be sent through the <Link to="/support">Support</Link>{" "}
          page. Identity verification may be required before a request is
          completed.
        </p>
      </section>

      <section>
        <h2>8. Security and international processing</h2>
        <p>
          Reasonable technical and organizational safeguards should be used,
          including access controls and secure transport. No internet service
          can guarantee absolute security. Data location and international
          transfers depend on the configured hosting and Supabase project
          region.
        </p>
      </section>

      <section>
        <h2>9. Children</h2>
        <p>
          The service is not directed to children under 13. Where local law
          requires a higher minimum age for independent consent, a parent or
          guardian should authorize and supervise use.
        </p>
      </section>

      <section>
        <h2>10. Changes and contact</h2>
        <p>
          Material updates will be reflected by changing the effective date
          on this page. Questions and privacy requests can be submitted from
          the <Link to="/support">Support</Link> page.
        </p>
      </section>
    </>
  );
}

function TermsContent() {
  return (
    <>
      <section>
        <h2>1. Acceptance</h2>
        <p>
          By accessing or using {siteConfig.name}, you agree to these Terms.
          Do not use the service when you do not agree with them.
        </p>
      </section>

      <section>
        <h2>2. The service</h2>
        <p>
          {siteConfig.name} provides rapid serial visual presentation tools,
          local document storage, optional account authentication, cloud
          synchronization, PDF text extraction and related reading features.
          Features may change as the service develops.
        </p>
      </section>

      <section>
        <h2>3. Accounts</h2>
        <p>
          You are responsible for providing accurate account information,
          protecting your password and controlling access to your device.
          Notify support when you believe an account has been compromised.
        </p>
      </section>

      <section>
        <h2>4. Your documents and permissions</h2>
        <p>
          You retain ownership of text and documents you provide. You grant
          the service only the limited permission needed to store, process,
          synchronize, display and delete that content at your direction.
          You are responsible for having the rights required to upload and
          process the content.
        </p>
      </section>

      <section>
        <h2>5. Acceptable use</h2>
        <p>You must not use the service to:</p>
        <ul>
          <li>break applicable law or violate another person’s rights;</li>
          <li>upload malicious code or attempt unauthorized access;</li>
          <li>interfere with service availability or security controls;</li>
          <li>misrepresent your identity or abuse account systems;</li>
          <li>store content that you are not legally permitted to process.</li>
        </ul>
      </section>

      <section>
        <h2>6. Third-party services</h2>
        <p>
          Authentication, cloud storage and hosting may depend on third-party
          providers such as Supabase and the selected hosting platform. Their
          availability and terms may affect parts of the service.
        </p>
      </section>

      <section>
        <h2>7. Availability and changes</h2>
        <p>
          The service may be modified, suspended or discontinued. Reasonable
          efforts may be made to preserve compatibility and user access, but
          uninterrupted or error-free operation is not guaranteed. Export
          important cloud data and keep independent copies of essential
          documents.
        </p>
      </section>

      <section>
        <h2>8. Suspension and termination</h2>
        <p>
          Access may be limited or terminated when these Terms are violated,
          when required by law, or when necessary to protect users and the
          service. You may stop using the service at any time and may delete a
          signed-in account from the account page.
        </p>
      </section>

      <section>
        <h2>9. Disclaimers</h2>
        <p>
          To the extent permitted by applicable law, the service is provided
          on an “as available” basis without warranties that it will meet
          every requirement or preserve every document. The reader is a
          productivity tool and does not provide medical, educational or
          accessibility guarantees.
        </p>
      </section>

      <section>
        <h2>10. Liability</h2>
        <p>
          To the extent permitted by applicable law, the operator is not
          liable for indirect, incidental or consequential losses arising
          from service interruption, user error, device failure, third-party
          services or loss of content. Mandatory consumer rights and legal
          remedies remain unaffected.
        </p>
      </section>

      <section>
        <h2>11. Changes, law and contact</h2>
        <p>
          These Terms may be updated as the product changes. Applicable law
          and mandatory user protections continue to govern regardless of
          this wording. Questions can be submitted through the{" "}
          <Link to="/support">Support</Link> page.
        </p>
      </section>
    </>
  );
}

function AboutContent() {
  return (
    <>
      <section>
        <h2>Read one word at a time</h2>
        <p>
          {siteConfig.name} is a focused reading application built around
          rapid serial visual presentation. It displays words sequentially at
          a controlled pace so the reader can reduce eye movement and keep a
          stable visual fixation point.
        </p>
      </section>

      <section>
        <h2>Designed around user control</h2>
        <p>
          Readers can adjust speed and type size, enable natural punctuation
          pauses, navigate by keyboard, review the source text and save
          progress. Text can be pasted directly or extracted from a
          selectable-text PDF.
        </p>
      </section>

      <section>
        <h2>Local first, cloud optional</h2>
        <p>
          An account is not required for the core reader. Guest documents can
          remain in browser storage. Account holders can synchronize a cloud
          library across devices, continue reading offline and export or
          delete their account data.
        </p>
      </section>

      <section>
        <h2>Project status</h2>
        <p>
          The application is under active development. Feedback about reading
          comfort, PDF extraction, accessibility, synchronization and device
          compatibility is especially useful during beta testing.
        </p>
      </section>

      <div className="info-callout">
        <strong>Start reading</strong>
        <p>
          Paste text on the home page, upload a PDF, or open the built-in
          demonstration to test the reader without creating an account.
        </p>
        <Link className="info-primary-link" to="/">
          Open the reader
        </Link>
      </div>
    </>
  );
}

function SupportContent() {
  const supportMailto = getSupportMailto();

  return (
    <>
      <section>
        <h2>Quick troubleshooting</h2>
        <div className="support-topic-grid">
          <article>
            <h3>A PDF has no text</h3>
            <p>
              The importer requires selectable text. Image-only scans need
              OCR before they can be used in the current version.
            </p>
          </article>

          <article>
            <h3>Cloud changes are pending</h3>
            <p>
              Keep the page open after reconnecting and use Retry sync in the
              library. Offline changes remain on the device until they can be
              synchronized.
            </p>
          </article>

          <article>
            <h3>A local library disappeared</h3>
            <p>
              Confirm that you are using the same browser profile and site
              address. Private browsing, cleared site data or a different
              domain uses separate browser storage.
            </p>
          </article>

          <article>
            <h3>Keyboard controls do not respond</h3>
            <p>
              Close open dialogs and move focus away from text fields. Press
              the Help button to review the current reader shortcuts.
            </p>
          </article>
        </div>
      </section>

      <section>
        <h2>Data and account requests</h2>
        <p>
          Signed-in users can export data and permanently delete an account
          from the account page. Privacy, correction and access requests can
          also be submitted through the public support address.
        </p>
        <Link className="info-secondary-link" to="/auth">
          Open account controls
        </Link>
      </section>

      <section>
        <h2>Submit beta feedback</h2>
        <p>
          Use the feedback form for bugs, feature suggestions, PDF-import
          problems, synchronization issues and reading-comfort observations.
          Optional diagnostics never include document titles or text.
        </p>
        <Link className="info-primary-link" to="/feedback">
          Open beta feedback
        </Link>
      </section>

      <section>
        <h2>Contact support</h2>
        {supportMailto ? (
          <>
            <p>
              Send a description of the problem, the browser and device, the
              page where it happened, and the steps needed to reproduce it.
              Do not include passwords or the full text of private documents.
            </p>
            <a className="info-primary-link" href={supportMailto}>
              Email {siteConfig.supportEmail}
            </a>
          </>
        ) : (
          <div className="support-unconfigured">
            <strong>Public support email not configured</strong>
            <p>
              The operator must set VITE_SUPPORT_EMAIL before the public beta
              so users can submit support and privacy requests.
            </p>
          </div>
        )}
      </section>
    </>
  );
}

function PageContent({ page }: { page: InfoPageKind }) {
  if (page === "privacy") {
    return <PrivacyContent />;
  }

  if (page === "terms") {
    return <TermsContent />;
  }

  if (page === "about") {
    return <AboutContent />;
  }

  return <SupportContent />;
}

export function InfoPage({
  page,
  userEmail,
  accountLabel,
  cloudConnectionLabel,
  cloudConnectionStatus,
  isOnline,
  savedDocumentCount,
  onNavigateHome,
  onOpenLibrary,
  onOpenAccount,
  onOpenHelp,
}: InfoPageProps) {
  const title = PAGE_TITLES[page];
  const isLegalPage = page === "privacy" || page === "terms";

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} · ${siteConfig.name}`;

    return () => {
      document.title = previousTitle;
    };
  }, [title]);

  return (
    <div className="landing-shell info-page-shell">
      <AppHeader
        activePage="info"
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

      <main className="info-page-main">
        <InfoNavigation activePage={page} />

        <article className="info-page-article">
          <header className="info-page-heading">
            <span className="eyebrow">
              {isLegalPage ? "Legal information" : "Fixpoint"}
            </span>
            <h1>{title}</h1>
            {isLegalPage && (
              <p className="legal-effective-date">
                Effective {siteConfig.legalEffectiveDate}
              </p>
            )}
          </header>

          {isLegalPage && <LegalConfigurationNotice />}

          <PageContent page={page} />
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
