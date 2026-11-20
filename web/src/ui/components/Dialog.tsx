import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Wider layout for content-heavy dialogs. */
  wide?: boolean;
}

/**
 * A modal built on the native <dialog>: focus trapping, Escape and the top
 * layer come from the browser. A click on the backdrop closes it.
 */
export function Dialog({ open, onClose, title, children, wide }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={wide ? "dialog dialog-wide" : "dialog"}
      aria-labelledby="dialog-title"
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-body">
        <header className="dialog-head">
          <h2 id="dialog-title">{title}</h2>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="Close" data-tip="Close (esc)">
            <X size={16} aria-hidden="true" />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
