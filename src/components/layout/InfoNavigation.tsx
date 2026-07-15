import { Link } from "react-router";

export type InformationRoute =
  | "privacy"
  | "terms"
  | "about"
  | "support"
  | "feedback";

interface InfoNavigationProps {
  activePage: InformationRoute;
}

const INFORMATION_LINKS: Array<{
  page: InformationRoute;
  label: string;
  to: string;
}> = [
  { page: "privacy", label: "Privacy", to: "/privacy" },
  { page: "terms", label: "Terms", to: "/terms" },
  { page: "about", label: "About", to: "/about" },
  { page: "support", label: "Support", to: "/support" },
  { page: "feedback", label: "Feedback", to: "/feedback" },
];

export function InfoNavigation({ activePage }: InfoNavigationProps) {
  return (
    <aside className="info-page-navigation" aria-label="Information pages">
      <span className="eyebrow">Information</span>
      <nav>
        {INFORMATION_LINKS.map((link) => (
          <Link
            key={link.page}
            className={activePage === link.page ? "active" : ""}
            to={link.to}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
