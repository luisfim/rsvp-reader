import { Link } from "react-router";
import { siteConfig } from "../../config/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>
        © {new Date().getFullYear()} {siteConfig.name}
      </span>

      <nav aria-label="Information and legal pages">
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
        <Link to="/about">About</Link>
        <Link to="/support">Support</Link>
        <Link to="/feedback">Feedback</Link>
      </nav>
    </footer>
  );
}
