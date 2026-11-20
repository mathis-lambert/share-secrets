import { Eye, EyeOff, Flame, Hourglass, Plus, Unlock } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { InspectResponse } from "@/api/types";
import { errorMessage } from "@/app/errors";
import { Link } from "@/app/router";
import { t } from "@/content/strings";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { CopyButton } from "@/ui/components/CopyButton";
import { Dialog } from "@/ui/components/Dialog";
import { formatExpiry } from "@/ui/format";
import { noise, useScramble } from "@/ui/motion/useScramble";
import { useSecret } from "./useSecret";

const NOISE_LENGTH = 180;

export function RevealPage({ id }: { id: string }) {
  const { state, reveal } = useSecret(id);

  switch (state.step) {
    case "loading":
      return <div className="sheet sheet-loading" aria-busy="true" />;
    case "badLink":
      return <Dead message={t.errors.badLink} />;
    case "gone":
      return <Dead message={t.errors.notFound} />;
    case "failed": {
      const decrypt = state.error instanceof Error && state.error.message === "decrypt";
      return <Dead message={decrypt ? t.errors.decrypt : errorMessage(state.error)} />;
    }
    case "ready":
      return <Sealed id={id} info={state.info} onReveal={reveal} />;
    case "revealed":
      return <Opened id={id} text={state.text} viewsLeft={state.viewsLeft} />;
  }
}

function SheetHead({ id, right }: { id: string; right: string }) {
  return (
    <header className="sheet-head">
      <h1>{t.reveal.title}</h1>
      <span className="counter">
        <span className="tag-id">{id}</span> {right}
      </span>
    </header>
  );
}

function Sealed({ id, info, onReveal }: { id: string; info: InspectResponse; onReveal: (p?: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="workspace">
        <section className="sheet">
          <SheetHead id={id} right="aes-256-gcm" />
          <div className="editor">
            <pre className="editor-overlay sealed-text" aria-hidden="true">
              {noise(id, NOISE_LENGTH)}
            </pre>
          </div>
          <footer className="sheet-foot">
            <p className="meta">
              <span className={info.viewsLeft === 1 ? "meta-item meta-hot" : "meta-item"}>
                {info.viewsLeft === 1 ? <Flame size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
                {t.reveal.readsLeft(info.viewsLeft)}
              </span>
              <span className="meta-item">
                <Hourglass size={14} aria-hidden="true" />
                {t.reveal.expires(formatExpiry(info.expiresAt))}
              </span>
            </p>
            <div className="sheet-actions">
              <Button icon={Unlock} onClick={() => setOpen(true)}>
                {t.reveal.decrypt}
              </Button>
            </div>
          </footer>
        </section>
      </div>
      <p className="below muted">{t.reveal.help}</p>
      <ConfirmDialog open={open} info={info} onClose={() => setOpen(false)} onReveal={onReveal} />
    </>
  );
}

function ConfirmDialog({
  open,
  info,
  onClose,
  onReveal,
}: {
  open: boolean;
  info: InspectResponse;
  onClose: () => void;
  onReveal: (p?: string) => Promise<void>;
}) {
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsPassphrase = info.passphrase !== null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onReveal(needsPassphrase ? passphrase : undefined);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={t.reveal.confirmTitle}>
      <form className="stack" onSubmit={submit}>
        <Callout tone={info.viewsLeft === 1 ? "warning" : "neutral"}>
          {info.viewsLeft === 1 ? t.reveal.confirmLast : t.reveal.confirmMany(info.viewsLeft)}
        </Callout>
        {needsPassphrase && (
          <label className="field">
            <span>{t.reveal.passphrase}</span>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              autoComplete="off"
              autoFocus
            />
            <span className="hint">{t.reveal.passphraseHelp}</span>
          </label>
        )}
        {error && <Callout tone="danger">{error}</Callout>}
        <div className="dialog-actions">
          <Button variant="quiet" onClick={onClose}>
            {t.reveal.cancel}
          </Button>
          <Button type="submit" icon={Unlock} busy={busy} disabled={needsPassphrase && passphrase.length === 0}>
            {busy ? t.reveal.decrypting : t.reveal.decrypt}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function Opened({ id, text, viewsLeft }: { id: string; text: string; viewsLeft: number }) {
  const [settled, setSettled] = useState(false);
  const [hidden, setHidden] = useState(false);
  // Reverse of sealing: the ciphertext noise resolves into the plaintext.
  const shown = useScramble(noise(id, Math.min(NOISE_LENGTH, Math.max(text.length, 24))), text, true, () =>
    setSettled(true),
  );

  return (
    <>
      <div className="workspace">
        <section className="sheet">
          <SheetHead id={id} right="plaintext" />
          <div className="editor">
            {hidden ? (
              <button type="button" className="masked" onClick={() => setHidden(false)}>
                <EyeOff size={18} aria-hidden="true" />
                {t.reveal.hidden}
              </button>
            ) : (
              <pre className="editor-overlay plaintext" tabIndex={0}>
                {settled ? text : shown}
              </pre>
            )}
          </div>
          <footer className="sheet-foot">
            <p className="meta">
              {viewsLeft === 0 ? (
                <span className="meta-item meta-hot">
                  <Flame size={14} aria-hidden="true" />
                  {t.reveal.burnt}
                </span>
              ) : (
                <span className="meta-item">
                  <Eye size={14} aria-hidden="true" />
                  {t.reveal.remaining(viewsLeft)}
                </span>
              )}
            </p>
            <div className="sheet-actions">
              <Button
                variant="quiet"
                icon={hidden ? Eye : EyeOff}
                label={hidden ? t.reveal.show : t.reveal.hide}
                onClick={() => setHidden((h) => !h)}
              />
              <CopyButton value={text} />
            </div>
          </footer>
        </section>
      </div>
      <div className="below">
        <Link to="/" className="btn btn-secondary">
          <Plus size={15} aria-hidden="true" />
          {t.nav.new}
        </Link>
      </div>
    </>
  );
}

function Dead({ message }: { message: string }) {
  return (
    <div className="dead">
      <pre className="dead-code" aria-hidden="true">
        404
      </pre>
      <Callout tone="danger">{message}</Callout>
      <Link to="/" className="btn btn-secondary">
        {t.nav.new}
      </Link>
    </div>
  );
}
