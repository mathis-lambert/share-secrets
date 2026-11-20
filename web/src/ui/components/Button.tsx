import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "quiet" | "danger";
  icon?: LucideIcon;
  /** Icon-only button: `label` becomes the accessible name and the tooltip. */
  label?: string;
  busy?: boolean;
}

export function Button({ variant = "primary", icon: Icon, label, busy, children, disabled, className, ...rest }: Props) {
  const iconOnly = Boolean(label) && !children;
  return (
    <button
      type="button"
      {...rest}
      className={["btn", `btn-${variant}`, iconOnly && "btn-icon", className].filter(Boolean).join(" ")}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      aria-label={iconOnly ? label : undefined}
      data-tip={iconOnly ? label : undefined}
    >
      {busy ? <span className="spinner" aria-hidden="true" /> : Icon && <Icon size={15} strokeWidth={2} aria-hidden="true" />}
      {children}
    </button>
  );
}
