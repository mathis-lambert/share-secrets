import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@/app/router";
import { t } from "@/content/strings";

/** A page with nothing to show: a big code, why, and the way back. */
export function DeadEnd({ children }: { children: ReactNode }) {
  return (
    <div className="dead">
      <pre className="dead-code" aria-hidden="true">
        404
      </pre>
      {children}
      <Link to="/" className="btn btn-secondary">
        <Plus size={15} aria-hidden="true" />
        {t.nav.new}
      </Link>
    </div>
  );
}
