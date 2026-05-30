import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" so the packaged app can load assets over file:// in Electron.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  build: { outDir: "dist", emptyOutDir: true },
});
