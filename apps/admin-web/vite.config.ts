import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  server: {
    port:       5173,
    strictPort: false,
    open:       false,
    // Proxy all /v1 requests to the API server so the browser sees them as
    // same-origin. This avoids CORP / COEP cross-origin blocking for images
    // and ensures multipart uploads share the same origin as the page.
    proxy: {
      "/v1": {
        target:      "http://localhost:3000",
        changeOrigin: true,
        secure:      false,
      },
    },
  },

  build: {
    outDir:    "dist",
    sourcemap: false,
    /* Optimizaciones de bundle */
    target:           "es2020",
    cssCodeSplit:     true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          /* Core React — siempre en caché */
          "vendor-react":  ["react", "react-dom", "react-router-dom"],
          /* State / Data */
          "vendor-query":  ["@tanstack/react-query"],
          /* Radix UI — se actualiza poco */
          "vendor-radix": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-select",
            "@radix-ui/react-dropdown-menu",
          ],
          /* Forms */
          "vendor-forms": ["react-hook-form", "@hookform/resolvers", "zod"],
          /* Icons — grande, separado */
          "vendor-icons": ["lucide-react"],
        },
      },
    },
  },

  css: {
    postcss: "./postcss.config.cjs",
  },

  /* Prefetch de chunks en navegación */
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@tanstack/react-query",
      "lucide-react",
    ],
  },
});
