import { useEffect, useState } from "react";
import { toBase64Url } from "@/crypto/encoding";
import { seal } from "@/crypto/envelope";

export interface PayloadPreview {
  ciphertext: string;
  iv: string;
  salt: string;
  auth: string;
}

/**
 * The payload the server would receive for `text`, sealed under a throwaway
 * key, entirely locally. The real link uses a fresh key.
 */
export function useCipherPreview(text: string): PayloadPreview | null {
  const [preview, setPreview] = useState<PayloadPreview | null>(null);

  useEffect(() => {
    if (!text) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const s = await seal(text);
      if (cancelled) return;
      setPreview({
        ciphertext: toBase64Url(s.ciphertext),
        iv: toBase64Url(s.iv),
        salt: toBase64Url(s.salt),
        auth: toBase64Url(s.auth),
      });
    }, 60);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [text]);

  return preview;
}
