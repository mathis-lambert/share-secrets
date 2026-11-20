import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    target: "es2022",
    // Keep every asset a file: the CSP forbids inline scripts and styles.
    assetsInlineLimit: 0,
    sourcemap: false,
  },
  server: {
    proxy: { "/api": "http://127.0.0.1:8080" },
  },
  test: {
    environment: "node",
  },
});
