import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

interface Props {
  /** Label of the setting, e.g. "Expires": tooltip and accessible name. */
  label: string;
  icon: LucideIcon;
  /** Current value, shown on the trigger. */
  value: string;
  /** Highlights the trigger when the setting differs from the default. */
  active?: boolean;
  children: (close: () => void) => ReactNode;
}

/** A setting chip that opens a small panel anchored below it. */
export function Popover({ label, icon: Icon, value, active, children }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="popover" ref={root}>
      <button
        type="button"
        className={active ? "chip chip-active" : "chip"}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        aria-label={`${label}: ${value}`}
        data-tip={open ? undefined : label}
      >
        <Icon size={14} aria-hidden="true" />
        <span className="chip-value">{value}</span>
      </button>
      {open && (
        <div className="popover-panel" id={id} role="dialog" aria-label={label}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

/** A list of mutually exclusive choices inside a popover. */
export function ChoiceList<T extends string | number>({
  options,
  value,
  format,
  onPick,
}: {
  options: T[];
  value: T;
  format: (v: T) => string;
  onPick: (v: T) => void;
}) {
  return (
    <ul className="choices" role="listbox">
      {options.map((o) => (
        <li key={o}>
          <button type="button" role="option" aria-selected={o === value} onClick={() => onPick(o)}>
            {format(o)}
            {o === value && <Check size={14} aria-hidden="true" />}
          </button>
        </li>
      ))}
    </ul>
  );
}
