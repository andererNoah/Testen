import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiTarget = process.env.HV_API_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.HV_WEB_PORT ?? 5173),
    host: "127.0.0.1",
    // GitHub Codespaces serves forwarded ports under *.app.github.dev.
    allowedHosts: [".app.github.dev"],
    // The UI only talks to the API (architecture); the proxy avoids CORS in development.
    proxy: { "/v1": { target: apiTarget, changeOrigin: false } },
  },
  preview: { port: Number(process.env.HV_WEB_PORT ?? 4173), host: "127.0.0.1", proxy: { "/v1": { target: apiTarget } } },
  build: { sourcemap: true },
});
