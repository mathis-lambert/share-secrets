import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "@/api/client";
import type { SecretInfo } from "@/api/wire";
import { parseLinkKey } from "@/crypto/envelope";
import { keysFor, revealSecret, UndecryptableError } from "@/secrets/open";

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
      const keys = await keysFor(state.info, linkKey, passphrase);
      try {
        const { text, viewsLeft } = await revealSecret(api, id, keys);
        // Drop the key from the address bar now that it served its purpose.
        window.history.replaceState(null, "", window.location.pathname);
        setState({ step: "revealed", text, viewsLeft });
      } catch (error) {
        if (isGone(error)) setState({ step: "gone" });
        else if (error instanceof UndecryptableError) setState({ step: "undecryptable" });
        else throw error;
      }
    },
    [id, linkKey, state],
  );

  return { state, reveal };
}
