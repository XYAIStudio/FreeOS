import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig(({ mode }) => {
  const freeosOrganization =
    mode === "freeos" ||
    loadEnv(mode, process.cwd(), "").VITE_FREEOS_ORG_INTEGRATED === "true";
  return {
    // The complete organization application is published beneath the FreeOS
    // origin.  Keep this build-time so asset URLs also work on deep links.
    base: freeosOrganization ? "/organization-app/" : "/",
    define: freeosOrganization
      ? { "import.meta.env.VITE_FREEOS_ORG_INTEGRATED": JSON.stringify("true") }
      : {},
    envDir: "..",
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        manifest: {
          name: "openXYOS · 开源人机组织操作系统",
          short_name: "openXYOS",
          description: "面向人机共融共治组织的开源操作系统",
          theme_color: "#10B981",
          background_color: "#f5f5f5",
          display: "standalone",
          icons: [
            { src: "/logo.png", sizes: "192x192", type: "image/png" },
            { src: "/logo.png", sizes: "512x512", type: "image/png" },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2}"],
          skipWaiting: true,
          clientsClaim: true,
        },
      }),
    ],
    resolve: {
      alias: { "@": path.resolve(__dirname, "./frontend/src") },
    },
    server: {
      host: "0.0.0.0",
      port: 5174,
      proxy: {
        "/api": "http://localhost:3000",
        "/ws": {
          target: "http://localhost:3000",
          ws: true,
        },
      },
    },
    root: "frontend",
    build: {
      outDir: "../dist",
      emptyOutDir: true,
      target: ["es2015", "chrome63", "safari12", "edge18"],
      cssTarget: ["chrome63", "safari12"],
      rollupOptions: {
        output: {
          manualChunks: {
            "router-vendor": ["react-router-dom"],
            html2canvas: ["html2canvas"],
          },
        },
      },
    },
  };
});
