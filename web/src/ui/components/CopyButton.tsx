import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { t } from "@/content/strings";
import { Button } from "./Button";

/** Copies `value` to the clipboard, with brief feedback. */
export function CopyButton({ value, variant = "primary" }: { value: string; variant?: "primary" | "secondary" }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard denied: the value stays selectable for a manual copy.
    }
  }

  return (
    <Button variant={copied ? "secondary" : variant} icon={copied ? Check : Copy} onClick={copy} aria-live="polite">
      {copied ? t.copy.copied : t.copy.copy}
    </Button>
  );
}
