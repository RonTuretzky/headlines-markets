import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// VITE_BASE lets GitHub Pages serve the app under a repo subpath
// (e.g. "/means-of-prediction/"). HashRouter handles client-side routing, so no
// server rewrites are needed for a static host.
export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  plugins: [react(), tailwindcss()],
  server: {
    port: 5199,
  },
});
