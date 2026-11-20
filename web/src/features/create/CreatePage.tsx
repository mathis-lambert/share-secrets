import { Binary, Lock } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import type { PublicConfig } from "@/api/types";
import { useConfig } from "@/app/config";
import { errorMessage } from "@/app/errors";
import { t } from "@/content/strings";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Dialog } from "@/ui/components/Dialog";
import { formatBytes, utf8Length } from "@/ui/format";
import { useScramble } from "@/ui/motion/useScramble";
import { OptionChips } from "./OptionChips";
import { ShareDialog } from "./ShareDialog";
import { createSecret, defaultOptions, type Options, type SharedSecret } from "./createSecret";
import { useCipherPreview } from "./useCipherPreview";

export function CreatePage() {
  const config = useConfig();
  return config ? <Workspace config={config} /> : <div className="sheet sheet-loading" aria-busy="true" />;
}

type Phase = { name: "editing" } | { name: "sealing"; secret: SharedSecret } | { name: "shared"; secret: SharedSecret };

function Workspace({ config }: { config: PublicConfig }) {
  const [text, setText] = useState("");
  const [options, setOptions] = useState<Options>(() => defaultOptions(config));
  const [phase, setPhase] = useState<Phase>({ name: "editing" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const preview = useCipherPreview(text, options);

  const sealing = phase.name === "sealing" ? phase.secret : null;
  // The signature moment: the plaintext turns into the ciphertext that was uploaded.
  const scrambled = useScramble(text, sealing?.ciphertext ?? "", sealing, () => {
    if (sealing) setPhase({ name: "shared", secret: sealing });
  });

  const size = useMemo(() => utf8Length(text), [text]);
  const tooLarge = size > config.maxSecretSize;
  const canSubmit = text.trim().length > 0 && !tooLarge && phase.name === "editing";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const secret = await createSecret(text, options);
      setPhase({ name: "sealing", secret });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setText("");
    setOptions(defaultOptions(config));
    setPhase({ name: "editing" });
  }

  return (
    <>
      <div className="workspace">
        {/* The layer underneath: what actually leaves the browser. */}
        <div className="under" aria-hidden="true">
          <span className="under-label">ciphertext</span>
          <span className="under-text">{preview?.ciphertext ?? "…"}</span>
        </div>

        <form className="sheet" onSubmit={submit}>
          <header className="sheet-head">
            <h1>{t.create.title}</h1>
            <span className={tooLarge ? "counter counter-over" : "counter"}>
              {t.create.size(formatBytes(size), formatBytes(config.maxSecretSize))}
            </span>
          </header>

          <div className="editor">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t.create.placeholder}
              aria-label={t.create.title}
              readOnly={phase.name !== "editing"}
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-invalid={tooLarge || undefined}
            />
            {phase.name !== "editing" && (
              <pre className="editor-overlay" aria-hidden="true">
                {phase.name === "sealing" ? scrambled : phase.secret.ciphertext}
              </pre>
            )}
          </div>

          <footer className="sheet-foot">
            <OptionChips config={config} value={options} onChange={setOptions} />
            <div className="sheet-actions">
              <Button variant="quiet" icon={Binary} label={t.create.inspect} onClick={() => setInspecting(true)} />
              <Button type="submit" icon={Lock} busy={busy} disabled={!canSubmit}>
                {busy ? t.create.submitting : t.create.submit}
              </Button>
            </div>
          </footer>
        </form>
      </div>

      <div className="below">
        {tooLarge && <Callout tone="danger">{t.create.tooLarge}</Callout>}
        {error && <Callout tone="danger">{error}</Callout>}
      </div>

      <Dialog open={inspecting} onClose={() => setInspecting(false)} title={t.create.inspectTitle} wide>
        <div className="stack">
          <p className="muted">{t.create.inspectHelp}</p>
          <pre className="payload">
            {preview
              ? JSON.stringify({ ...preview, passphrase: options.passphrase ? "{ salt, iterations }" : null }, null, 2)
              : t.create.inspectEmpty}
          </pre>
        </div>
      </Dialog>

      <ShareDialog secret={phase.name === "shared" ? phase.secret : null} onClose={reset} />
    </>
  );
}
