import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiTarget = process.env.HV_API_URL ?? "http://127.0.0.1:3000";
// The Codespaces port forwarder may connect via IPv4 or IPv6, so listen on all interfaces there.
// Locally the dev server stays on the loopback interface.
const host = process.env.CODESPACES === "true" ? true : "127.0.0.1";

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.HV_WEB_PORT ?? 5173),
    // Port forwarding expects exactly this port; fail instead of silently moving to the next one.
    strictPort: true,
    host,
    // GitHub Codespaces serves forwarded ports under *.app.github.dev.
    allowedHosts: [".app.github.dev"],
    // The UI only talks to the API (architecture); the proxy avoids CORS in development.
    proxy: { "/v1": { target: apiTarget, changeOrigin: false } },
  },
  preview: { port: Number(process.env.HV_WEB_PORT ?? 4173), host, proxy: { "/v1": { target: apiTarget } } },
  build: { sourcemap: true },
});
