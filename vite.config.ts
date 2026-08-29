// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    // IPv6 নেই এমন পরিবেশে ডিফল্ট `::` বাইন্ড EAFNOSUPPORT দিয়ে ব্যর্থ হয়,
    // তাই ডেভ সার্ভার সরাসরি IPv4-এ ধরা হয়।
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: false,
    },
  },
});
