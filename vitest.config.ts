/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Standalone Vitest config (kept separate from the app's Lovable/TanStack vite
// config, which pulls in build-only plugins that aren't needed for unit tests).
// `vite-tsconfig-paths` resolves the "@/*" alias used across the codebase.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
