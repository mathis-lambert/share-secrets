import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/api/client";
import type { PublicConfig } from "@/api/types";

const ConfigContext = createContext<PublicConfig | null>(null);

/** Loads the server's public settings once. Children render meanwhile with null. */
export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<PublicConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .config()
      .then((c) => {
        if (cancelled) return;
        setConfig(c);
        document.title = c.siteName;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>;
}

export const useConfig = () => useContext(ConfigContext);
