import { BookOpen, Bot, GitFork, Scale, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useConfig } from "@/app/config";
import { Link } from "@/app/router";
import { t } from "@/content/strings";

export function Layout({ children }: { children: ReactNode }) {
  const config = useConfig();

  return (
    <div className="shell">
      <header className="header">
        <Link to="/" className="brand">
          <span className="brand-glyph" aria-hidden="true">
            {"{#}"}
          </span>
          {config?.siteName ?? "Share Secrets"}
        </Link>
        <nav className="nav">
          <Link to="/how-it-works" className="nav-link">
            <BookOpen size={15} aria-hidden="true" />
            <span>{t.nav.how}</span>
          </Link>
        </nav>
      </header>
      <main className="main">{children}</main>
      <footer className="footer">
        <span className="footer-note">
          <ShieldCheck size={14} aria-hidden="true" />
          {t.footer}
        </span>
        <span className="footer-links">
          <a href={t.source} className="nav-link" target="_blank" rel="noopener noreferrer">
            <GitFork size={14} aria-hidden="true" />
            {t.nav.source}
          </a>
          {/* A plain file, not a page of the app. */}
          <a href="/llms.txt" className="nav-link">
            <Bot size={14} aria-hidden="true" />
            {t.nav.agents}
          </a>
          <Link to="/legal" className="nav-link">
            <Scale size={14} aria-hidden="true" />
            {t.nav.legal}
          </Link>
        </span>
      </footer>
    </div>
  );
}
