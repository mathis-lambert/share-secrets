import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "@/api/client";
import type { SecretInfo } from "@/api/wire";
import { deriveKeys, open, parseLinkKey } from "@/crypto/envelope";

export type RevealState =
  | { step: "loading" }
  | { step: "badLink" }
  | { step: "gone" }
  | { step: "ready"; info: SecretInfo }
  | { step: "revealed"; text: string; viewsLeft: number }
  /** The server accepted the key but the ciphertext does not decrypt. */
  | { step: "undecryptable" }
  | { step: "failed"; error: unknown };

const isGone = (error: unknown) => error instanceof ApiError && error.code === "not_found";

/**
 * Drives the recipient side: inspect (consumes nothing), then on demand
 * derive the keys, prove them to the server, and decrypt locally.
 */
export function useSecret(id: string) {
  // Read once: the fragment is cleared after a successful reveal.
  const [linkKey] = useState(() => parseLinkKey(window.location.hash));
  const [state, setState] = useState<RevealState>({ step: "loading" });

  useEffect(() => {
    if (!linkKey) {
      setState({ step: "badLink" });
      return;
    }
    let cancelled = false;
    api.inspect(id).then(
      (info) => !cancelled && setState({ step: "ready", info }),
      (error) => !cancelled && setState(isGone(error) ? { step: "gone" } : { step: "failed", error }),
    );
    return () => {
      cancelled = true;
    };
  }, [id, linkKey]);

  /** Resolves on success; throws ApiError (e.g. wrong_key) so the form can show it. */
  const reveal = useCallback(
    async (passphrase?: string) => {
      if (state.step !== "ready" || !linkKey) return;
      const { info } = state;
      const stretched = info.passphrase ? { value: passphrase ?? "", params: info.passphrase } : undefined;
      const keys = await deriveKeys(linkKey, info.salt, stretched);
      let out;
      try {
        out = await api.reveal(id, keys.auth);
      } catch (error) {
        if (!isGone(error)) throw error;
        setState({ step: "gone" });
        return;
      }
      try {
        const text = await open(keys.encKey, out.ciphertext, out.iv);
        // Drop the key from the address bar now that it served its purpose.
        window.history.replaceState(null, "", window.location.pathname);
        setState({ step: "revealed", text, viewsLeft: out.viewsLeft });
      } catch {
        setState({ step: "undecryptable" });
      }
    },
    [id, linkKey, state],
  );

  return { state, reveal };
}
