import type { ReactNode } from "react";

type Tone = "neutral" | "warning" | "danger" | "success";

/** A short status message with a coloured gutter. */
export function Callout({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <p className={`callout callout-${tone}`} role={tone === "danger" ? "alert" : "status"}>
      {children}
    </p>
  );
}
