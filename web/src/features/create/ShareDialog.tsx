import { Check, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "@/api/client";
import { errorMessage } from "@/app/errors";
import { t } from "@/content/strings";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Dialog } from "@/ui/components/Dialog";
import { formatExpiry } from "@/ui/format";
import { LinkAnatomy } from "./LinkAnatomy";
import type { SharedSecret } from "./createSecret";

export function ShareDialog({ secret, onClose }: { secret: SharedSecret | null; onClose: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [destroyed, setDestroyed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setConfirming(false);
    setDestroyed(false);
    setError(null);
    onClose();
  }

  async function destroy() {
    if (!secret) return;
    setBusy(true);
    setError(null);
    try {
      await api.destroy(secret.id, secret.auth);
      setDestroyed(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <Dialog open={secret !== null} onClose={close} title={t.share.title} wide>
      {secret &&
        (destroyed ? (
          <div className="stack">
            <Callout tone="success">{t.share.destroyed}</Callout>
            <div className="row-end">
              <Button onClick={close}>{t.share.done}</Button>
            </div>
          </div>
        ) : (
          <div className="stack">
            <p className="muted">{t.share.help}</p>
            <LinkAnatomy link={secret.link} />
            <Callout>{t.share.summary(formatExpiry(secret.expiresAt), t.create.readsValue(secret.views))}</Callout>
            {secret.hasPassphrase && <Callout tone="warning">{t.share.passphraseReminder}</Callout>}
            {error && <Callout tone="danger">{error}</Callout>}
            <div className="dialog-actions">
              {confirming ? (
                <div className="confirm-inline">
                  <span>{t.share.destroyConfirm}</span>
                  <Button variant="quiet" onClick={() => setConfirming(false)}>
                    {t.share.destroyNo}
                  </Button>
                  <Button variant="danger" icon={Trash2} busy={busy} onClick={destroy}>
                    {t.share.destroyYes}
                  </Button>
                </div>
              ) : (
                <>
                  <Button variant="quiet" icon={Trash2} label={t.share.destroy} onClick={() => setConfirming(true)} />
                  <Button variant="secondary" icon={Check} onClick={close}>
                    {t.share.done}
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
    </Dialog>
  );
}
