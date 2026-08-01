import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import pkg from "./package.json";

export default defineConfig(({ mode }) => ({
  // Relative paths so Pages subpaths and local previews work.
  base: "./",
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: mode === "singlefile" ? [viteSingleFile()] : [],
  build: {
    outDir: mode === "singlefile" ? "dist-release" : "dist",
    emptyOutDir: true,
  },
}));
