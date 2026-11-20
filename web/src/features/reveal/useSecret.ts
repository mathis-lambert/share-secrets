import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "@/api/client";
import type { InspectResponse } from "@/api/types";
import { fromBase64Url, toBase64Url } from "@/crypto/encoding";
import { deriveKeys, open, parseLinkKey } from "@/crypto/envelope";

export type RevealState =
  | { step: "loading" }
  | { step: "badLink" }
  | { step: "gone" }
  | { step: "ready"; info: InspectResponse }
  | { step: "revealed"; text: string; viewsLeft: number }
  | { step: "failed"; error: unknown };

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
      (error) => {
        if (cancelled) return;
        setState(error instanceof ApiError && error.code === "not_found" ? { step: "gone" } : { step: "failed", error });
      },
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
      const params = info.passphrase && {
        salt: fromBase64Url(info.passphrase.salt),
        iterations: info.passphrase.iterations,
      };
      const keys = await deriveKeys(
        linkKey,
        fromBase64Url(info.salt),
        params && passphrase !== undefined ? { value: passphrase, params } : undefined,
      );
      let out;
      try {
        out = await api.reveal(id, toBase64Url(keys.auth));
      } catch (error) {
        if (error instanceof ApiError && error.code === "not_found") {
          setState({ step: "gone" });
          return;
        }
        throw error;
      }
      try {
        const text = await open(keys.encKey, fromBase64Url(out.ciphertext), fromBase64Url(out.iv));
        // Drop the key from the address bar now that it served its purpose.
        window.history.replaceState(null, "", window.location.pathname);
        setState({ step: "revealed", text, viewsLeft: out.viewsLeft });
      } catch {
        setState({ step: "failed", error: new Error("decrypt") });
      }
    },
    [id, linkKey, state],
  );

  return { state, reveal };
}
