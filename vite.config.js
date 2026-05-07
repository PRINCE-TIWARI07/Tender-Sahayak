import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  publicDir: false,
  build: {
    outDir: "dist",
    emptyOutDir: true
  },
  server: {
    proxy: {
      "/audit-report": "http://127.0.0.1:3000",
      "/pipeline": "http://127.0.0.1:3000",
      "/upload": "http://127.0.0.1:3000",
      "/evaluate": "http://127.0.0.1:3000",
      "/health": "http://127.0.0.1:3000"
    }
  }
});
