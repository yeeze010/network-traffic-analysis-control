import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dotenv from "dotenv";
import { resolve } from "node:path";

dotenv.config({ path: resolve(process.cwd(), ".env.ports") });

const webPort = Number(process.env.VITE_PORT ?? process.env.WEB_PORT ?? 5204);
const apiPort = Number(process.env.API_PORT ?? process.env.SERVER_PORT ?? 8204);
const previewPort = Number(process.env.PREVIEW_PORT ?? 6204);
const apiTarget = process.env.VITE_API_BASE_URL ?? `http://127.0.0.1:${apiPort}`;

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: webPort,
    strictPort: true,
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true
      }
    }
  },
  preview: {
    host: "127.0.0.1",
    port: previewPort,
    strictPort: true
  }
});
