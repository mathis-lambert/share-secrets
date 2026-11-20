import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

/**
 * Builds the agent client into dist/agent/share.mjs: one self-contained ES
 * module, readable (not minified) so an agent can review it before running it.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  publicDir: false,
  build: {
    outDir: "dist/agent",
    emptyOutDir: false,
    target: "node20",
    minify: false,
    lib: {
      entry: fileURLToPath(new URL("./src/agent/cli.ts", import.meta.url)),
      formats: ["es"],
      fileName: () => "share.mjs",
    },
    rollupOptions: {
      external: [/^node:/],
      output: { banner: "#!/usr/bin/env node" },
    },
  },
});
