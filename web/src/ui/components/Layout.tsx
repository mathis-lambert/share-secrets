import { BookOpen, Scale, ShieldCheck } from "lucide-react";
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
        <Link to="/legal" className="nav-link">
          <Scale size={14} aria-hidden="true" />
          {t.nav.legal}
        </Link>
      </footer>
    </div>
  );
}
