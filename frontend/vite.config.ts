import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In development every /api request is proxied to Django, so the browser sees one origin
// (this is what lets the HttpOnly refresh cookie work). In production nginx does the same job.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": { target: process.env.VITE_PROXY_TARGET ?? "http://localhost:8000", changeOrigin: true } },
  },
  build: { sourcemap: false, chunkSizeWarningLimit: 900 },
});
