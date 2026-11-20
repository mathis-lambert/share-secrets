/**
 * A handful of static routes: a tiny router beats a dependency.
 *
 *   /              create a secret
 *   /s/{id}#key    reveal a secret (the key never leaves the fragment)
 *   /how-it-works  documentation
 *   /legal         legal notice and privacy
 */
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { SECRET_ID } from "@/secrets/link";

export type Route =
  | { name: "create" }
  | { name: "reveal"; id: string }
  | { name: "how" }
  | { name: "legal" }
  | { name: "notFound" };

const SECRET_PATH = /^\/s\/([^/]+)\/?$/;

export function matchRoute(pathname: string): Route {
  if (pathname === "/" || pathname === "/index.html") return { name: "create" };
  if (pathname === "/how-it-works") return { name: "how" };
  if (pathname === "/legal") return { name: "legal" };
  const id = SECRET_PATH.exec(pathname)?.[1];
  if (id && SECRET_ID.test(id)) return { name: "reveal", id };
  return { name: "notFound" };
}

const NAVIGATE = "app:navigate";

export function navigate(to: string) {
  window.history.pushState(null, "", to);
  window.scrollTo(0, 0);
  window.dispatchEvent(new Event(NAVIGATE));
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => matchRoute(window.location.pathname));
  useEffect(() => {
    const update = () => setRoute(matchRoute(window.location.pathname));
    window.addEventListener("popstate", update);
    window.addEventListener(NAVIGATE, update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener(NAVIGATE, update);
    };
  }, []);
  return route;
}

export function Link({ to, className, children }: { to: string; className?: string; children: ReactNode }) {
  const current = window.location.pathname === to;
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    navigate(to);
  };
  return (
    <a href={to} className={className} onClick={onClick} aria-current={current ? "page" : undefined}>
      {children}
    </a>
  );
}
