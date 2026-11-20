import { useEffect, useState } from "react";
import type { CreateRequest } from "@/api/types";
import { toCreateRequest } from "@/api/wire";
import { encrypt, newKey, type SealingKey } from "@/crypto/envelope";

// One throwaway key per page: the preview only re-encrypts as the text changes.
let previewKey: Promise<SealingKey> | undefined;

/**
 * The request the server would receive for `text`, encrypted locally under a
 * throwaway key. Nothing is sent; the real link uses a fresh key.
 */
export function useCipherPreview(text: string, options: { ttl: number; views: number }): CreateRequest | null {
  const [preview, setPreview] = useState<CreateRequest | null>(null);
  const { ttl, views } = options;

  useEffect(() => {
    if (!text) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      previewKey ??= newKey();
      const sealed = await encrypt(await previewKey, text);
      if (!cancelled) setPreview(toCreateRequest(sealed, { ttl, views }));
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [text, ttl, views]);

  return preview;
}
