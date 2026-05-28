import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@lxpanel/shared": fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url))
    }
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:7080"
    }
  },
  preview: {
    port: 4173
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string): string | undefined {
          if (id.includes("node_modules/react") || id.includes("node_modules/lucide-react")) {
            return "vendor";
          }
          if (id.includes("packages/shared")) {
            return "shared";
          }
          return undefined;
        }
      }
    },
    chunkSizeWarningLimit: 600
  }
});
